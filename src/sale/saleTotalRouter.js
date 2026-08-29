const express = require("express");
const mongoose = require("mongoose");
const Sale = require("./saleModel"); // Adjust path as needed
const cors = require("../cors"); // Your cors config

const saleRouter = express.Router();

/**
 * Query Builder Helper
 * Builds MongoDB query from request body filters
 */
const queryBuilder = (body) => {
  const query = {};

  // Date range filter
  if (body.startDate || body.endDate) {
    query.saleDate = {};
    if (body.startDate) {
      query.saleDate.$gte = new Date(body.startDate);
    }
    if (body.endDate) {
      const endDate = new Date(body.endDate);
      endDate.setHours(23, 59, 59, 999);
      query.saleDate.$lte = endDate;
    }
  }

  // Vendor filter
  if (body.vendorId) {
    query.vendorId = new mongoose.Types.ObjectId(body.vendorId);
  }

  // Customer filter
  if (body.customerRef) {
    query.customerRef = new mongoose.Types.ObjectId(body.customerRef);
  }

  // User filter
  if (body.user) {
    query.user = new mongoose.Types.ObjectId(body.user);
  }

  // Payment method filter
  if (body.paymentMethod) {
    query.paymentMethod = new mongoose.Types.ObjectId(body.paymentMethod);
  }

  // Payment status filter
  if (body.paymentStatus) {
    query.paymentStatus = body.paymentStatus;
  }

  // Order status filter
  if (body.orderStatus) {
    query.orderStatus = body.orderStatus;
  }

  // Walking customer filter
  if (typeof body.walkingCustomer === "boolean") {
    query.walkingCustomer = body.walkingCustomer;
  }

  // Online order filter
  if (typeof body.onlineOrder === "boolean") {
    query.onlineOrder = body.onlineOrder;
  }

  // Sale return filter
  if (typeof body.saleReturn === "boolean") {
    query.saleReturn = body.saleReturn;
  }

  // Order number search
  if (body.orderNo) {
    query.orderNo = { $regex: body.orderNo, $options: "i" };
  }

  // Sync status filter
  if (body.syncStatus) {
    query.syncStatus = body.syncStatus;
  }

  return query;
};

/**
 * Main Sales API Endpoint
 * 
 * Supports multiple query modes:
 * 1. Default: Paginated sales list with totals summary
 * 2. Date Period: Sales + Top 20 products for that period
 * 3. By ProductId: Aggregated results for specific product
 * 4. By BatchNumber: Aggregated results for specific batch
 */
saleRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .post(cors.cors, async (req, res, next) => {
    try {
      const {
        page = 1,
        pageSize = 10,
        sortBy = "createdAt",
        sortOrder = -1,
        productId,
        batchNumber,
        startDate,
        endDate,
        ...filters
      } = req.body;

      const skip = (page - 1) * pageSize;
      const limit = parseInt(pageSize);
      const sort = { [sortBy]: parseInt(sortOrder) };

      // MODE 1: Query by ProductId - Aggregate all occurrences
      if (productId) {
        const productObjectId = new mongoose.Types.ObjectId(productId);
        
        const result = await Sale.aggregate([
          // Match sales containing this product
          {
            $match: {
              "saleDetail.productRef": productObjectId,
              ...(startDate || endDate ? {
                saleDate: {
                  ...(startDate && { $gte: new Date(startDate) }),
                  ...(endDate && { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) })
                }
              } : {})
            }
          },
          // Unwind saleDetail to work with individual products
          { $unwind: "$saleDetail" },
          // Filter only the requested product
          { $match: { "saleDetail.productRef": productObjectId } },
          // Group and aggregate
          {
            $group: {
              _id: "$saleDetail.productRef",
              productName: { $first: "$saleDetail.productName" },
              productId: { $first: "$saleDetail.productId" },
              totalQuantitySold: { $sum: "$saleDetail.saleQuantity" },
              totalUnitsSold: { $sum: "$saleDetail.totalUnits" },
              totalRevenue: { $sum: "$saleDetail.totalPrice" },
              totalDiscount: { $sum: "$saleDetail.saleDiscount" },
              totalProfit: { $sum: "$saleDetail.productProfit" },
              averagePrice: { $avg: "$saleDetail.salePrice" },
              occurrenceCount: { $sum: 1 },
              batches: { $addToSet: "$saleDetail.batchNumber" },
              firstSaleDate: { $min: "$saleDate" },
              lastSaleDate: { $max: "$saleDate" },
              salesOrders: { 
                $push: {
                  orderNo: "$orderNo",
                  saleDate: "$saleDate",
                  quantity: "$saleDetail.saleQuantity",
                  price: "$saleDetail.salePrice",
                  totalPrice: "$saleDetail.totalPrice",
                  discount: "$saleDetail.saleDiscount",
                  profit: "$saleDetail.productProfit",
                  batchNumber: "$saleDetail.batchNumber"
                }
              }
            }
          },
          // Add pagination for sales orders
          {
            $project: {
              _id: 1,
              productName: 1,
              productId: 1,
              totalQuantitySold: 1,
              totalUnitsSold: 1,
              totalRevenue: 1,
              totalDiscount: 1,
              totalProfit: 1,
              averagePrice: { $round: ["$averagePrice", 2] },
              occurrenceCount: 1,
              batchCount: { $size: "$batches" },
              batches: 1,
              firstSaleDate: 1,
              lastSaleDate: 1,
              salesOrders: { $slice: ["$salesOrders", skip, limit] },
              totalOrders: { $size: "$salesOrders" }
            }
          }
        ]);

        return res.status(200).json({
          success: true,
          mode: "productAnalytics",
          data: result[0] || null,
          pagination: {
            page: parseInt(page),
            pageSize: limit,
            totalRecords: result[0]?.totalOrders || 0,
            totalPages: Math.ceil((result[0]?.totalOrders || 0) / limit)
          }
        });
      }

      // MODE 2: Query by BatchNumber - Aggregate all occurrences
      if (batchNumber) {
        const result = await Sale.aggregate([
          // Match sales containing this batch
          {
            $match: {
              "saleDetail.batchNumber": batchNumber,
              ...(startDate || endDate ? {
                saleDate: {
                  ...(startDate && { $gte: new Date(startDate) }),
                  ...(endDate && { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) })
                }
              } : {})
            }
          },
          // Unwind saleDetail
          { $unwind: "$saleDetail" },
          // Filter only the requested batch
          { $match: { "saleDetail.batchNumber": batchNumber } },
          // Group and aggregate
          {
            $group: {
              _id: "$saleDetail.batchNumber",
              products: {
                $addToSet: {
                  productRef: "$saleDetail.productRef",
                  productName: "$saleDetail.productName",
                  productId: "$saleDetail.productId"
                }
              },
              batchDetails: { $first: "$saleDetail.batchDetails" },
              totalQuantitySold: { $sum: "$saleDetail.saleQuantity" },
              totalUnitsSold: { $sum: "$saleDetail.totalUnits" },
              totalRevenue: { $sum: "$saleDetail.totalPrice" },
              totalDiscount: { $sum: "$saleDetail.saleDiscount" },
              totalProfit: { $sum: "$saleDetail.productProfit" },
              averagePrice: { $avg: "$saleDetail.salePrice" },
              occurrenceCount: { $sum: 1 },
              firstSaleDate: { $min: "$saleDate" },
              lastSaleDate: { $max: "$saleDate" },
              salesOrders: {
                $push: {
                  orderNo: "$orderNo",
                  saleDate: "$saleDate",
                  quantity: "$saleDetail.saleQuantity",
                  price: "$saleDetail.salePrice",
                  totalPrice: "$saleDetail.totalPrice",
                  discount: "$saleDetail.saleDiscount",
                  profit: "$saleDetail.productProfit",
                  productName: "$saleDetail.productName"
                }
              }
            }
          },
          {
            $project: {
              _id: 1,
              products: 1,
              batchDetails: 1,
              totalQuantitySold: 1,
              totalUnitsSold: 1,
              totalRevenue: 1,
              totalDiscount: 1,
              totalProfit: 1,
              averagePrice: { $round: ["$averagePrice", 2] },
              occurrenceCount: 1,
              firstSaleDate: 1,
              lastSaleDate: 1,
              salesOrders: { $slice: ["$salesOrders", skip, limit] },
              totalOrders: { $size: "$salesOrders" }
            }
          }
        ]);

        return res.status(200).json({
          success: true,
          mode: "batchAnalytics",
          data: result[0] || null,
          pagination: {
            page: parseInt(page),
            pageSize: limit,
            totalRecords: result[0]?.totalOrders || 0,
            totalPages: Math.ceil((result[0]?.totalOrders || 0) / limit)
          }
        });
      }

      // MODE 3: Date Period Query - Sales + Top 20 Products
      // MODE 4: Default Query - Paginated Sales with Summary
      
      const baseQuery = queryBuilder({ ...filters, startDate, endDate });
      const isDatePeriodQuery = startDate || endDate;

      // Get total count for pagination
      const totalRecords = await Sale.countDocuments(baseQuery);

      // Get paginated sales data
      const sales = await Sale.find(baseQuery)
        .populate("vendorId", "name phone")
        .populate("customerRef", "name phone address")
        .populate("user", "name email")
        .populate("paymentMethod", "name")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      // Calculate summary totals
      const summaryPipeline = [
        { $match: baseQuery },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalQuantity: { $sum: "$totalQuantity" },
            totalSubTotal: { $sum: "$subTotal" },
            totalDiscount: { $sum: "$totalDiscount" },
            totalGrandTotal: { $sum: "$grandTotal" },
            totalReceived: { $sum: "$receivedAmount" },
            totalRemaining: { $sum: "$remainingAmount" },
            totalDeliveryCharges: { $sum: "$deliveryCharges" },
            totalAfterDiscount: { $sum: "$totalAfterDiscount" },
            avgOrderValue: { $avg: "$grandTotal" },
            minOrderValue: { $min: "$grandTotal" },
            maxOrderValue: { $max: "$grandTotal" }
          }
        }
      ];

      // Calculate profit from saleDetail
      const profitPipeline = [
        { $match: baseQuery },
        { $unwind: "$saleDetail" },
        {
          $group: {
            _id: null,
            totalProfit: { $sum: "$saleDetail.productProfit" },
            totalItemsSold: { $sum: "$saleDetail.saleQuantity" },
            totalUnits: { $sum: "$saleDetail.totalUnits" }
          }
        }
      ];

      const [summaryResult, profitResult] = await Promise.all([
        Sale.aggregate(summaryPipeline),
        Sale.aggregate(profitPipeline)
      ]);

      const summary = {
        ...(summaryResult[0] || {
          totalSales: 0,
          totalQuantity: 0,
          totalSubTotal: 0,
          totalDiscount: 0,
          totalGrandTotal: 0,
          totalReceived: 0,
          totalRemaining: 0,
          totalDeliveryCharges: 0,
          totalAfterDiscount: 0,
          avgOrderValue: 0,
          minOrderValue: 0,
          maxOrderValue: 0
        }),
        ...(profitResult[0] || {
          totalProfit: 0,
          totalItemsSold: 0,
          totalUnits: 0
        })
      };
      delete summary._id;

      // Round averages
      if (summary.avgOrderValue) {
        summary.avgOrderValue = Math.round(summary.avgOrderValue * 100) / 100;
      }

      // Payment status breakdown
      const paymentStatusPipeline = [
        { $match: baseQuery },
        {
          $group: {
            _id: "$paymentStatus",
            count: { $sum: 1 },
            total: { $sum: "$grandTotal" }
          }
        }
      ];

      const paymentStatusBreakdown = await Sale.aggregate(paymentStatusPipeline);

      // For date period queries, get top 20 products
      let topProducts = null;
      if (isDatePeriodQuery) {
        const topProductsPipeline = [
          { $match: baseQuery },
          { $unwind: "$saleDetail" },
          {
            $group: {
              _id: "$saleDetail.productRef",
              productName: { $first: "$saleDetail.productName" },
              productId: { $first: "$saleDetail.productId" },
              totalQuantity: { $sum: "$saleDetail.saleQuantity" },
              totalUnits: { $sum: "$saleDetail.totalUnits" },
              totalRevenue: { $sum: "$saleDetail.totalPrice" },
              totalDiscount: { $sum: "$saleDetail.saleDiscount" },
              totalProfit: { $sum: "$saleDetail.productProfit" },
              averagePrice: { $avg: "$saleDetail.salePrice" },
              orderCount: { $sum: 1 }
            }
          },
          { $sort: { totalRevenue: -1 } },
          { $limit: 20 },
          {
            $project: {
              _id: 1,
              productName: 1,
              productId: 1,
              totalQuantity: 1,
              totalUnits: 1,
              totalRevenue: 1,
              totalDiscount: 1,
              totalProfit: 1,
              averagePrice: { $round: ["$averagePrice", 2] },
              orderCount: 1,
              profitMargin: {
                $cond: [
                  { $eq: ["$totalRevenue", 0] },
                  0,
                  { $round: [{ $multiply: [{ $divide: ["$totalProfit", "$totalRevenue"] }, 100] }, 2] }
                ]
              }
            }
          }
        ];

        topProducts = await Sale.aggregate(topProductsPipeline);

        // Also get product totals for the period
        const productTotalsPipeline = [
          { $match: baseQuery },
          { $unwind: "$saleDetail" },
          {
            $group: {
              _id: null,
              uniqueProducts: { $addToSet: "$saleDetail.productRef" },
              totalProductQuantity: { $sum: "$saleDetail.saleQuantity" },
              totalProductRevenue: { $sum: "$saleDetail.totalPrice" },
              totalProductDiscount: { $sum: "$saleDetail.saleDiscount" },
              totalProductProfit: { $sum: "$saleDetail.productProfit" }
            }
          },
          {
            $project: {
              _id: 0,
              uniqueProductCount: { $size: "$uniqueProducts" },
              totalProductQuantity: 1,
              totalProductRevenue: 1,
              totalProductDiscount: 1,
              totalProductProfit: 1
            }
          }
        ];

        const productTotals = await Sale.aggregate(productTotalsPipeline);
        summary.productTotals = productTotals[0] || {
          uniqueProductCount: 0,
          totalProductQuantity: 0,
          totalProductRevenue: 0,
          totalProductDiscount: 0,
          totalProductProfit: 0
        };
      }

      const response = {
        success: true,
        mode: isDatePeriodQuery ? "datePeriodAnalytics" : "salesList",
        data: sales,
        summary: summary,
        paymentStatusBreakdown: paymentStatusBreakdown.reduce((acc, item) => {
          acc[item._id || "none"] = { count: item.count, total: item.total };
          return acc;
        }, {}),
        pagination: {
          page: parseInt(page),
          pageSize: limit,
          totalRecords: totalRecords,
          totalPages: Math.ceil(totalRecords / limit),
          hasNextPage: page * limit < totalRecords,
          hasPrevPage: page > 1
        }
      };

      // Add top products for date period queries
      if (topProducts) {
        response.topProducts = topProducts;
      }

      return res.status(200).json(response);

    } catch (error) {
      console.error("Sales API Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching sales data",
        error: error.message
      });
    }
  });

