
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const supplierLedgerRouter = express.Router();
const cors = require("../cors");
const Supplier = require("./supplierModel");
const Transaction = require("../transaction/transactionModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const { ObjectId } = require('mongodb');
const ROLES = require("../shared/rolesConstant");
var moment = require("moment");
const f = require("session-file-store");

supplierLedgerRouter.use(bodyParser.json());

supplierLedgerRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
     const find = {}
     try {
    console.log("find inside get customers: ", find);
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
 .post(cors.corsWithOptions, (req, res, next) => {
  Supplier.create(req.body)
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
    res.end("PUT operation not supported on /Supplier");
  });



  supplierLedgerRouter
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
supplierLedgerRouter
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

  const suppliers = await Supplier.find(find)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  res.json({
    suppliers: suppliers,
    page,
    pageSize,
    totalComplaints,
    totalPages,
  });
} catch (error) {
 
  res.status(500).json({ error: "Internal Server Error" });
}
   
  });



supplierLedgerRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async(req, res, next) => {
try {
    let customer = await Supplier.findById(req.params.productId);
    if (!customer) {
      throw new Error(`customer with ID ${req.params.productId} not found.`);
    }
    
    const transactions = await Transaction.find({entityId:customer._id}).populate("paymentMethod"); 

 if (!transactions) {
      throw new Error(`transaction with ID ${customer._id} not found.`);
    }
    let totalCredit = 0; totalDebit = 0;
    for(let transaction of transactions){
      if(transaction.debit){
        totalDebit += transaction.debit;
      }
       if(transaction.credit){
        totalCredit += transaction.credit;
      }
    }
    if(totalCredit > totalDebit){
      customer.amountAdvanced = totalCredit - totalDebit;
      customer.balanceType = "credit";
    }
    else if(totalCredit < totalDebit){
      customer.amountPayable = totalDebit - totalCredit;
      customer.balanceType = "debit";
    } else{
      customer.amountPayable = 0;
      customer.amountAdvanced = 0;
      customer.balanceType = "balanced";
    }
    console.log("customer ", customer)
    if(customer){

        customer.transactions = transactions;
        console.log("customer ", customer)
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.json(customer);
    }

}
catch (error) {
    res.end(
        "error in finding the customer or transaction"
      );
}

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

supplierLedgerRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let find = req.query
    console.log("find inside get: paginate customers", find);
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    try {
      const totalComplaints = await Supplier.countDocuments(find);
      const totalPages = Math.ceil(totalComplaints / pageSize);


      const suppliers = await Supplier.find(find)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();
     
        for(let supplier of suppliers){
                  // Assuming supplier._id is a string
        // const supplierIdString = supplier._id;
        // const supplierIdObject = new ObjectId(supplierIdString);
       
          const transaction = await Transaction.aggregate([
            {
              $match: {
                entityId: supplier._id,
              },
            },
            {
              $group: {
                _id: '$entityId',
                debitTotal: {
                  $sum: '$debit',
                },
                creditTotal: {
                  $sum: '$credit',
                },
              },
            },
            {
              $project: {
                debitTotal: 1,
                creditTotal: 1,
                balance: {
                  $subtract: ['$debitTotal', '$creditTotal'],
                },
              },
            },
          ]);
          let totalCredit = 0; totalDebit = 0;
          if (transaction.length > 0) {
            totalDebit = transaction[0].debitTotal;
            totalCredit = transaction[0].creditTotal;
            if(totalCredit > totalDebit){
              supplier.amountAdvanced = totalCredit - totalDebit;
              supplier.balanceType = "credit";
            }
            else if(totalCredit < totalDebit){
              supplier.amountPayable = totalDebit - totalCredit;
              supplier.balanceType = "debit";
            } else{
              supplier.amountPayable = 0;
              supplier.amountAdvanced = 0;
              supplier.balanceType = "balanced";
            }
            
          }
console.log("transaction ", transaction)
          if (!transaction) {
            throw new Error(`transaction with ID ${supplier._id} not found.`);
          }
        }

       


      res.json({
        data: suppliers,
        page,
        pageSize,
        totalItems:totalComplaints,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

module.exports = supplierLedgerRouter;
