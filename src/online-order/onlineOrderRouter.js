
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const OnlineSaleRouter = express.Router();
const cors = require("../cors");
const OnlineSale = require("./onlineOrder");
const Product = require("../product/productModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const Transaction = require("../transaction/transactionModel");
const ROLES = require("../shared/rolesConstant");
var moment = require("moment");
const newQueryBuilder = require('../shared/newQueryBuilder')
const mongoose = require("mongoose");

OnlineSaleRouter.use(bodyParser.json());

OnlineSaleRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    let find = queryBuilder(req);
 
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
console.log("find inside get OnlineSales: ", find);
     try {
    console.log("find inside get OnlineSales: ", find);
    OnlineSale.find(find)

      .then(
        (OnlineSale) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(OnlineSale);
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
 .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    const onlineSaleData = {...req.body, user: req.user._id, vendorId: req.user.vendorId}
    OnlineSale.create(onlineSaleData)
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
    res.end("PUT operation not supported on /OnlineSale");
  });



  OnlineSaleRouter
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
        if(find.stockRef){
              find['saleDetail.stockRef'] = mongoose.Types.ObjectId(find.stockRef)
              delete find.stockRef
            }
        console.log("find. ", find);
        // Update batch orders based on order numbers
        const result = await OnlineSale.findOne(
          find,
        );
        if(!result){
          return res.status(200).json({ exist: false,data: result });
        }
        else{
          return res.status(200).json({ exist: true, data: result });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });


  OnlineSaleRouter
    .route("/previousOnlineSale")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, (req, res, next) => {
      let find = req.query
      if(find.productId || find.productName === 0){
        OnlineSale.find(find) // Filter by productId
          .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
          .limit(2) // Limit the result to the last two entries
          .exec((err, OnlineSales) => {
            if (err) {
              // Handle error
              console.error(err);
              return;
            }
          res.json(OnlineSales);
        // Handle retrieved OnlineSales
        console.log("Last two OnlineSales:", OnlineSales);
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

    OnlineSaleRouter
    .route("/productsearch")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, async(req, res, next) => {
      let find = req.query
      try {
      const productName = req.query.name;
      const productId = req.query.productId;
      let matchingProducts;
      // Find products that match the regular expression
      if(productName){
        matchingProducts = await Product.find({ name: { $regex: productName, $options: 'i' } });
      }else{
        matchingProducts = await Product.find({ productId: productId  });
      }
      // Extract product IDs
      const productIds = matchingProducts.map(product => product._id);

      // Search for OnlineSales based on matching product IDs
      const OnlineSales = await OnlineSale.find({ productRef: { $in: productIds }, totalOnlineSale: { $gt: 0 } }).populate('productRef');

      res.json(OnlineSales);
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
OnlineSaleRouter
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
  const totalOnlineSale = await OnlineSale.countDocuments(find);
  const totalPages = Math.ceil(totalOnlineSale / pageSize);

  const OnlineSales = await OnlineSale.find(find)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  res.json({
    OnlineSale: OnlineSales,
    page,
    pageSize,
    totalOnlineSale,
    totalPages,
  });
} catch (error) {
 
  res.status(500).json({ error: "Internal Server Error" });
}
   
  });



OnlineSaleRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, verifyUser, (req, res, next) => {
    OnlineSale.findById(req.params.productId)

    .populate({
      path: 'customerRef'
    })
    .populate({
      path: 'saleDetail.productRef'
    })
    
      .then(
        (OnlineSale) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(OnlineSale);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /OnlineSale/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {

    OnlineSale.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (OnlineSale) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(OnlineSale);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, async(req, res, next) => {

    OnlineSale.findByIdAndRemove(req.params.productId)
      .then(
        (resp) => {
  
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(resp);
         })
      .catch((err) => next(err));

  });


OnlineSaleRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, verifyUser, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;

  
    // let find =queryBuilder(req);
    // find ={...find}
    const queryBuilder =   new newQueryBuilder(req.query, req)
    .buildStringFilters()
    .buildUniqueIdentifierFilters()
    const find = queryBuilder.build();

    const nestedBuilder =   new newQueryBuilder(req.query, req)
      .buildNestedFilters()
     
    const nestedFind = nestedBuilder.build();
   console.log("find inside get: paginate onlineorder", find, "nestedFind ", nestedFind);
      
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    try {

      // const debugPipeline = [
      //   { $match: { user: ObjectId(find.user) } },
      //   // Add this to see what customerRef values exist
      //   { $project: { customerRef: 1 } }
      // ];
      // const debugResults = await OnlineSale.aggregate(debugPipeline);
      // console.log('Debug results:', debugResults);
      const aggregatePipeline = [
        { $match: find },
        {
          $lookup: {
            from: "customers",
            localField: "customerRef",  // Use directly since it's already ObjectId
            foreignField: "_id",
            as: "customerInfo"
          }
        },
        { $unwind: "$customerInfo" },
        { $match: nestedFind },
        {
          $addFields: {
            "customerName": "$customerInfo.name",
          }
        },
        {
          $project: {
            customerInfo: 0
          }
        },
        { $sort: { createdAt: order} },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize }
      ];

    const onlineSale = await OnlineSale.aggregate(aggregatePipeline);
      const totalProducts = await OnlineSale.countDocuments(find);
      const totalPages = Math.ceil(totalProducts / pageSize);
       
      res.json({
        data: onlineSale,
        page,
        pageSize,
        totalItems: totalProducts,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

  //for multiple OnlineSale some together before send to the client with pagination
  /*
  const aggregateQuery = [
    {
      $match: {
        $and: [
          { totalOnlineSale: { $gt: 0 } }, // Quantity greater than 0
          find // Additional conditions if any
        ]
      }
    },
    {
      $group: {
        _id: "$productId",
        totalQuantity: { $sum: "$totalOnlineSale" },
        count: { $sum: 1 } // Count the number of documents for each productId
      }
    },
    {
      $addFields: {
        multipleOnlineSale: { $gt: ["$count", 1] } // Flag indicating multiple OnlineSale
      }
    },
    {
      $sort: { totalQuantity: -1 } // Sort by totalQuantity in descending order
    },
    {
      $skip: (page - 1) * pageSize // Pagination - skip documents
    },
    {
      $limit: pageSize // Limit number of documents returned
    }
  ];
  
  const OnlineSales = await OnlineSale.aggregate(aggregateQuery);
  
  res.json({
    OnlineSale: OnlineSales,
    page,
    pageSize,
    totalOnlineSale: OnlineSales.length, // Using the length of the aggregated results
    totalPages: Math.ceil(OnlineSales.length / pageSize) // Adjust totalPages accordingly
  });
  */

module.exports = OnlineSaleRouter;
