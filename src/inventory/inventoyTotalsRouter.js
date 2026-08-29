const express = require("express");
const mongoose = require("mongoose");
const Inventory = require("./inventoryModel"); // Adjust path as needed
const cors = require("../cors"); // Adjust path as needed

const inventoryRouter = express.Router();

/**
 * Build query filters from request
 */
function queryBuilder(req) {
  const query = {};
  const { 
    productId, 
    productRef, 
    vendorId, 
    batchNumber,
    startDate, 
    endDate,
    search,
    expiryStartDate,
    expiryEndDate,
    place,
    minPrice,
    maxPrice
  } = req.query;

  // Filter by productId
  if (productId) {
    query.productId = parseInt(productId);
  }

  // Filter by productRef (ObjectId)
  if (productRef) {
    query.productRef = new mongoose.Types.ObjectId(productRef);
  }

  // Filter by vendorId
  if (vendorId) {
    query.vendorId = new mongoose.Types.ObjectId(vendorId);
  }

  // Filter by batchNumber
  if (batchNumber) {
    query.batchNumber = batchNumber;
  }

  // Filter by creation date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  // Filter by expiry date range
  if (expiryStartDate || expiryEndDate) {
    query.expiryDate = {};
    if (expiryStartDate) {
      query.expiryDate.$gte = new Date(expiryStartDate);
    }
    if (expiryEndDate) {
      query.expiryDate.$lte = new Date(expiryEndDate);
    }
  }

  // Filter by place/location
  if (place) {
    query.place = { $regex: place, $options: "i" };
  }

  // Filter by price range
  if (minPrice || maxPrice) {
    query.unitPrice = {};
    if (minPrice) query.unitPrice.$gte = parseFloat(minPrice);
    if (maxPrice) query.unitPrice.$lte = parseFloat(maxPrice);
  }

  // Search by product name
  if (search) {
    query.$or = [
      { productName: { $regex: search, $options: "i" } },
      { ProductsNameurdu: { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } },
      { batchNumber: { $regex: search, $options: "i" } }
    ];
  }

  return query;
}

/**
 * GET /api/inventory
 * Get paginated inventory aggregated by productRef with summary totals
 */
inventoryRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res, next) => {
    try {
      const find = queryBuilder(req);
      const baseFilter = { ...find, totalInventory: { $gt: 0 } };

      // Pagination params
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.pagesize) || 10;
      const skip = (page - 1) * limit;
      const sortField = req.query.sortField || "productName";
      const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

      // Aggregation pipeline for grouped products
      const aggregationPipeline = [
        { $match: baseFilter },
        {
          $group: {
            _id: "$productRef",
            productId: { $first: "$productId" },
            productName: { $first: "$productName" },
            ProductsNameurdu: { $first: "$ProductsNameurdu" },
            barcode: { $first: "$barcode" },
            
            // Inventory totals
            totalInventory: { $sum: "$totalInventory" },
            totalUnits: { $sum: "$totalUnits" },
            totalExtraUnits: { $sum: "$extraUnit" },
            totalPackQuantity: { $sum: "$packQuantity" },
            
            // Price calculations
            totalValue: { $sum: { $multiply: ["$totalInventory", "$unitPrice"] } },
            totalSaleValue: { $sum: { $multiply: ["$totalInventory", "$salePrice"] } },
            avgUnitPrice: { $avg: "$unitPrice" },
            avgSalePrice: { $avg: "$salePrice" },
            minUnitPrice: { $min: "$unitPrice" },
            maxUnitPrice: { $max: "$unitPrice" },
            
            // Stock entries info
            stockEntries: { $sum: 1 },
            batches: { $push: {
              batchNumber: "$batchNumber",
              inventoryNo: "$inventoryNo",
              totalInventory: "$totalInventory",
              unitPrice: "$unitPrice",
              salePrice: "$salePrice",
              expiryDate: "$expiryDate",
              place: "$place",
              createdAt: "$createdAt"
            }},
            
            // Expiry tracking
            nearestExpiry: { $min: "$expiryDate" },
            farthestExpiry: { $max: "$expiryDate" },
            
            // Vendor info
            vendors: { $addToSet: "$vendorId" },
            
            // Latest update
            lastUpdated: { $max: "$updatedAt" }
          }
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "productDetails"
          }
        },
        {
          $lookup: {
            from: "vendors",
            localField: "vendors",
            foreignField: "_id",
            as: "vendorDetails"
          }
        },
        {
          $project: {
            _id: 1,
            productRef: "$_id",
            productId: 1,
            productName: 1,
            ProductsNameurdu: 1,
            barcode: 1,
            totalInventory: 1,
            totalUnits: 1,
            totalExtraUnits: 1,
            totalPackQuantity: 1,
            totalValue: { $round: ["$totalValue", 2] },
            totalSaleValue: { $round: ["$totalSaleValue", 2] },
            potentialProfit: { 
              $round: [{ $subtract: ["$totalSaleValue", "$totalValue"] }, 2] 
            },
            avgUnitPrice: { $round: ["$avgUnitPrice", 2] },
            avgSalePrice: { $round: ["$avgSalePrice", 2] },
            minUnitPrice: 1,
            maxUnitPrice: 1,
            stockEntries: 1,
            batches: 1,
            nearestExpiry: 1,
            farthestExpiry: 1,
            vendorDetails: {
              $map: {
                input: "$vendorDetails",
                as: "v",
                in: { _id: "$$v._id", name: "$$v.name" }
              }
            },
            productDetails: { $arrayElemAt: ["$productDetails", 0] },
            lastUpdated: 1
          }
        },
        { $sort: { [sortField]: sortOrder } }
      ];

      // Get total count of unique products
      const countPipeline = [
        { $match: baseFilter },
        { $group: { _id: "$productRef" } },
        { $count: "total" }
      ];

      // Get overall summary totals (across all matching records, not paginated)
      const summaryPipeline = [
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            totalProducts: { $addToSet: "$productRef" },
            grandTotalInventory: { $sum: "$totalInventory" },
            grandTotalUnits: { $sum: "$totalUnits" },
            grandTotalValue: { $sum: { $multiply: ["$totalInventory", "$unitPrice"] } },
            grandTotalSaleValue: { $sum: { $multiply: ["$totalInventory", "$salePrice"] } },
            totalStockEntries: { $sum: 1 },
            avgUnitPrice: { $avg: "$unitPrice" },
            avgSalePrice: { $avg: "$salePrice" }
          }
        },
        {
          $project: {
            _id: 0,
            uniqueProducts: { $size: "$totalProducts" },
            grandTotalInventory: 1,
            grandTotalUnits: 1,
            grandTotalValue: { $round: ["$grandTotalValue", 2] },
            grandTotalSaleValue: { $round: ["$grandTotalSaleValue", 2] },
            grandPotentialProfit: {
              $round: [{ $subtract: ["$grandTotalSaleValue", "$grandTotalValue"] }, 2]
            },
            totalStockEntries: 1,
            avgUnitPrice: { $round: ["$avgUnitPrice", 2] },
            avgSalePrice: { $round: ["$avgSalePrice", 2] }
          }
        }
      ];

      // Execute all pipelines in parallel
      const [products, countResult, summaryResult] = await Promise.all([
        Inventory.aggregate([
          ...aggregationPipeline,
          { $skip: skip },
          { $limit: limit }
        ]),
        Inventory.aggregate(countPipeline),
        Inventory.aggregate(summaryPipeline)
      ]);

      const totalProducts = countResult[0]?.total || 0;
      const totalPages = Math.ceil(totalProducts / limit);
      const summary = summaryResult[0] || {
        uniqueProducts: 0,
        grandTotalInventory: 0,
        grandTotalUnits: 0,
        grandTotalValue: 0,
        grandTotalSaleValue: 0,
        grandPotentialProfit: 0,
        totalStockEntries: 0,
        avgUnitPrice: 0,
        avgSalePrice: 0
      };

      res.status(200).json({
        success: true,
        data: products,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalProducts,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          nextPage: page < totalPages ? page + 1 : null,
          prevPage: page > 1 ? page - 1 : null
        },
        summary,
        filters: {
          applied: Object.keys(find).length > 0,
          details: find
        }
      });

    } catch (error) {
      console.error("Error fetching inventory:", error);
      next(error);
    }
  });

/**
 * GET /api/inventory/product/:productRef
 * Get all inventory entries for a specific product with aggregated totals
 */