/**
 * Get Single Sale Details
 */
saleRouter
  .route("/:id")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res, next) => {
    try {
      const sale = await Sale.findById(req.params.id)
        .populate("vendorId", "name phone address")
        .populate("customerRef", "name phone address")
        .populate("user", "name email")
        .populate("editBy", "name email")
        .populate("paymentMethod", "name")
        .populate("saleDetail.productRef", "name productId category")
        .lean();

      if (!sale) {
        return res.status(404).json({
          success: false,
          message: "Sale not found"
        });
      }

      return res.status(200).json({
        success: true,
        data: sale
      });

    } catch (error) {
      console.error("Get Sale Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching sale",
        error: error.message
      });
    }
  });

/**
 * Sales Dashboard Summary
 * Quick overview stats without full data
 */
saleRouter
  .route("/dashboard/summary")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .post(cors.cors, async (req, res, next) => {
    try {
      const { startDate, endDate, vendorId, customerRef } = req.body;
      
      const baseQuery = queryBuilder({ startDate, endDate, vendorId, customerRef });

      const pipeline = [
        { $match: baseQuery },
        {
          $facet: {
            // Overall totals
            totals: [
              {
                $group: {
                  _id: null,
                  totalSales: { $sum: 1 },
                  totalRevenue: { $sum: "$grandTotal" },
                  totalReceived: { $sum: "$receivedAmount" },
                  totalPending: { $sum: "$remainingAmount" },
                  totalDiscount: { $sum: "$totalDiscount" },
                  avgOrderValue: { $avg: "$grandTotal" }
                }
              }
            ],
            // By payment status
            byPaymentStatus: [
              {
                $group: {
                  _id: "$paymentStatus",
                  count: { $sum: 1 },
                  total: { $sum: "$grandTotal" }
                }
              }
            ],
            // By order status
            byOrderStatus: [
              {
                $group: {
                  _id: "$orderStatus",
                  count: { $sum: 1 },
                  total: { $sum: "$grandTotal" }
                }
              }
            ],
            // Daily trend (last 30 days or within date range)
            dailyTrend: [
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } },
                  count: { $sum: 1 },
                  total: { $sum: "$grandTotal" }
                }
              },
              { $sort: { _id: 1 } },
              { $limit: 30 }
            ],
            // Product profit totals
            profitTotals: [
              { $unwind: "$saleDetail" },
              {
                $group: {
                  _id: null,
                  totalProfit: { $sum: "$saleDetail.productProfit" },
                  totalItems: { $sum: "$saleDetail.saleQuantity" }
                }
              }
            ]
          }
        }
      ];

      const result = await Sale.aggregate(pipeline);
      const data = result[0];

      const response = {
        success: true,
        summary: {
          ...(data.totals[0] || {
            totalSales: 0,
            totalRevenue: 0,
            totalReceived: 0,
            totalPending: 0,
            totalDiscount: 0,
            avgOrderValue: 0
          }),
          ...(data.profitTotals[0] || {
            totalProfit: 0,
            totalItems: 0
          })
        },
        byPaymentStatus: data.byPaymentStatus,
        byOrderStatus: data.byOrderStatus,
        dailyTrend: data.dailyTrend
      };

      // Clean up _id from summary
      delete response.summary._id;
      
      // Round average
      if (response.summary.avgOrderValue) {
        response.summary.avgOrderValue = Math.round(response.summary.avgOrderValue * 100) / 100;
      }

      return res.status(200).json(response);

    } catch (error) {
      console.error("Dashboard Summary Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching dashboard summary",
        error: error.message
      });
    }
  });

