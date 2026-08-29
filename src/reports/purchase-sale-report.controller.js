const mongoose = require("mongoose");
const Inventory = require("../inventory/inventoryModel"); // Adjust path as needed
const Sale = require("../sale/saleModel"); // Adjust path as needed

/**
 * Product Analytics Controller
 * Calculates purchase, sales, profit, and stock data across product lifecycle
 */

// Helper function to build date filter
const buildDateFilter = (filter, dateField = "createdAt") => {
  const { period, startDate, endDate } = filter;
  const now = new Date();
  let dateFilter = {};

  switch (period) {
    case "today":
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const todayEnd = new Date(now.setHours(23, 59, 59, 999));
      dateFilter[dateField] = { $gte: todayStart, $lte: todayEnd };
      break;

    case "yesterday":
      const yesterdayStart = new Date(now);
      yesterdayStart.setDate(now.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterdayStart);
      yesterdayEnd.setHours(23, 59, 59, 999);
      dateFilter[dateField] = { $gte: yesterdayStart, $lte: yesterdayEnd };
      break;

    case "week":
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      dateFilter[dateField] = { $gte: weekStart, $lte: weekEnd };
      break;

    case "month":
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      dateFilter[dateField] = { $gte: monthStart, $lte: monthEnd };
      break;

    case "custom":
      if (startDate && endDate) {
        dateFilter[dateField] = {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };
      }
      break;

    default:
      // No date filter - all time
      break;
  }

  return dateFilter;
};

// Helper function to build product filter
const buildProductFilter = (filter) => {
  const { productId, productName, productRef } = filter;
  let productFilter = {};

  if (productRef) {
    productFilter.productRef = new mongoose.Types.ObjectId(productRef);
  }

  if (productId) {
    productFilter.productId = parseInt(productId);
  }

  if (productName) {
    productFilter.productName = { $regex: productName, $options: "i" };
  }

  return productFilter;
};

/**
 * Get comprehensive product analytics
 * @route GET /api/analytics/products
 * @query {string} period - today|yesterday|week|month|custom|all
 * @query {string} startDate - Start date for custom range (YYYY-MM-DD)
 * @query {string} endDate - End date for custom range (YYYY-MM-DD)
 * @query {string} productId - Filter by product ID
 * @query {string} productName - Filter by product name (partial match)
 * @query {string} productRef - Filter by product reference ObjectId
 */
