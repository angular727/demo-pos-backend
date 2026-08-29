
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const supplierRouter = express.Router();
const cors = require("../cors");
const Supplier = require("./supplierModel");
const Transaction = require("../transaction/transactionModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");

const ROLES = require("../shared/rolesConstant");
var moment = require("moment");

supplierRouter.use(bodyParser.json());

supplierRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    let find = queryBuilder(req);
   
    // if(req.query.name){
    //   find = {
    //     name: {
    //         $regex: req.query.name,
    //         $options: 'i' // case-insensitive
    //     }
      
    // };
    // delete req.query.name
    // }
    // find = {...find,...req.query}
     try {
    console.log("find inside get complaints: ", find);
    Supplier.find(find)
      
      .then(
        (Supplier) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Supplier);
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
 //post call for to create
 .post(cors.corsWithOptions,verifyUser, (req, res, next) => {
  const supplierData ={...req.body, user: req.user._id, vendorId: req.user.vendorId}
  Supplier.create(supplierData)
    .then(
      async (data) => {
      //   if(req.body.openingBalance){

      //     const transactionCreated = await Transaction.create({
      //         reason: "openingBalance",
      //         reasonId:data._id,
      //         entityId: data._id,
      //         entityType: "Supplier",
      //         entityName: data.name,
      //         reasonReadableNo: data.name,
      //          debit: req.body.openingBalance,
      //          paymentMethod: req.body.paymentMethod,
      //          credit: 0,
      //    })
      //    if(!transactionCreated){
      //      throw new Error('Transaction not created');
      //    }
      //    res.statusCode = 200;
      //    res.setHeader("Content-Type", "application/json");
      //    Supplier.tansaction = transactionCreated
      //    res.json(Supplier);
      //  }else{
         res.statusCode = 200;
         res.setHeader("Content-Type", "application/json");
         res.json(data);
       }
    
      // }
    ,(err) => next(err)
    )
    .catch((err) => next(err));
  })


  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /Supplier");
  });



  supplierRouter
  .route("/returnrecent")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .put(cors.corsWithOptions, verifyUser,async (req, res) => {

    
      try {
        const orderNumbers = req.body.orderNumbers;
        const updateData = { status: "upload", recent: true, technician: [] };
    
        // Update batch orders based on order numbers
        const result = await Supplier.updateMany(
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
supplierRouter
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
  const totalComplaints = await Supplier.countDocuments(find);
  const totalPages = Math.ceil(totalComplaints / pageSize);

  const complaints = await Supplier.find(find).populate({
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



supplierRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    Supplier.findById(req.params.productId)

      .then(
        (Supplier) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Supplier);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /Supplier/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {
    // Generate the current date and time

    Supplier.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (Supplier) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Supplier);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, (req, res, next) => {
    Supplier.findByIdAndRemove(req.params.productId)
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


supplierRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions,verifyUser, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let find = queryBuilder(req)
    console.log("find inside get: paginate complaints", find);
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    try {
      const totalProducts = await Supplier.countDocuments(find);
      const totalPages = Math.ceil(totalProducts / pageSize);

      const complaints = await Supplier.find(find)
        .sort({ createdAt: order})
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      res.json({
        data: complaints,
        page,
  
        pageSize,
        totalItems: totalProducts,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

module.exports = supplierRouter;
