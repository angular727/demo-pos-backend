
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const customerLedgerRouter = express.Router();
const cors = require("../cors");
const Customer = require("./customerModel");
const Transaction = require("../transaction/transactionModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");

const ROLES = require("../shared/rolesConstant");
var moment = require("moment");
const f = require("session-file-store");

customerLedgerRouter.use(bodyParser.json());

customerLedgerRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors,async (req, res, next) => {
     const find =   req.query
   
     try {
    

      const customers = await Customer.find(find)
      .populate({ path: 'userRef' })
        .sort({ createdAt: -1 })
      
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

       


      res.json(customers);
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
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



  customerLedgerRouter
  .route("/returnrecent")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .put(cors.corsWithOptions, verifyUser,async (req, res) => {

    
      try {
        const orderNumbers = req.body.orderNumbers;
        const updateData = { status: "upload", recent: true, technician: [] };
    
        // Update batch orders based on order numbers
        const result = await Customer.updateMany(
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
customerLedgerRouter
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
  const totalComplaints = await Customer.countDocuments(find);
  const totalPages = Math.ceil(totalComplaints / pageSize);

  const customers = await Customer.find(find).populate({
    path: "technician",
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

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


  customerLedgerRouter
  .route("/agingreport/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    //********** */ new pagination ************
    let find = { entityType: 'Customer'}
    if(req.query.customer){
      find.entityName = {$in: req.query.customer};
    }
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    const ordering = req.params.ordering || "asc";
    let order = 1;
    if(ordering == "desc") order = -1
    
    console.log("find inside get agingreport: ", find);
    try {
      const totalProducts = await Customer.countDocuments(find);
      const totalPages = Math.ceil(totalProducts / pageSize);
      const agingReport = await Transaction.aggregate([
        {
          // Step 1: Match only transactions with entityType 'Customer'
          $match:find,
        },
        {
          // Step 2: Group by entityId (customerId)
          $group: {
            _id: '$entityId', // Group by customer ID
            debitTotal: { $sum: '$debit' }, // Calculate total debit
            creditTotal: { $sum: '$credit' }, // Calculate total credit
            // Get the oldest transaction date where there is an outstanding debit
            oldestDebitDate: {
              $min: {
                $cond: [{ $gt: ['$debit', 0] }, '$createdAt', null],
              },
            },
          },
        },
        {
          // Step 3: Perform a lookup to join with the Customer collection
          $lookup: {
            from: 'customers', // Name of the customer collection
            localField: '_id', // Field from the Transaction (grouped _id = customerId)
            foreignField: '_id', // Field from the Customer collection
            as: 'customer', // Output array field name
          },
        },
        {
          // Step 4: Unwind the customerDetails array to get a single object
          $unwind: {
            path: '$customer',
            preserveNullAndEmptyArrays: true, // Optional: keep documents without matching customers
          },
        },
        {
          // Step 5: Project the balance, customer details, and other necessary fields
          $project: {
            debitTotal: 1,
            creditTotal: 1,
            balance: { $subtract: ['$debitTotal', '$creditTotal'] }, // Calculate balance
            oldestDebitDate: 1, // Include oldest debit date
            customer: 1, // Include customer details
          },
        },
        {
          // Step 6: Sort by oldest outstanding debit date in ascending order
          $sort: { oldestDebitDate: 1 },
        },
        {
          // Step 7: Skip the specified number of documents based on the page and pageSize
          $skip: (page - 1) * pageSize,
        },
        {
          // Step 8: Limit the number of documents returned based on the pageSize
          $limit: pageSize,
        },
      ]);

      
          

          if (!agingReport) {
           next(new Error("No agingReport found"));
          }
          res.json({
            data: agingReport,
            page:page,
            pageSize:pageSize,
            totalItems: totalProducts,
            totalPages: totalPages,
          });
          
      // res.json(agingReport );
    } 
    catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });







customerLedgerRouter
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
    
    const transactions = await Transaction.find({entityId:customer._id}).populate("paymentMethod"); ;

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




customerLedgerRouter
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
      const totalComplaints = await Customer.countDocuments(find);
      const totalPages = Math.ceil(totalComplaints / pageSize);

      const customers = await Customer.find(find)
      .populate({ path: 'userRef' })
        .sort({ createdAt: order })
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
        data: customers,
        page,
        pageSize,
        totalItems: totalComplaints,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

module.exports = customerLedgerRouter;