const getProductAnalytics = async (req, res) => {
  try {
    const {
      period = "all",
      startDate,
      endDate,
      productId,
      productName,
      productRef,
    } = req.query;

    const filter = { period, startDate, endDate, productId, productName, productRef };
    const inventoryDateFilter = buildDateFilter(filter, "createdAt");
    const saleDateFilter = buildDateFilter(filter, "saleDate");
    const productFilter = buildProductFilter(filter);

    // Build match stages
    const inventoryMatch = {
      ...productFilter,
      ...inventoryDateFilter,
      purchaseReturn: { $ne: true }, // Exclude purchase returns from purchase calculation
    };

    const saleMatch = {
      ...saleDateFilter,
      saleReturn: { $ne: true }, // Exclude sale returns
    };

    // If product filter exists, add it to sale detail matching
    const saleProductMatch = {};
    if (productRef) {
      saleProductMatch["saleDetail.productRef"] = new mongoose.Types.ObjectId(productRef);
    }
    if (productId) {
      saleProductMatch["saleDetail.productId"] = parseInt(productId);
    }
    if (productName) {
      saleProductMatch["saleDetail.productName"] = { $regex: productName, $options: "i" };
    }

    // Aggregate inventory data (purchases)
    const inventoryAggregation = await Inventory.aggregate([
      { $match: inventoryMatch },
      {
        $group: {
          _id: "$productRef",
          productName: { $first: "$productName" },
          productId: { $first: "$productId" },
          // Purchase metrics
          totalPurchaseUnits: { $sum: "$totalUnits" },
          totalPurchaseAmount: { $sum: "$totalPrice" },
          totalInventoryCount: { $sum: 1 },
          // Current stock
          currentStock: { $sum: "$totalInventory" },
          // Average costs
          avgUnitPrice: { $avg: "$unitPrice" },
          avgSalePrice: { $avg: "$salePrice" },
          // Inventory adjustments
          inventoryAdjustments: { $push: "$inventoryAdjust" },
          // All batches for this product
          batches: {
            $push: {
              batchNumber: "$batchNumber",
              totalInventory: "$totalInventory",
              totalUnits: "$totalUnits",
              unitPrice: "$unitPrice",
              salePrice: "$salePrice",
              totalPrice: "$totalPrice",
              expiryDate: "$expiryDate",
              createdAt: "$createdAt",
            },
          },
        },
      },
    ]);

    // Aggregate sales data
    const salesAggregation = await Sale.aggregate([
      { $match: saleMatch },
      { $unwind: "$saleDetail" },
      ...(Object.keys(saleProductMatch).length > 0 ? [{ $match: saleProductMatch }] : []),
      {
        $group: {
          _id: "$saleDetail.productRef",
          productName: { $first: "$saleDetail.productName" },
          productId: { $first: "$saleDetail.productId" },
          // Sales metrics
          totalSaleQuantity: { $sum: "$saleDetail.saleQuantity" },
          totalSaleAmount: { $sum: "$saleDetail.totalPrice" },
          totalSaleDiscount: { $sum: "$saleDetail.saleDiscount" },
          totalProfit: { $sum: "$saleDetail.productProfit" },
          salesCount: { $sum: 1 },
          // Average sale price
          avgSalePrice: { $avg: "$saleDetail.salePrice" },
        },
      },
    ]);

    // Aggregate purchase returns
    const purchaseReturnsAggregation = await Inventory.aggregate([
      {
        $match: {
          ...productFilter,
          ...inventoryDateFilter,
          purchaseReturn: true,
        },
      },
      {
        $group: {
          _id: "$productRef",
          totalReturnUnits: { $sum: "$totalUnits" },
          totalReturnAmount: { $sum: "$totalPrice" },
          returnCount: { $sum: 1 },
        },
      },
    ]);

    // Aggregate inventory adjustments separately for detailed calculation
    const adjustmentsAggregation = await Inventory.aggregate([
      { $match: productFilter },
      { $unwind: { path: "$inventoryAdjust", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$productRef",
          totalPositiveAdjustments: {
            $sum: {
              $cond: [{ $gt: ["$inventoryAdjust.quantity", 0] }, "$inventoryAdjust.quantity", 0],
            },
          },
          totalNegativeAdjustments: {
            $sum: {
              $cond: [{ $lt: ["$inventoryAdjust.quantity", 0] }, "$inventoryAdjust.quantity", 0],
            },
          },
          adjustmentCount: { $sum: 1 },
        },
      },
    ]);

    // Create maps for easy lookup
    const salesMap = new Map(salesAggregation.map((s) => [s._id?.toString(), s]));
    const returnsMap = new Map(purchaseReturnsAggregation.map((r) => [r._id?.toString(), r]));
    const adjustmentsMap = new Map(adjustmentsAggregation.map((a) => [a._id?.toString(), a]));

    // Combine all data
    const productAnalytics = inventoryAggregation.map((inv) => {
      const productId = inv._id?.toString();
      const sales = salesMap.get(productId) || {};
      const returns = returnsMap.get(productId) || {};
      const adjustments = adjustmentsMap.get(productId) || {};

      // Calculate net adjustments
      const netAdjustments =
        (adjustments.totalPositiveAdjustments || 0) + (adjustments.totalNegativeAdjustments || 0);

      // Calculate metrics
      const totalPurchased = inv.totalPurchaseUnits || 0;
      const totalSold = sales.totalSaleQuantity || 0;
      const totalReturned = returns.totalReturnUnits || 0;
      const currentStock = inv.currentStock || 0;

      // Calculate profit
      const totalSaleAmount = sales.totalSaleAmount || 0;
      const recordedProfit = sales.totalProfit || 0;

      // Calculate cost of goods sold (COGS)
      const avgCostPerUnit = inv.avgUnitPrice || 0;
      const cogs = totalSold * avgCostPerUnit;
      const calculatedProfit = totalSaleAmount - cogs;

      return {
        productRef: inv._id,
        productId: inv.productId,
        productName: inv.productName,

        // Purchase Summary
        purchase: {
          totalUnits: totalPurchased,
          totalAmount: Math.round(inv.totalPurchaseAmount * 100) / 100,
          avgUnitPrice: Math.round(avgCostPerUnit * 100) / 100,
          batchCount: inv.totalInventoryCount,
        },

        // Sales Summary
        sales: {
          totalQuantity: totalSold,
          totalAmount: Math.round(totalSaleAmount * 100) / 100,
          totalDiscount: Math.round((sales.totalSaleDiscount || 0) * 100) / 100,
          avgSalePrice: Math.round((sales.avgSalePrice || 0) * 100) / 100,
          transactionCount: sales.salesCount || 0,
        },

        // Returns Summary
        purchaseReturns: {
          totalUnits: totalReturned,
          totalAmount: Math.round((returns.totalReturnAmount || 0) * 100) / 100,
          returnCount: returns.returnCount || 0,
        },

        // Inventory Adjustments
        adjustments: {
          positive: adjustments.totalPositiveAdjustments || 0,
          negative: adjustments.totalNegativeAdjustments || 0,
          net: netAdjustments,
          count: adjustments.adjustmentCount || 0,
        },

        // Stock Summary
        stock: {
          currentAvailable: currentStock,
          // Theoretical stock = purchased - sold - returned + adjustments
          theoreticalStock: totalPurchased - totalSold - totalReturned + netAdjustments,
          stockDiscrepancy:
            currentStock - (totalPurchased - totalSold - totalReturned + netAdjustments),
        },

        // Profit Summary
        profit: {
          recorded: Math.round(recordedProfit * 100) / 100,
          calculated: Math.round(calculatedProfit * 100) / 100,
          costOfGoodsSold: Math.round(cogs * 100) / 100,
          grossMargin:
            totalSaleAmount > 0
              ? Math.round((calculatedProfit / totalSaleAmount) * 100 * 100) / 100
              : 0,
        },

        // Batch details
        batches: inv.batches,
      };
    });

    // Calculate overall summary
    const overallSummary = {
      totalProducts: productAnalytics.length,
      totalPurchaseAmount: Math.round(
        productAnalytics.reduce((sum, p) => sum + p.purchase.totalAmount, 0) * 100
      ) / 100,
      totalPurchaseUnits: productAnalytics.reduce((sum, p) => sum + p.purchase.totalUnits, 0),
      totalSaleAmount: Math.round(
        productAnalytics.reduce((sum, p) => sum + p.sales.totalAmount, 0) * 100
      ) / 100,
      totalSaleQuantity: productAnalytics.reduce((sum, p) => sum + p.sales.totalQuantity, 0),
      totalProfit: Math.round(
        productAnalytics.reduce((sum, p) => sum + p.profit.calculated, 0) * 100
      ) / 100,
      totalCurrentStock: productAnalytics.reduce((sum, p) => sum + p.stock.currentAvailable, 0),
      averageGrossMargin:
        productAnalytics.length > 0
          ? Math.round(
              (productAnalytics.reduce((sum, p) => sum + p.profit.grossMargin, 0) /
                productAnalytics.length) *
                100
            ) / 100
          : 0,
    };

    res.status(200).json({
      success: true,
      filter: {
        period,
        startDate: startDate || null,
        endDate: endDate || null,
        productId: productId || null,
        productName: productName || null,
        productRef: productRef || null,
      },
      summary: overallSummary,
      products: productAnalytics,
    });
  } catch (error) {
    console.error("Product Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching product analytics",
      error: error.message,
    });
  }
};