/**
 * Product Performance Report
 * Detailed product analytics across sales
 */
saleRouter
  .route("/reports/products")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .post(cors.cors, async (req, res, next) => {
    try {
      const {
        page = 1,
        pageSize = 20,
        sortBy = "totalRevenue",
        sortOrder = -1,
        startDate,
        endDate,
        vendorId,
        customerRef
      } = req.body;

      const skip = (page - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      const baseQuery = queryBuilder({ startDate, endDate, vendorId, customerRef });

      const pipeline = [
        { $match: baseQuery },
        { $unwind: "$saleDetail" },
        {
          $group: {
            _id: "$saleDetail.productRef",
            productName: { $first: "$saleDetail.productName" },
            productId: { $first: "$saleDetail.productId" },
            totalQuantity: { $sum: "$saleDetail.saleQuantity" },
            totalUnits: { $sum: "$saleDetail.totalUnits" },
            totalRevenue: { $sum: "$saleDetail.totalPrice" },
            totalDiscount: { $sum: "$saleDetail.saleDiscount" },
            totalProfit: { $sum: "$saleDetail.productProfit" },
            averagePrice: { $avg: "$saleDetail.salePrice" },
            orderCount: { $sum: 1 },
            batches: { $addToSet: "$saleDetail.batchNumber" },
            firstSale: { $min: "$saleDate" },
            lastSale: { $max: "$saleDate" }
          }
        },
        {
          $project: {
            _id: 1,
            productName: 1,
            productId: 1,
            totalQuantity: 1,
            totalUnits: 1,
            totalRevenue: 1,
            totalDiscount: 1,
            totalProfit: 1,
            averagePrice: { $round: ["$averagePrice", 2] },
            orderCount: 1,
            batchCount: { $size: "$batches" },
            firstSale: 1,
            lastSale: 1,
            profitMargin: {
              $cond: [
                { $eq: ["$totalRevenue", 0] },
                0,
                { $round: [{ $multiply: [{ $divide: ["$totalProfit", "$totalRevenue"] }, 100] }, 2] }
              ]
            }
          }
        },
        { $sort: { [sortBy]: parseInt(sortOrder) } },
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: limit }
            ],
            totalCount: [
              { $count: "count" }
            ],
            totals: [
              {
                $group: {
                  _id: null,
                  totalProducts: { $sum: 1 },
                  grandTotalQuantity: { $sum: "$totalQuantity" },
                  grandTotalRevenue: { $sum: "$totalRevenue" },
                  grandTotalDiscount: { $sum: "$totalDiscount" },
                  grandTotalProfit: { $sum: "$totalProfit" }
                }
              }
            ]
          }
        }
      ];

      const result = await Sale.aggregate(pipeline);
      const data = result[0];

      const totalRecords = data.totalCount[0]?.count || 0;

      return res.status(200).json({
        success: true,
        data: data.data,
        totals: data.totals[0] || {
          totalProducts: 0,
          grandTotalQuantity: 0,
          grandTotalRevenue: 0,
          grandTotalDiscount: 0,
          grandTotalProfit: 0
        },
        pagination: {
          page: parseInt(page),
          pageSize: limit,
          totalRecords: totalRecords,
          totalPages: Math.ceil(totalRecords / limit),
          hasNextPage: page * limit < totalRecords,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      console.error("Product Report Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching product report",
        error: error.message
      });
    }
  });

