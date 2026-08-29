
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const customerReportsRouter = express.Router();
const cors = require("../cors");
const Customer = require("../customer/customerModel");
const Sale = require("../sale/saleModel");
const Transaction = require("../transaction/transactionModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");

const ROLES = require("../shared/rolesConstant");
var moment = require("moment");
const f = require("session-file-store");
const { de } = require("date-fns/locale");

customerReportsRouter.use(bodyParser.json());

customerReportsRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
     const find = {}
     try {
    console.log("find inside get customers: ", find);
    Customer.find(find)
  
      .then(
        (Customer) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Customer);
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
  Customer.create(req.body)
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
    res.end("PUT operation not supported on /Customer");
  });





//customerLedger report
customerReportsRouter
  .route("/customerledger")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    let saleQuery ={}
    let transactionQuery ={}
    if(req.query.customerId){
      saleQuery.customerRef = req.query.customerId;
      transactionQuery.entityId = req.query.customerId;
      delete req.query.customerId;
    }
    const find = queryBuilder(req);
    
     console.log(" inside customerledger: ", find, transactionQuery, saleQuery) ;
    try {
     // Fetch transactions and sales for the customer
    const transactions = await Transaction.find({...find,...transactionQuery })

    const sales = await Sale.find({...find, ...saleQuery }).populate({
      path: 'customerRef',
      path: 'saleDetail.stockRef',
      path: 'saleDetail.productRef',
    }) ;;

    // Combine and sort data by date
    const combinedData = [...transactions, ...sales].sort((a, b) => new Date(a.createdAt || a.createdAt) - new Date(b.createdAt || b.createdAt));

    res.json(combinedData);
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }
  
  
  });

customerReportsRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async(req, res, next) => {
try {
    let customer = await Customer.findById(req.params.productId);
    if (!customer) {
      throw new Error(`customer with ID ${req.params.productId} not found.`);
    }
    
    const transactions = await Transaction.find({entityId:customer._id});

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
      "POST operation not supported on /Customer/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {
    // Generate the current date and time


    Customer.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (Customer) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Customer);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, (req, res, next) => {
    Customer.findByIdAndRemove(req.params.productId)
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

customerReportsRouter
  .route("/:pagesize/:page")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let find = req.query
    console.log("find inside get: paginate customers", find);
    
    try {
      const totalComplaints = await Customer.countDocuments(find);
      const totalPages = Math.ceil(totalComplaints / pageSize);

      const customers = await Customer.find(find)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();
        for(let customer of customers){
          const transaction = await Transaction.aggregate([
            {
              $match: {
                entityId: customer._id,
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
            
          }

          if (!transaction) {
            throw new Error(`transaction with ID ${customer._id} not found.`);
          }
        }

       


      res.json({
        customers: customers,
        page,
        pageSize,
        totalComplaints,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

  

module.exports = customerReportsRouter;
