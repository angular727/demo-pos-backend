
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const invetoryRouter = express.Router();
const cors = require("../cors");
const Inventory = require("./inventoryModel");
const Product = require("../product/productModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const Transaction = require("../transaction/transactionModel");
const ROLES = require("../shared/rolesConstant");
var moment = require("moment");
const {stockOverview} = require('./inventoryAnalytics');
const newQueryBuilder = require('../shared/newQueryBuilder')

invetoryRouter.use(bodyParser.json());

invetoryRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    let find = queryBuilder(req);
    console.log("find before get Inventorys: ", find);
    find ={...find, totalInventory: { $gt: 0 }}
    // if(req.query.productId){
    //   find = {
    //     productId: {
    //         $regex: req.query.productId,
    //         $options: 'i' // case-insensitive
    //     }
      
    // };
    // delete req.query.productId
    // }
    // if(req.query.productName){
    //   find = {
    //     productName: {
    //         $regex: req.query.productName,
    //         $options: 'i' // case-insensitive
    //     }
      
    // };
    // delete req.query.productName
    // }
    find = {...find,...req.query}
console.log("find inside get Inventorys: ", find);
     try {
    console.log("find inside get Inventorys: ", find);
    Inventory.find(find)
    .populate("productRef")
      .then(
        (Inventory) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Inventory);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
    }
    catch(err){
        res.json(err);
    }
  })
 //post call for to create
 .post(cors.corsWithOptions,verifyUser, (req, res, next) => {

  if(!req.body?.productRef?._id || !req.body.totalInventory>0){

    next(new Error('Payload is not valid'));    
    return 
  }
  batchNumber = generateBatchNumber();
  req.body.batchNumber = batchNumber
  req.body.user = req.user._id;
  req.body.vendorId = req.user.vendorId;
    Inventory.create(req.body)
      .then(
        (data) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(data);
        },
        (err) => {
        
            next(err);            

        }
      )
      .catch((err) => next(err));
  })

  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /Inventory");
  });

  invetoryRouter
  .route("/low-Inventory/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .get(cors.corsWithOptions,async (req, res) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    req.InventoryQuery=true
    // let find = queryBuilder(req)
    const queryBuilder =   new newQueryBuilder(req.query, req)
    .buildStringFilters()
    .buildUniqueIdentifierFilters()
    const find = queryBuilder.build();

    const nestedBuilder =   new newQueryBuilder(req.query, req)
      .buildNestedFilters()
     
    const nestedFind = nestedBuilder.build();
    
    if(!find?.totalInventory){
      find.totalInventory= { $gt: 0 }
    }
    console.log("low Inventory query ", find)

    try {
      const Inventorys = await Inventory.aggregate([
        { $match: find },
        {
          $lookup: {
            from: 'products',
            localField: 'productRef',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        {
          $addFields: {
            convertedTotalInventory: { $toDouble: '$totalInventory' },
            convertedLimit: { $toDouble: '$productInfo.limit' }
          }
        },
        {
          $match: {
            'productInfo.limit': { $exists: true },
           
            $expr: {
              $lt: ['$convertedTotalInventory', '$convertedLimit']
            },
            ...nestedFind
          }
        },
        {
          $project: {
            totalInventory: '$convertedTotalInventory',
            unitPrice: { $toDouble: '$unitPrice' },
            productName: '$productInfo.name',
            "productCode": "$productInfo.productId",
            "images": "$productInfo.images",
            "category": "$productInfo.categoryName",
            "caseType": "$productInfo.caseType",
            productLimit: '$convertedLimit',
            InventoryNo: 1,
            place: 1,
            unit: 1,
            shortageAmount: {
              $subtract: ['$convertedLimit', '$convertedTotalInventory']
            },
            percentageOfLimit: {
              $multiply: [
                {
                  $divide: [
                    '$convertedTotalInventory',
                    '$convertedLimit'
                  ]
                },
                100
              ]
            }
          }
        },
        { $sort: { createdAt: order } },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize }
      ]);
    
      const totalProducts = await Inventory.countDocuments(find);
    const totalPages = Math.ceil(totalProducts / pageSize);
      // Return response
      res.status(200).json({
        success: true,
        count: Inventorys.length,
        data: Inventorys,
        page,
       
        pageSize,
        totalItems: totalProducts,
        totalPages,
      });
  
    } catch (error) {
      console.error('Error in getLowInventorys:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching low Inventory items',
        error: error.message
      });
    }
    });

  invetoryRouter
  .route("/exist")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .get(cors.corsWithOptions,async (req, res) => {

    
      try {
        
    
        const queryBuilder =   new newQueryBuilder(req.query, req)
        .buildStringFilters()
        .buildUniqueIdentifierFilters()
        const find = queryBuilder.build();
        console.log("find. ", find);
        // Update batch orders based on order numbers
        const result = await Inventory.findOne(
          find,
        );
        if(!result){
          return res.status(200).json({ exist: false});
        }else{
          return res.status(200).json({exist:true});
        }
       
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });


  invetoryRouter
    .route("/previousInventory")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, (req, res, next) => {
      let find = req.query
      if(find.productId || find.productName === 0){
        Inventory.find(find) // Filter by productId
          .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
          .limit(2) // Limit the result to the last two entries
          .exec((err, Inventorys) => {
            if (err) {
              // Handle error
              console.error(err);
              return;
            }
          res.json(Inventorys);
        // Handle retrieved Inventorys
        console.log("Last two Inventorys:", Inventorys);
      });
    }else{
      res.json({message: "Please provide a product id or product name"})
    }
    })
    .post(cors.corsWithOptions, (req, res, next) => {
      res.statusCode = 403;
      res.end(
        "POST operation not supported on /Product/" + req.params.productId
      );
    })

    invetoryRouter
    .route("/productsearch/:pagesize?")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
 .get(cors.cors, async (req, res, next) => {
        try {
          const productName = req.query.name || '';
          const id = req.query.id;
          const productId = req.query.productId || '';
           const barcode = req.query.barcode || '';
          const mongoose = require('mongoose');
          const pageSize = parseInt(req.params.pagesize) || 10;

          let matchStage = {
            totalInventory: { $gt: 0 },
          };

          if (productName) {
            matchStage['productRef.name'] = { $regex: productName, $options: 'i' };
          } else if (id && mongoose.Types.ObjectId.isValid(id)) {
            matchStage['productRef._id'] = new mongoose.Types.ObjectId(id);
          }else if (productId) {
            matchStage['productId'] = parseInt(productId);
          }else if (barcode) {
            matchStage['productRef.barcode'] = barcode;
          }
          // else if (req.query.sku) {
          //   matchStage['productRef.sku'] = req.query.sku;
          // }
            console.log("search inventory by profuct:**** ", matchStage);
          const products = await Inventory.aggregate([
            {
              $lookup: {
                from: 'products',
                localField: 'productRef',
                foreignField: '_id',
                as: 'productRef',
              },
            },
            { $unwind: '$productRef' },
            { $match: matchStage },
            { $limit: pageSize },
          ]);

          res.json(products);
        } catch (err) {
          res.status(500).json({ message: err.message });
        }
      })



    .post(cors.corsWithOptions, (req, res, next) => {
      res.statusCode = 403;
      res.end(
        "POST operation not supported on /Product/" + req.params.productId
      );
    })