/**
 * Get single product detailed analytics
 * @route GET /api/analytics/products/:productRef
 */
const getSingleProductAnalytics = async (req, res) => {
  try {
    const { productRef } = req.params;
    const { period = "all", startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(productRef)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product reference",
      });
    }

    const filter = { period, startDate, endDate, productRef };
    const inventoryDateFilter = buildDateFilter(filter, "createdAt");
    const saleDateFilter = buildDateFilter(filter, "saleDate");

    const productObjId = new mongoose.Types.ObjectId(productRef);

    // Get all inventory batches for this product
    const inventoryBatches = await Inventory.find({
      productRef: productObjId,
      ...inventoryDateFilter,
    }).sort({ createdAt: -1 });

    // Get all sales for this product
    const salesData = await Sale.aggregate([
      {
        $match: {
          ...saleDateFilter,
          saleReturn: { $ne: true },
        },
      },
      { $unwind: "$saleDetail" },
      { $match: { "saleDetail.productRef": productObjId } },
      {
        $project: {
          orderNo: 1,
          saleDate: 1,
          customerRef: 1,
          batchNumber: "$saleDetail.batchNumber",
          productName: "$saleDetail.productName",
          salePrice: "$saleDetail.salePrice",
          saleQuantity: "$saleDetail.saleQuantity",
          saleDiscount: "$saleDetail.saleDiscount",
          totalPrice: "$saleDetail.totalPrice",
          productProfit: "$saleDetail.productProfit",
        },
      },
      { $sort: { saleDate: -1 } },
    ]);

    // Calculate totals
    const purchaseSummary = inventoryBatches
      .filter((b) => !b.purchaseReturn)
      .reduce(
        (acc, batch) => {
          acc.totalUnits += batch.totalUnits || 0;
          acc.totalAmount += batch.totalPrice || 0;
          acc.currentStock += batch.totalInventory || 0;
          return acc;
        },
        { totalUnits: 0, totalAmount: 0, currentStock: 0 }
      );

    const salesSummary = salesData.reduce(
      (acc, sale) => {
        acc.totalQuantity += sale.saleQuantity || 0;
        acc.totalAmount += sale.totalPrice || 0;
        acc.totalDiscount += sale.saleDiscount || 0;
        acc.totalProfit += sale.productProfit || 0;
        return acc;
      },
      { totalQuantity: 0, totalAmount: 0, totalDiscount: 0, totalProfit: 0 }
    );

    // Get adjustment history
    const adjustmentHistory = [];
    inventoryBatches.forEach((batch) => {
      if (batch.inventoryAdjust && batch.inventoryAdjust.length > 0) {
        batch.inventoryAdjust.forEach((adj) => {
          adjustmentHistory.push({
            batchNumber: batch.batchNumber,
            ...adj,
          });
        });
      }
    });

    // Sales by batch
    const salesByBatch = salesData.reduce((acc, sale) => {
      if (!acc[sale.batchNumber]) {
        acc[sale.batchNumber] = {
          totalQuantity: 0,
          totalAmount: 0,
          salesCount: 0,
        };
      }
      acc[sale.batchNumber].totalQuantity += sale.saleQuantity || 0;
      acc[sale.batchNumber].totalAmount += sale.totalPrice || 0;
      acc[sale.batchNumber].salesCount += 1;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      filter: { period, startDate, endDate },
      product: {
        productRef,
        productName: inventoryBatches[0]?.productName || salesData[0]?.productName || "Unknown",
        productId: inventoryBatches[0]?.productId,
      },
      summary: {
        purchase: {
          totalUnits: purchaseSummary.totalUnits,
          totalAmount: Math.round(purchaseSummary.totalAmount * 100) / 100,
          batchCount: inventoryBatches.filter((b) => !b.purchaseReturn).length,
        },
        sales: {
          totalQuantity: salesSummary.totalQuantity,
          totalAmount: Math.round(salesSummary.totalAmount * 100) / 100,
          totalDiscount: Math.round(salesSummary.totalDiscount * 100) / 100,
          transactionCount: salesData.length,
        },
        stock: {
          currentAvailable: purchaseSummary.currentStock,
        },
        profit: {
          total: Math.round(salesSummary.totalProfit * 100) / 100,
          margin:
            salesSummary.totalAmount > 0
              ? Math.round((salesSummary.totalProfit / salesSummary.totalAmount) * 100 * 100) / 100
              : 0,
        },
      },
      batches: inventoryBatches.map((batch) => ({
        batchNumber: batch.batchNumber,
        totalUnits: batch.totalUnits,
        currentStock: batch.totalInventory,
        unitPrice: batch.unitPrice,
        salePrice: batch.salePrice,
        totalPrice: batch.totalPrice,
        expiryDate: batch.expiryDate,
        isPurchaseReturn: batch.purchaseReturn,
        adjustments: batch.inventoryAdjust || [],
        salesFromBatch: salesByBatch[batch.batchNumber] || {
          totalQuantity: 0,
          totalAmount: 0,
          salesCount: 0,
        },
        createdAt: batch.createdAt,
      })),
      recentSales: salesData.slice(0, 50), // Last 50 sales
      adjustmentHistory,
    });
  } catch (error) {
    console.error("Single Product Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching product analytics",
      error: error.message,
    });
  }
};

