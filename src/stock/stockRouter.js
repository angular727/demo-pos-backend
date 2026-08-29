
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const stockRouter = express.Router();
const cors = require("../cors");
const Stock = require("./stockModel");
const Product = require("../product/productModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const Transaction = require("../transaction/transactionModel");
const ROLES = require("../shared/rolesConstant");
var moment = require("moment");
const newQueryBuilder = require('../shared/newQueryBuilder')

stockRouter.use(bodyParser.json());

stockRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    let find = queryBuilder(req);
    find ={...find, totalStock: { $gt: 0 }}
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
console.log("find inside get stocks: ", find);
     try {
    console.log("find inside get stocks: ", find);
    Stock.find(find)
    .populate("productRef")
      .then(
        (Stock) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Stock);
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
 .post(cors.corsWithOptions, (req, res, next) => {
  const stockData ={...req.body, user: req.user._id, vendorId: req.user.vendorId}
    Stock.create(stockData)
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
    res.end("PUT operation not supported on /Stock");
  });

  stockRouter
  .route("/low-stock/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .get(cors.corsWithOptions,async (req, res) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    req.stockQuery=true
    // let find = queryBuilder(req)
    const queryBuilder =   new newQueryBuilder(req.query, req)
    .buildStringFilters()
    .buildUniqueIdentifierFilters()
    const find = queryBuilder.build();

    const nestedBuilder =   new newQueryBuilder(req.query, req)
      .buildNestedFilters()
     
    const nestedFind = nestedBuilder.build();
    
    if(!find?.totalStock){
      find.totalStock= { $gt: 0 }
    }
    console.log("low stock query ", find)

    try {
      const stocks = await Stock.aggregate([
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
            convertedTotalStock: { $toDouble: '$totalStock' },
            convertedLimit: { $toDouble: '$productInfo.limit' }
          }
        },
        {
          $match: {
            'productInfo.limit': { $exists: true },
           
            $expr: {
              $lt: ['$convertedTotalStock', '$convertedLimit']
            },
            ...nestedFind
          }
        },
        {
          $project: {
            totalStock: '$convertedTotalStock',
            pricePerPiece: { $toDouble: '$pricePerPiece' },
            productName: '$productInfo.name',
            "productCode": "$productInfo.productId",
            "images": "$productInfo.images",
            "category": "$productInfo.categoryName",
            "caseType": "$productInfo.caseType",
            productLimit: '$convertedLimit',
            stockNo: 1,
            place: 1,
            unit: 1,
            shortageAmount: {
              $subtract: ['$convertedLimit', '$convertedTotalStock']
            },
            percentageOfLimit: {
              $multiply: [
                {
                  $divide: [
                    '$convertedTotalStock',
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
    
      const totalProducts = await Stock.countDocuments(find);
    const totalPages = Math.ceil(totalProducts / pageSize);
      // Return response
      res.status(200).json({
        success: true,
        count: stocks.length,
        data: stocks,
        page,
       
        pageSize,
        totalItems: totalProducts,
        totalPages,
      });
  
    } catch (error) {
      console.error('Error in getLowStocks:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching low stock items',
        error: error.message
      });
    }
    });

  stockRouter
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
        const result = await Stock.findOne(
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


  stockRouter
    .route("/previousstock")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, (req, res, next) => {
      let find = req.query
      if(find.productId || find.productName === 0){
        Stock.find(find) // Filter by productId
          .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
          .limit(2) // Limit the result to the last two entries
          .exec((err, stocks) => {
            if (err) {
              // Handle error
              console.error(err);
              return;
            }
          res.json(stocks);
        // Handle retrieved stocks
        console.log("Last two stocks:", stocks);
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

    stockRouter
    .route("/productsearch")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
        .get(cors.cors, async (req, res, next) => {
            try {
              const { name, productId, barcode } = req.query;

              const matchConditions = {
                totalStock: { $gt: 0 },
              };

              const or = [];

              if (name) {
                or.push({ 'productRef.name': { $regex: name, $options: 'i' } });
              }

              if (productId) {
                or.push({ 'productRef._id': new mongoose.Types.ObjectId(productId) });
              }

              if (barcode) {
                or.push({ 'productRef.barcode': barcode });
              }

              if (or.length > 0) {
                matchConditions.$or = or;
              }
              console.log("matchConditions: ", matchConditions);
              const products = await Stock.aggregate([
                {
                  $lookup: {
                    from: "products",
                    localField: "productRef",
                    foreignField: "_id",
                    as: "productRef",
                  },
                },
                { $unwind: "$productRef" },
                { $match: matchConditions },
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

//export
stockRouter
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
  const totalStock = await Stock.countDocuments(find);
  const totalPages = Math.ceil(totalStock / pageSize);

  const stocks = await Stock.find(find)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  res.json({
    stock: stocks,
    page,
    pageSize,
    totalStock,
    totalPages,
  });
} catch (error) {
 
  res.status(500).json({ error: "Internal Server Error" });
}
   
  });



stockRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, verifyUser, (req, res, next) => {
    Stock.findById(req.params.productId)
    .populate("productRef")
      .then(
        (Stock) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Stock);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /Stock/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {

    Stock.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (Stock) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Stock);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, async(req, res, next) => {
    const deleteStock = await Stock.findById(req.params.productId)
   
    Stock.findByIdAndRemove(req.params.productId)
      .then(
        (resp) => {
          ////////////////////////////emit total 
          let transactionOBJ = {
            reason:"stocReturn",
            reasonId : deleteStock._id,
            amount : 0,
            entityId  : deleteStock.supplierRef,
            entityType  :'Supplier',
            entityName: deleteStock.supplierRef?.name,
            reasonReadableNo : deleteStock.orderNo,
            paymentMethod:deleteStock?.paymentMethod,
            paymentMadeBy:deleteStock?.paymentMadeBy,
            debit: 0,
            credit: deleteStock.totalPrice || 0
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


stockRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    req.stockQuery=true
    // let find =queryBuilder(req);
    const queryBuilder =   new newQueryBuilder(req.query, req)
    .buildStringFilters()
    .buildUniqueIdentifierFilters()
    const find = queryBuilder.build();

    const nestedBuilder =   new newQueryBuilder(req.query, req)
      .buildNestedFilters()
     
    const nestedFind = nestedBuilder.build();
    if(!find?.totalStock){
      find.totalStock= { $gt: 0 }
    }
    console.log("find inside pagination ", find , 'nested ', nestedFind);

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
          pipeline: [
            { $project: { name: 1, productId: 1, categoryName: 1, caseType: 1, images: 1 } } // Fetch only needed fields
          ]
        }
      },
      { $unwind: "$productInfo" },
      {
        $match: 
        nestedFind  // Your existing find conditions
        
      },
      // {
      //   $addFields: {
      //     soldStock: { $subtract: ["$purchasedStock", "$totalStock"] }  // Calculate remaining stock for each object
      //   }
      // },
      {
        $facet: {
          paginatedResults: [
            {
              $set: {
                "productName": "$productInfo.name",
                "productCode": "$productInfo.productId",
                "images": "$productInfo.images",
                "category": "$productInfo.categoryName",
                "caseType": "$productInfo.caseType",
               
              }
            },
            {
              $project: {
                productInfo: 0  // Exclude the productInfo field
              }
            },
            { $sort: { createdAt: order } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize }
          ],
          totalStock: [
            {
              $group: {
                _id: null,
                totalStock: { $sum: "$totalStock" },
                purchasedStock: { $sum: "$purchasedStock" },
                // soldStock: { $sum: { $subtract: ["$purchasedStock", "$totalStock"] } }  // Sum of soldStock
              }
            }
          ]
        }
      }
    ];
    
    
    
    const result = await Stock.aggregate(aggregatePipeline);
    
    const stocks = result[0].paginatedResults;
   
    const footer ={
       totalStock :result[0].totalStock[0] ? result[0].totalStock[0].totalStock : 0,
        purchasedStock :result[0].totalStock[0] ? result[0].totalStock[0].purchasedStock : 0,
      //  soldStock :result[0].totalStock[0] ? result[0].totalStock[0].soldStock : 0
    }
  
    const totalProducts = await Stock.countDocuments(find);
    const totalPages = Math.ceil(totalProducts / pageSize);
    
    res.json({
      data: stocks,
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


module.exports = stockRouter;