invetoryRouter
  .route('/stock-report/:pagesize/:page/:ordering?')
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let order = 1;
    if (req.params.ordering === 'desc') order = -1;

    const queryBuilder = new newQueryBuilder(req.query, req)
      .buildStringFilters()
      .buildUniqueIdentifierFilters();
    const find = queryBuilder.build();

    // if (!find?.totalInventory) {
    //   find.totalInventory = { $gt: 0 };
    // }

    try {
      const aggregatePipeline = [
        { $match: find }, // Apply filters (e.g., by productName, etc.)
        {
          $group: {
            _id: '$productRef', // Group by productRef
            productId: { $first: '$productId' },
            productName: { $first: '$productName' },
            totalInventory: { $sum: '$totalInventory' }, // Sum available stock
            purchasedInventory: { $sum: '$totalUnits' }, // Sum purchased
            soldInventory: { $sum: { $subtract: ['$totalUnits', '$totalInventory'] } }, // Calculated sold
            averageUnitPrice: { $avg: '$unitPrice' }, // Average price for evaluation
            expiryDates: { $addToSet: '$expiryDate' }, // Unique expiry dates for the product
            totalPurchasePrice: { $sum: { $multiply: ['$totalUnits', '$unitPrice'] } }, // Add this
          
            createdAt: { $max: '$createdAt' } // Latest entry for sorting
          }
        },
        {
          $facet: {
            paginatedResults: [
              { $sort: { createdAt: order } }, // Sort by latest
              { $skip: (page - 1) * pageSize },
              { $limit: pageSize }
            ],
            totals: [
              {
                $group: {
                  _id: null,
                  grandTotalInventory: { $sum: '$totalInventory' },
                  grandPurchasedInventory: { $sum: '$purchasedInventory' },
                  grandSoldInventory: { $sum: '$soldInventory' },
                  grandPurchasePrice: { $sum: '$totalPurchasePrice' } // Add this
                }
              }
            ]
          }
        }
      ];

      const result = await Inventory.aggregate(aggregatePipeline);
      const reportData = result[0].paginatedResults;
      const totals = result[0].totals[0] || {
        grandTotalInventory: 0,
        grandPurchasedInventory: 0,
        grandSoldInventory: 0,
        grandPurchasePrice: 0 // Add this
      };

      // Count unique products for pagination
      const totalUniqueProducts = (await Inventory.aggregate([
        { $match: find },
        { $group: { _id: '$productRef' } },
        { $count: 'total' }
      ]))[0]?.total || 0;

      const totalPages = Math.ceil(totalUniqueProducts / pageSize);

      res.json({
        data: reportData,
        page,
        pageSize,
        totalItems: totalUniqueProducts,
        totalPages,
        totals // For overall stock evaluation
      });
    } catch (error) {
      console.error('Error generating stock report:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

//export
invetoryRouter
  .route("/export/:pagesize?/:page?")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .post(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
  
    let find = queryBuilderWithBody(req)
    console.log("find. ", find);
try {
  const totalInventory = await Inventory.countDocuments(find);
  const totalPages = Math.ceil(totalInventory / pageSize);

  const Inventorys = await Inventory.find(find)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  res.json({
    Inventory: Inventorys,
    page,
    pageSize,
    totalInventory,
    totalPages,
  });
} catch (error) {
 
  res.status(500).json({ error: "Internal Server Error" });
}
   
  });

  invetoryRouter
  .route("/aggrigate/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let order = 1;
    if (req.params.ordering == "desc") order = -1;
    req.InventoryQuery = true;

    const queryBuilder = new newQueryBuilder(req.query, req)
      .buildStringFilters()
      .buildUniqueIdentifierFilters();
    const find = queryBuilder.build();

    if (!find?.totalInventory) {
      find.totalInventory = { $gt: 0 };
    }
    console.log("find inside pagination ", find);

    try {
      const aggregatePipeline = [
        {
          $match: find // Apply existing query filters
        },
        {
          $group: {
            _id: "$productRef", // Group by productRef
            totalInventory: { $sum: "$totalInventory" }, // Sum totalInventory for each productRef
            purchasedInventory: { $sum: "$purchasedInventory" }, // Sum purchasedInventory
            productName: { $first: "$productName" }, // Retain first productName (optional)
            productId: { $first: "$productId" }, // Retain first productId (optional)
            batchNumber: { $first: "$batchNumber" }, // Retain first batchNumber (optional)
            saleDiscount: { $first: "$saleDiscount" }, // Retain first saleDiscount (optional)
            createdAt: { $first: "$createdAt" }, // Retain first createdAt for sorting
            barcode: { $first: "$barcode" },
            stockBarCode: { $first: "$stockBarCode" },
            // Add other fields you want to retain using $first or $last
          }
        },
        {
          $facet: {
            paginatedResults: [
              { $sort: { createdAt: order } }, // Sort by createdAt
              { $skip: (page - 1) * pageSize }, // Pagination: skip
              { $limit: pageSize } // Pagination: limit
            ],
            totalInventory: [
              {
                $group: {
                  _id: null,
                  totalInventory: { $sum: "$totalInventory" }, // Total inventory across all groups
                  purchasedInventory: { $sum: "$purchasedInventory" } // Total purchased inventory
                }
              }
            ]
          }
        }
      ];

      const result = await Inventory.aggregate(aggregatePipeline);

      const inventorys = result[0].paginatedResults;
      const footer = {
        totalInventory: result[0].totalInventory[0]?.totalInventory || 0,
        purchasedInventory: result[0].totalInventory[0]?.purchasedInventory || 0
      };

      // Count total unique productRefs matching the query
      const totalProducts = (await Inventory.aggregate([
        { $match: find },
        { $group: { _id: "$productRef" } },
        { $count: "total" }
      ]))[0]?.total || 0;

      const totalPages = Math.ceil(totalProducts / pageSize);

      res.json({
        data: inventorys,
        page,
        footer,
        pageSize,
        totalItems: totalProducts,
        totalPages
      });
    } catch (error) {
      console.log("error: ", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

invetoryRouter
  .route("/web/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    req.InventoryQuery=true

console.log("req.query, ",req.query)    // let find =queryBuilder(req);
    const queryBuilder =   new newQueryBuilder(req.query, req)
    .buildStringFilters()
    .buildUniqueIdentifierFilters()
    const find = queryBuilder.build();

    const nestedBuilder =   new newQueryBuilder(req.query, req)
      .buildNestedFilters()
     
    const nestedFind = nestedBuilder.build();
    if(!find?.totalInventory){
      find.totalInventory= { $gt: 0 }
    }
    console.log("nestedFind inside pagination nestedFind ", nestedFind );

    try{
    //********** */ new pagination ************
    const aggregatePipeline = [
      {
        $match: 
          find  // Your existing find conditions
        
      },
      {
        $lookup: {
          from: "products",
          localField: "productRef",
          foreignField: "_id",
          as: "productInfo",
          // pipeline: [
          //   { $project: { name: 1, productId: 1, categoryName: 1, caseType: 1, images: 1 } } // Fetch only needed fields
          // ]
        }
      },
      { $unwind: "$productInfo" },
      {
        $match: 
        nestedFind  // Your existing find conditions
        
      },
      // {
      //   $addFields: {
      //     soldInventory: { $subtract: ["$purchasedInventory", "$totalInventory"] }  // Calculate remaining Inventory for each object
      //   }
      // },
      {
        $facet: {
          paginatedResults: [
         
            { $sort: { createdAt: order } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize }
          ],
          totalInventory: [
            {
              $group: {
                _id: null,
                totalInventory: { $sum: "$totalInventory" },
                purchasedInventory: { $sum: "$purchasedInventory" },
             
              }
            }
          ]
        }
      }
    ];
    
    
    
    const result = await Inventory.aggregate(aggregatePipeline);
    
    const Inventorys = result[0].paginatedResults;
   
    const footer ={
       totalInventory :result[0].totalInventory[0] ? result[0].totalInventory[0].totalInventory : 0,
        purchasedInventory :result[0].totalInventory[0] ? result[0].totalInventory[0].purchasedInventory : 0,
      //  soldInventory :result[0].totalInventory[0] ? result[0].totalInventory[0].soldInventory : 0
    }
  
    const totalProducts = await Inventory.countDocuments(find);
    const totalPages = Math.ceil(totalProducts / pageSize);
    
    res.json({
      data: Inventorys,
      page,
      footer,
      pageSize,
      totalItems: totalProducts,
      totalPages,
    });
  } catch (error) {
   console.log("error: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }


  });


invetoryRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, verifyUser, (req, res, next) => {
    Inventory.findById(req.params.productId)
    .populate("productRef")
      .then(
        (Inventory) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Inventory);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /Inventory/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions,verifyUser, (req, res, next) => {
            console.log(" req.body: ",  req.body,   req.params.productId,);
    req.body.editBy = req.user._id;
    Inventory.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (Inventory) => {
          ////////////////////////////emit total 

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Inventory);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, async(req, res, next) => {
    const deleteInventory = await Inventory.findById(req.params.productId)
   
    Inventory.findByIdAndRemove(req.params.productId)
      .then(
        (resp) => {
          ////////////////////////////emit total 
          let transactionOBJ = {
            reason:"stocReturn",
            reasonId : deleteInventory._id,
            amount : 0,
            entityId  : deleteInventory.supplierRef,
            entityType  :'Supplier',
            entityName: deleteInventory.supplierRef?.name,
            reasonReadableNo : deleteInventory.orderNo,
            paymentMethod:deleteInventory?.paymentMethod,
            transactionDate: deleteInventory.transactionDate || new Date().toISOString().split('T')[0],
            paymentMadeBy:deleteInventory?.paymentMadeBy,
            debit: 0,
            credit: deleteInventory.totalPrice || 0
          }
         Transaction.create(transactionOBJ)
         .then((data) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(resp);
         })
         .catch((err) => next(err));
         
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  });


/**
 * Unified Inventory Stock Overview API
 * 
 * Route: GET /api/inventory/stock-overview/:pagesize/:page/:ordering?
 * 
 * All analytics are determined by query parameters:
 * 
 * QUERY PARAMETER COMBINATIONS:
 * 
 * 1. DASHBOARD OVERVIEW
 *    ?type=overview
 *    ?overview=true
 * 
 * 2. CATEGORY ANALYTICS
 *    ?type=category
 *    ?groupBy=category
 * 
 * 3. EXPIRY ANALYTICS
 *    ?type=expiry
 *    ?expiryAnalysis=true
 *    Optional: &daysAhead=90
 * 
 * 4. LOCATION ANALYTICS
 *    ?type=location
 *    ?groupBy=location
 * 
 * 5. TRENDS ANALYTICS
 *    ?type=trends
 *    ?trends=true
 *    Optional: &period=monthly (daily|weekly|monthly|yearly)
 *    Optional: &trendLimit=12
 * 
 * 6. SEARCH
 *    ?type=search&q=searchterm
 *    ?q=searchterm
 *    Optional: &searchType=all (all|product|batch|category)
 * 
 * 7. SINGLE PRODUCT ANALYTICS
 *    ?productRef=ObjectId
 *    ?singleProduct=true&productId=123
 * 
 * 8. DEFAULT - MAIN INVENTORY ANALYTICS (no type specified)
 *    Supports all filters:
 *    - stockStatus: active|zero|low|all
 *    - productName, productId, productRef
 *    - category, categoryRef, subcategory, brand
 *    - batchNumber
 *    - minStock, maxStock
 *    - minPrice, maxPrice
 *    - startDate, endDate
 *    - expiryStartDate, expiryEndDate
 *    - place, placeNo
 *    - sortBy, groupByProduct
 *    - includeExpired, purchaseReturn
 */

invetoryRouter
    .route("/stock-overview/:pagesize/:page/:ordering?")
    .options(cors.corsWithOptions, async (req, res) => {
        res.sendStatus(200);
    })
    .get(cors.corsWithOptions, stockOverview);

// Add this route to your inventory router

invetoryRouter
  .route("/stock-status/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let order = req.params.ordering === "desc" ? -1 : 1;

    // Query parameters for stock filtering
    // ?stockStatus=zero | low | available | all
    // ?threshold=10 (for low stock, default 10)
    // ?exactStock=5 (for exact stock match)
    // ?minStock=5&maxStock=20 (for range)
    
    const { 
      stockStatus = "zero", 
      threshold = 10, 
      exactStock, 
      minStock, 
      maxStock 
    } = req.query;
console.log("req.query: ", req.query);
    try {
      // Build the stock filter condition
      let stockMatchCondition;

      if (exactStock !== undefined) {
        stockMatchCondition = { $eq: ["$groupedTotalInventory", parseInt(exactStock)] };
      } else if (minStock !== undefined && maxStock !== undefined) {
        stockMatchCondition = {
          $and: [
            { $gte: ["$groupedTotalInventory", parseInt(minStock)] },
            { $lte: ["$groupedTotalInventory", parseInt(maxStock)] }
          ]
        };
      } else {
        switch (stockStatus) {
          case "zero":
            stockMatchCondition = { $eq: ["$groupedTotalInventory", 0] };
            break;
          case "low":
            stockMatchCondition = {
              $and: [
                { $gt: ["$groupedTotalInventory", 0] },
                { $lte: ["$groupedTotalInventory", parseInt(threshold)] }
              ]
            };
            break;
          case "available":
            stockMatchCondition = { $gt: ["$groupedTotalInventory", 0] };
            break;
          case "out":
            stockMatchCondition = { $lte: ["$groupedTotalInventory", 0] };
            break;
          default: // "all"
            stockMatchCondition = true;
        }
      }

        console.log("stockMatchCondition: ", stockMatchCondition);
      const aggregatePipeline = [
        // Group inventory by productRef first
        {
          $group: {
            _id: "$productRef",
            groupedTotalInventory: { $sum: "$totalInventory" },
            groupedTotalUnits: { $sum: "$totalUnits" },
            groupedExtraUnit: { $sum: "$extraUnit" },
            batchCount: { $sum: 1 },
            batches: {
              $push: {
                _id: "$_id",
                batchNumber: "$batchNumber",
                totalInventory: "$totalInventory",
                totalUnits: "$totalUnits",
                extraUnit: "$extraUnit",
                unitPrice: "$unitPrice",
                salePrice: "$salePrice",
                wholeSalePrice: "$wholeSalePrice",
                expiryDate: "$expiryDate",
                placeNo: "$placeNo",
                place: "$place",
                createdAt: "$createdAt"
              }
            },
            lastUpdated: { $max: "$updatedAt" },
            // Keep first values for reference
            barcode: { $first: "$barcode" },
            productName: { $first: "$productName" },
            ProductsNameurdu: { $first: "$ProductsNameurdu" }
          }
        },
        // Filter based on grouped total inventory
        {
          $match: {
            $expr: stockMatchCondition
          }
        },
        // Lookup product details
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
            pipeline: [
              {
                $project: {
                  name: 1,
                  productId: 1,
                  categoryName: 1,
                  caseType: 1,
                  images: 1,
                  ProductsNameurdu: 1,
                  expiryDate: 1,
                  barcode: 1,
                  description: 1
                }
              }
            ]
          }
        },
        {
          $unwind: {
            path: "$product",
            preserveNullAndEmptyArrays: true
          }
        },
        // Reshape the output
        {
          $project: {
            productRef: "$_id",
            product: 1,
            productName: 1,
            ProductsNameurdu: 1,
            barcode: 1,
            totalInventory: "$groupedTotalInventory",
            totalUnits: "$groupedTotalUnits",
            extraUnit: "$groupedExtraUnit",
            batchCount: 1,
            batches: 1,
            lastUpdated: 1
          }
        },
        // Facet for pagination and summary
        {
          $facet: {
            paginatedResults: [
              { $sort: { totalInventory: order, "product.name": 1 } },
              { $skip: (page - 1) * pageSize },
              { $limit: pageSize }
            ],
            summary: [
              {
                $group: {
                  _id: null,
                  totalProducts: { $sum: 1 },
                  totalInventorySum: { $sum: "$totalInventory" },
                  totalUnitsSum: { $sum: "$totalUnits" }
                }
              }
            ]
          }
        }
      ];

      const result = await Inventory.aggregate(aggregatePipeline);

      const products = result[0].paginatedResults;
      const summary = result[0].summary[0] || {
        totalProducts: 0,
        totalInventorySum: 0,
        totalUnitsSum: 0
      };

      const totalPages = Math.ceil(summary.totalProducts / pageSize);

      res.json({
        success: true,
        data: products,
        page,
        pageSize,
        totalItems: summary.totalProducts,
        totalPages,
        filter: {
          stockStatus,
          threshold: stockStatus === "low" ? parseInt(threshold) : undefined,
          exactStock: exactStock ? parseInt(exactStock) : undefined,
          minStock: minStock ? parseInt(minStock) : undefined,
          maxStock: maxStock ? parseInt(maxStock) : undefined
        },
        summary: {
          totalInventory: summary.totalInventorySum,
          totalUnits: summary.totalUnitsSum
        }
      });

    } catch (error) {
      console.error("Stock status error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Internal Server Error",
        message: error.message 
      });
    }
  });

invetoryRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    req.InventoryQuery=true
    // let find =queryBuilder(req);
    const queryBuilder =   new newQueryBuilder(req.query, req)
    .buildStringFilters()
    .buildUniqueIdentifierFilters()
    const find = queryBuilder.build();

    // const nestedBuilder =   new newQueryBuilder(req.quebuildUniqueIdentifierFiltersry, req)
    //   .buildNestedFilters()
     console.log("find inside req.query  ", req.query );
    // const nestedFind = nestedBuilder.build();
     if(find?.totalInventory == 0){
      find.totalInventory= { $eq: 0 }
     }else if(!find?.totalInventory ){
      find.totalInventory= { $gt: 0 }
    }else if(find?.totalInventory>1){
        find.totalInventory= { $gte: find.totalInventory }
    }else{
       delete find.totalInventory
    }
    console.log("find inside pagination ", find );

    try{
    //********** */ new pagination ************
    const aggregatePipeline = [
      {
        $match: 
          find  // Your existing find conditions
        
      },
      {
        $lookup: {
          from: "products",
          localField: "productRef",
          foreignField: "_id",
          as: "productRef",
          pipeline: [
            { $project: { name: 1, productId: 1, 
              categoryName: 1, caseType: 1, images: 1,ProductsNameurdu:1,expiryDate:1,barcode:1, description:1} } // Fetch only needed fields
          ]
        }
      },
      // { $unwind: "$productInfo" },
      // {
      //   $match: 
      //   nestedFind  // Your existing find conditions
        
      // },
      // {
      //   $addFields: {
      //     soldInventory: { $subtract: ["$purchasedInventory", "$totalInventory"] }  // Calculate remaining Inventory for each object
      //   }
      // },
      {
        $facet: {
          paginatedResults: [
            // {
            //   $set: {
            //     "productName": "$productInfo.name",
            //     "productCode": "$productInfo.productId",
            //     "images": "$productInfo.images",
            //     "category": "$productInfo.categoryName",
            //     "caseType": "$productInfo.caseType",
               
            //   }
            // },
            // {
            //   $project: {
            //     productInfo: 0  // Exclude the productInfo field
            //   }
            // },
            { $sort: { createdAt: order } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize }
          ],
          totalInventory: [
            {
              $group: {
                _id: null,
                
                totalInventory: { $sum: "$totalInventory" },
                purchasedInventory: { $sum: "$purchasedInventory" },
                // soldInventory: { $sum: { $subtract: ["$purchasedInventory", "$totalInventory"] } }  // Sum of soldInventory
              }
            }
          ]
        }
      }
    ];
    
    
    
    const result = await Inventory.aggregate(aggregatePipeline);
    
    const Inventorys = result[0].paginatedResults;
   
    const footer ={
       totalInventory :result[0].totalInventory[0] ? result[0].totalInventory[0].totalInventory : 0,
        purchasedInventory :result[0].totalInventory[0] ? result[0].totalInventory[0].purchasedInventory : 0,
      //  soldInventory :result[0].totalInventory[0] ? result[0].totalInventory[0].soldInventory : 0
    }
  
    const totalProducts = await Inventory.countDocuments(find);
    const totalPages = Math.ceil(totalProducts / pageSize);
    
    res.json({
      data: Inventorys,
      page,
      footer,
      pageSize,
      totalItems: totalProducts,
      totalPages,
    });
  } catch (error) {
   console.log("error: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }


  });

  const generateBatchNumber = () => {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    // Use more characters from timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36).toUpperCase();
    // Add a random suffix for extra uniqueness
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SUP1-${dateStr}-${timestamp}${random}`;
};
module.exports = invetoryRouter;
