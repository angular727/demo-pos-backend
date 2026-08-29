
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const purchaseRecordRouter = express.Router();
const cors = require("../cors");
const Purchase = require("./purchaseRecordModel");
const Transaction = require("../transaction/transactionModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");

const ROLES = require("../shared/rolesConstant");
var moment = require("moment");

purchaseRecordRouter.use(bodyParser.json());

purchaseRecordRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
  let find = queryBuilder(req);
   
     try {
    console.log("find inside get Purchase: ", find);
    Purchase.find(find)

      .then(
        (Purchase) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Purchase);
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
  const purchaseData ={...req.body, user: req.user._id, vendorId: req.user.vendorId}
  Purchase.create(purchaseData)
  .then(
    (Purchase) => {
    
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Purchase);
        },
        (err) => {
        
            next(err);            
  
        }
      )
      .catch((err) => next(err));
    
 

  
 })

  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /Purchase");
  });



  purchaseRecordRouter
  .route("/returnrecent")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .put(cors.corsWithOptions, verifyUser,async (req, res) => {

    
      try {
        const orderNumbers = req.body.orderNumbers;
        const updateData = { status: "upload", recent: true, technician: [] };
    
        // Update batch orders based on order numbers
        const result = await Purchase.updateMany(
          { order: { $in: orderNumbers } },
          { $set: updateData }
        );

        res.json({ updatedCount: result.nModified });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });






//export
purchaseRecordRouter
  .route("/export/:pagesize?/:page?")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .post(cors.corsWithOptions, verifyUser, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
  
    let find = queryBuilderWithBody(req)
    console.log("find. ", find);
try {
  const totalComplaints = await Purchase.countDocuments(find);
  const totalPages = Math.ceil(totalComplaints / pageSize);

  const complaints = await Purchase.find(find).populate({
    path: "technician",
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  res.json({
    complaints: complaints,
    page,
    pageSize,
    totalComplaints,
    totalPages,
  });
} catch (error) {
 
  res.status(500).json({ error: "Internal Server Error" });
}
   
  });



purchaseRecordRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res, next) => {
    try {
    const Purchase = await Purchase.findById(req.params.productId);
    if (!Purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    

    res.json(
      Purchase,
      // balance: balance[0].balance,
    );
  } catch (error) {
    res.status(500).json({ message: 'Error fetching Purchase balance' });
  }

  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /Purchase/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {
    // Generate the current date and time


    Purchase.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (Purchase) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Purchase);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, (req, res, next) => {
    Purchase.findByIdAndRemove(req.params.productId)
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

purchaseRecordRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions,verifyUser, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    const find = queryBuilder(req);
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    console.log("find inside get: paginate complaints", find);
    
    try {
      const totalProducts = await Purchase.countDocuments(find);
      const totalPages = Math.ceil(totalProducts / pageSize);

      const complaints = await Purchase.find(find)

        .sort({ createdAt: order })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      res.json({
        data: complaints,
        page,
        pageSize,
      
        totalItems: totalProducts,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

module.exports = purchaseRecordRouter;