/**
 * Get dashboard summary
 * @route GET /api/analytics/dashboard
 */
const getDashboardSummary = async (req, res) => {
  try {
    const { period = "today" } = req.query;

    const filter = { period };
    const inventoryDateFilter = buildDateFilter(filter, "createdAt");
    const saleDateFilter = buildDateFilter(filter, "saleDate");

    // Today's purchases
    const purchaseSummary = await Inventory.aggregate([
      {
        $match: {
          ...inventoryDateFilter,
          purchaseReturn: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalPrice" },
          totalUnits: { $sum: "$totalUnits" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Today's sales
    const salesSummary = await Sale.aggregate([
      {
        $match: {
          ...saleDateFilter,
          saleReturn: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$grandTotal" },
          totalQuantity: { $sum: "$totalQuantity" },
          totalDiscount: { $sum: "$totalDiscount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Today's profit (from sale details)
    const profitSummary = await Sale.aggregate([
      {
        $match: {
          ...saleDateFilter,
          saleReturn: { $ne: true },
        },
      },
      { $unwind: "$saleDetail" },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: "$saleDetail.productProfit" },
        },
      },
    ]);

    // Low stock products
    const lowStockProducts = await Inventory.aggregate([
      {
        $match: {
          purchaseReturn: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$productRef",
          productName: { $first: "$productName" },
          productId: { $first: "$productId" },
          totalStock: { $sum: "$totalInventory" },
          limit: { $first: "$limit" },
        },
      },
      {
        $match: {
          $expr: {
            $lte: ["$totalStock", { $toInt: { $ifNull: ["$limit", "10"] } }],
          },
        },
      },
      { $limit: 10 },
    ]);

    // Top selling products
    const topSellingProducts = await Sale.aggregate([
      {
        $match: {
          ...saleDateFilter,
          saleReturn: { $ne: true },
        },
      },
      { $unwind: "$saleDetail" },
      {
        $group: {
          _id: "$saleDetail.productRef",
          productName: { $first: "$saleDetail.productName" },
          productId: { $first: "$saleDetail.productId" },
          totalQuantity: { $sum: "$saleDetail.saleQuantity" },
          totalAmount: { $sum: "$saleDetail.totalPrice" },
          totalProfit: { $sum: "$saleDetail.productProfit" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      success: true,
      period,
      summary: {
        purchases: {
          totalAmount: purchaseSummary[0]?.totalAmount || 0,
          totalUnits: purchaseSummary[0]?.totalUnits || 0,
          count: purchaseSummary[0]?.count || 0,
        },
        sales: {
          totalAmount: salesSummary[0]?.totalAmount || 0,
          totalQuantity: salesSummary[0]?.totalQuantity || 0,
          totalDiscount: salesSummary[0]?.totalDiscount || 0,
          count: salesSummary[0]?.count || 0,
        },
        profit: {
          total: profitSummary[0]?.totalProfit || 0,
        },
      },
      lowStockProducts,
      topSellingProducts,
    });
  } catch (error) {
    console.error("Dashboard Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard summary",
      error: error.message,
    });
  }
};

/**
 * Get stock movement report
 * @route GET /api/analytics/stock-movement
 */
const getStockMovement = async (req, res) => {
  try {
    const {
      period = "month",
      startDate,
      endDate,
      productRef,
    } = req.query;

    const filter = { period, startDate, endDate };
    const inventoryDateFilter = buildDateFilter(filter, "createdAt");
    const saleDateFilter = buildDateFilter(filter, "saleDate");

    const productMatch = productRef
      ? { productRef: new mongoose.Types.ObjectId(productRef) }
      : {};

    // Stock In (Purchases)
    const stockIn = await Inventory.aggregate([
      {
        $match: {
          ...productMatch,
          ...inventoryDateFilter,
          purchaseReturn: { $ne: true },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          },
          totalUnits: { $sum: "$totalUnits" },
          totalAmount: { $sum: "$totalPrice" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Stock Out (Sales)
    const saleProductMatch = productRef
      ? { "saleDetail.productRef": new mongoose.Types.ObjectId(productRef) }
      : {};

    const stockOut = await Sale.aggregate([
      {
        $match: {
          ...saleDateFilter,
          saleReturn: { $ne: true },
        },
      },
      { $unwind: "$saleDetail" },
      ...(productRef ? [{ $match: saleProductMatch }] : []),
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } },
          },
          totalQuantity: { $sum: "$saleDetail.saleQuantity" },
          totalAmount: { $sum: "$saleDetail.totalPrice" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Adjustments by date
    const adjustments = await Inventory.aggregate([
      { $match: productMatch },
      { $unwind: { path: "$inventoryAdjust", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: {
            date: "$inventoryAdjust.date",
          },
          positive: {
            $sum: {
              $cond: [{ $gt: ["$inventoryAdjust.quantity", 0] }, "$inventoryAdjust.quantity", 0],
            },
          },
          negative: {
            $sum: {
              $cond: [{ $lt: ["$inventoryAdjust.quantity", 0] }, "$inventoryAdjust.quantity", 0],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    res.status(200).json({
      success: true,
      filter: { period, startDate, endDate, productRef },
      stockIn: stockIn.map((s) => ({
        date: s._id.date,
        units: s.totalUnits,
        amount: s.totalAmount,
        transactions: s.count,
      })),
      stockOut: stockOut.map((s) => ({
        date: s._id.date,
        quantity: s.totalQuantity,
        amount: s.totalAmount,
        transactions: s.count,
      })),
      adjustments: adjustments.map((a) => ({
        date: a._id.date,
        positive: a.positive,
        negative: a.negative,
        net: a.positive + a.negative,
        count: a.count,
      })),
    });
  } catch (error) {
    console.error("Stock Movement Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching stock movement",
      error: error.message,
    });
  }
};

module.exports = {
  getProductAnalytics,
  getSingleProductAnalytics,
  getDashboardSummary,
  getStockMovement,
};