/**
 * Customer Sales Report
 */
saleRouter
  .route("/reports/customers")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .post(cors.cors, async (req, res, next) => {
    try {
      const {
        page = 1,
        pageSize = 20,
        sortBy = "totalSpent",
        sortOrder = -1,
        startDate,
        endDate
      } = req.body;

      const skip = (page - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      const baseQuery = queryBuilder({ startDate, endDate });
      // Exclude walking customers for this report
      baseQuery.walkingCustomer = false;
      baseQuery.customerRef = { $exists: true, $ne: null };

      const pipeline = [
        { $match: baseQuery },
        {
          $group: {
            _id: "$customerRef",
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: "$grandTotal" },
            totalPaid: { $sum: "$receivedAmount" },
            totalPending: { $sum: "$remainingAmount" },
            totalDiscount: { $sum: "$totalDiscount" },
            avgOrderValue: { $avg: "$grandTotal" },
            firstOrder: { $min: "$saleDate" },
            lastOrder: { $max: "$saleDate" }
          }
        },
        {
          $lookup: {
            from: "customers",
            localField: "_id",
            foreignField: "_id",
            as: "customer"
          }
        },
        { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            customerName: "$customer.name",
            customerPhone: "$customer.phone",
            customerAddress: "$customer.address",
            totalOrders: 1,
            totalSpent: 1,
            totalPaid: 1,
            totalPending: 1,
            totalDiscount: 1,
            avgOrderValue: { $round: ["$avgOrderValue", 2] },
            firstOrder: 1,
            lastOrder: 1
          }
        },
        { $sort: { [sortBy]: parseInt(sortOrder) } },
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: limit }
            ],
            totalCount: [
              { $count: "count" }
            ],
            totals: [
              {
                $group: {
                  _id: null,
                  totalCustomers: { $sum: 1 },
                  grandTotalSpent: { $sum: "$totalSpent" },
                  grandTotalPaid: { $sum: "$totalPaid" },
                  grandTotalPending: { $sum: "$totalPending" }
                }
              }
            ]
          }
        }
      ];

      const result = await Sale.aggregate(pipeline);
      const data = result[0];

      const totalRecords = data.totalCount[0]?.count || 0;

      return res.status(200).json({
        success: true,
        data: data.data,
        totals: data.totals[0] || {
          totalCustomers: 0,
          grandTotalSpent: 0,
          grandTotalPaid: 0,
          grandTotalPending: 0
        },
        pagination: {
          page: parseInt(page),
          pageSize: limit,
          totalRecords: totalRecords,
          totalPages: Math.ceil(totalRecords / limit),
          hasNextPage: page * limit < totalRecords,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      console.error("Customer Report Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching customer report",
        error: error.message
      });
    }
  });

module.exports = saleRouter;