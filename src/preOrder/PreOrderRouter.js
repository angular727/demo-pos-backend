
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const PreOrderRouter = express.Router();
const cors = require("../cors");
const PreOrder = require("./preOrderModel");
const Stock = require("../stock/stockModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const Customer = require("../customer/customerModel");
const Transaction = require("../transaction/transactionModel");
const ROLES = require("../shared/rolesConstant");
let {createSaleTransaction} = require('../transaction/transactionCommon');
var moment = require("moment");

PreOrderRouter.use(bodyParser.json());

PreOrderRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    let find = queryBuilder(req);
    
     try {
    console.log("find inside get stocks: ", find);
    PreOrder.find(find)
    .populate("customerRef")
      .then(
        (PreOrder) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(PreOrder);
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
 .post(cors.corsWithOptions, verifyUser, async (req, res, next) => {
  const preOrderData = {...req.body, user: req.user._id, vendorId: req.user.vendorId}
  PreOrder.create(preOrderData)
  .then(
    (data) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.json(data);
    }
  ,(err) => next(err)
  )
  .catch((err) => next(err));
})


  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /PreOrder");
  });






  PreOrderRouter
    .route("/previousstock")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, (req, res, next) => {
      let find = req.query
      if(find.productId || find.productName === 0){
        PreOrder.find(find) // Filter by productId
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



//export
PreOrderRouter
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
  const totalSale = await PreOrder.countDocuments(find);
  const totalPages = Math.ceil(totalSale / pageSize);

  const stocks = await PreOrder.find(find)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  res.json({
    PreOrder: stocks,
    page,
    pageSize,
    totalSale,
    totalPages,
  });
} catch (error) {
 
  res.status(500).json({ error: "Internal Server Error" });
}
   
  });



PreOrderRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, verifyUser, (req, res, next) => {
    PreOrder.findById(req.params.productId)
 
      .then(
        (PreOrder) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(PreOrder);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /PreOrder/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {

    PreOrder.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (PreOrder) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(PreOrder);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, (req, res, next) => {
    PreOrder.findByIdAndRemove(req.params.productId)
      .then(
        (resp) => {
          ////////////////////////////emit total 

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(resp);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  });


PreOrderRouter
  .route("/:pagesize/:page")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let find = queryBuilder(req);
    
    
    try {
      const totalSale = await PreOrder.countDocuments(find);
      const totalPages = Math.ceil(totalSale / pageSize);
      console.log("find inside get: paginate stocks", find);
      const stocks = await PreOrder.find(find)
     
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      res.json({
        PreOrder: stocks,
        page,
        pageSize,
        totalSale,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

  //for multiple PreOrder some together before send to the client with pagination
  /*
  const aggregateQuery = [
    {
      $match: {
        $and: [
          { quantity: { $gt: 0 } }, // Quantity greater than 0
          find // Additional conditions if any
        ]
      }
    },
    {
      $group: {
        _id: "$productId",
        totalQuantity: { $sum: "$quantity" },
        count: { $sum: 1 } // Count the number of documents for each productId
      }
    },
    {
      $addFields: {
        multipleStock: { $gt: ["$count", 1] } // Flag indicating multiple PreOrder
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
  
  const stocks = await PreOrder.aggregate(aggregateQuery);
  
  res.json({
    PreOrder: stocks,
    page,
    pageSize,
    totalSale: stocks.length, // Using the length of the aggregated results
    totalPages: Math.ceil(stocks.length / pageSize) // Adjust totalPages accordingly
  });
  */

module.exports = PreOrderRouter;