inventoryRouter
  .route("/product/:productRef")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res, next) => {
    try {
      const { productRef } = req.params;
      const { startDate, endDate, page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const matchFilter = {
        productRef: new mongoose.Types.ObjectId(productRef),
        totalInventory: { $gt: 0 }
      };

      // Add date filter if provided
      if (startDate || endDate) {
        matchFilter.createdAt = {};
        if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
        if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
      }

      // Get paginated stock entries
      const stockEntries = await Inventory.find(matchFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("vendorId", "name")
        .lean();

      // Get total count
      const totalEntries = await Inventory.countDocuments(matchFilter);

      // Get aggregated summary for this product
      const summaryPipeline = [
        { $match: matchFilter },
        {
          $group: {
            _id: "$productRef",
            productId: { $first: "$productId" },
            productName: { $first: "$productName" },
            totalInventory: { $sum: "$totalInventory" },
            totalUnits: { $sum: "$totalUnits" },
            totalValue: { $sum: { $multiply: ["$totalInventory", "$unitPrice"] } },
            totalSaleValue: { $sum: { $multiply: ["$totalInventory", "$salePrice"] } },
            avgUnitPrice: { $avg: "$unitPrice" },
            avgSalePrice: { $avg: "$salePrice" },
            stockEntries: { $sum: 1 },
            nearestExpiry: { $min: "$expiryDate" },
            vendors: { $addToSet: "$vendorId" }
          }
        },
        {
          $project: {
            productId: 1,
            productName: 1,
            totalInventory: 1,
            totalUnits: 1,
            totalValue: { $round: ["$totalValue", 2] },
            totalSaleValue: { $round: ["$totalSaleValue", 2] },
            potentialProfit: {
              $round: [{ $subtract: ["$totalSaleValue", "$totalValue"] }, 2]
            },
            avgUnitPrice: { $round: ["$avgUnitPrice", 2] },
            avgSalePrice: { $round: ["$avgSalePrice", 2] },
            stockEntries: 1,
            nearestExpiry: 1,
            vendorCount: { $size: "$vendors" }
          }
        }
      ];

      const [summary] = await Inventory.aggregate(summaryPipeline);

      const totalPages = Math.ceil(totalEntries / parseInt(limit));

      res.status(200).json({
        success: true,
        data: stockEntries,
        summary: summary || null,
        pagination: {
          currentPage: parseInt(page),
          pageSize: parseInt(limit),
          totalEntries,
          totalPages,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      });

    } catch (error) {
      console.error("Error fetching product inventory:", error);
      next(error);
    }
  });

/**
 * GET /api/inventory/summary
 * Get overall inventory summary statistics
 */
inventoryRouter
  .route("/summary")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res, next) => {
    try {
      const find = queryBuilder(req);
      const baseFilter = { ...find, totalInventory: { $gt: 0 } };

      const summaryPipeline = [
        { $match: baseFilter },
        {
          $facet: {
            // Overall totals
            totals: [
              {
                $group: {
                  _id: null,
                  totalProducts: { $addToSet: "$productRef" },
                  totalInventory: { $sum: "$totalInventory" },
                  totalUnits: { $sum: "$totalUnits" },
                  totalValue: { $sum: { $multiply: ["$totalInventory", "$unitPrice"] } },
                  totalSaleValue: { $sum: { $multiply: ["$totalInventory", "$salePrice"] } },
                  totalStockEntries: { $sum: 1 },
                  avgUnitPrice: { $avg: "$unitPrice" },
                  avgSalePrice: { $avg: "$salePrice" }
                }
              },
              {
                $project: {
                  _id: 0,
                  uniqueProducts: { $size: "$totalProducts" },
                  totalInventory: 1,
                  totalUnits: 1,
                  totalValue: { $round: ["$totalValue", 2] },
                  totalSaleValue: { $round: ["$totalSaleValue", 2] },
                  potentialProfit: {
                    $round: [{ $subtract: ["$totalSaleValue", "$totalValue"] }, 2]
                  },
                  totalStockEntries: 1,
                  avgUnitPrice: { $round: ["$avgUnitPrice", 2] },
                  avgSalePrice: { $round: ["$avgSalePrice", 2] }
                }
              }
            ],
            // Top products by inventory
            topByInventory: [
              { $group: {
                  _id: "$productRef",
                  productName: { $first: "$productName" },
                  totalInventory: { $sum: "$totalInventory" }
                }
              },
              { $sort: { totalInventory: -1 } },
              { $limit: 5 }
            ],
            // Top products by value
            topByValue: [
              { $group: {
                  _id: "$productRef",
                  productName: { $first: "$productName" },
                  totalValue: { $sum: { $multiply: ["$totalInventory", "$unitPrice"] } }
                }
              },
              { $sort: { totalValue: -1 } },
              { $limit: 5 },
              { $project: {
                  _id: 1,
                  productName: 1,
                  totalValue: { $round: ["$totalValue", 2] }
                }
              }
            ],
            // Expiring soon (within 30 days)
            expiringSoon: [
              { $match: {
                  expiryDate: {
                    $gte: new Date(),
                    $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  }
                }
              },
              { $group: {
                  _id: "$productRef",
                  productName: { $first: "$productName" },
                  nearestExpiry: { $min: "$expiryDate" },
                  totalInventory: { $sum: "$totalInventory" }
                }
              },
              { $sort: { nearestExpiry: 1 } },
              { $limit: 10 }
            ],
            // By vendor distribution
            byVendor: [
              { $group: {
                  _id: "$vendorId",
                  totalInventory: { $sum: "$totalInventory" },
                  totalValue: { $sum: { $multiply: ["$totalInventory", "$unitPrice"] } },
                  productCount: { $addToSet: "$productRef" }
                }
              },
              { $lookup: {
                  from: "vendors",
                  localField: "_id",
                  foreignField: "_id",
                  as: "vendor"
                }
              },
              { $project: {
                  vendorName: { $arrayElemAt: ["$vendor.name", 0] },
                  totalInventory: 1,
                  totalValue: { $round: ["$totalValue", 2] },
                  productCount: { $size: "$productCount" }
                }
              },
              { $sort: { totalValue: -1 } }
            ]
          }
        }
      ];

      const [result] = await Inventory.aggregate(summaryPipeline);

      res.status(200).json({
        success: true,
        summary: result.totals[0] || {},
        topByInventory: result.topByInventory,
        topByValue: result.topByValue,
        expiringSoon: result.expiringSoon,
        byVendor: result.byVendor,
        filters: {
          applied: Object.keys(find).length > 0,
          details: find
        }
      });

    } catch (error) {
      console.error("Error fetching inventory summary:", error);
      next(error);
    }
  });

/**
 * GET /api/inventory/search
 * Quick search with autocomplete-style results
 */
inventoryRouter
  .route("/search")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res, next) => {
    try {
      const { q, limit = 10 } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Search query must be at least 2 characters"
        });
      }

      const searchPipeline = [
        {
          $match: {
            totalInventory: { $gt: 0 },
            $or: [
              { productName: { $regex: q, $options: "i" } },
              { ProductsNameurdu: { $regex: q, $options: "i" } },
              { barcode: { $regex: q, $options: "i" } },
              { batchNumber: { $regex: q, $options: "i" } }
            ]
          }
        },
        {
          $group: {
            _id: "$productRef",
            productId: { $first: "$productId" },
            productName: { $first: "$productName" },
            barcode: { $first: "$barcode" },
            totalInventory: { $sum: "$totalInventory" },
            avgPrice: { $avg: "$unitPrice" }
          }
        },
        { $limit: parseInt(limit) },
        {
          $project: {
            productRef: "$_id",
            productId: 1,
            productName: 1,
            barcode: 1,
            totalInventory: 1,
            avgPrice: { $round: ["$avgPrice", 2] }
          }
        }
      ];

      const results = await Inventory.aggregate(searchPipeline);

      res.status(200).json({
        success: true,
        data: results,
        count: results.length
      });

    } catch (error) {
      console.error("Error searching inventory:", error);
      next(error);
    }
  });

/**
 * GET /api/inventory/by-date-range
 * Get inventory statistics grouped by date
 */
inventoryRouter
  .route("/by-date-range")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res, next) => {
    try {
      const { startDate, endDate, groupBy = "day" } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "startDate and endDate are required"
        });
      }

      // Determine date grouping format
      let dateFormat;
      switch (groupBy) {
        case "month":
          dateFormat = "%Y-%m";
          break;
        case "week":
          dateFormat = "%Y-W%V";
          break;
        case "day":
        default:
          dateFormat = "%Y-%m-%d";
      }

      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            },
            totalInventory: { $gt: 0 }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
            totalInventory: { $sum: "$totalInventory" },
            totalValue: { $sum: { $multiply: ["$totalInventory", "$unitPrice"] } },
            productsAdded: { $addToSet: "$productRef" },
            entriesCount: { $sum: 1 }
          }
        },
        {
          $project: {
            date: "$_id",
            totalInventory: 1,
            totalValue: { $round: ["$totalValue", 2] },
            uniqueProducts: { $size: "$productsAdded" },
            entriesCount: 1
          }
        },
        { $sort: { date: 1 } }
      ];

      const results = await Inventory.aggregate(pipeline);

      // Calculate period totals
      const periodTotals = results.reduce(
        (acc, item) => ({
          totalInventory: acc.totalInventory + item.totalInventory,
          totalValue: acc.totalValue + item.totalValue,
          totalEntries: acc.totalEntries + item.entriesCount
        }),
        { totalInventory: 0, totalValue: 0, totalEntries: 0 }
      );

      res.status(200).json({
        success: true,
        data: results,
        periodTotals: {
          ...periodTotals,
          totalValue: Math.round(periodTotals.totalValue * 100) / 100
        },
        dateRange: { startDate, endDate, groupBy }
      });

    } catch (error) {
      console.error("Error fetching date range inventory:", error);
      next(error);
    }
  });

module.exports = inventoryRouter;