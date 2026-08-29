
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const expenseRouter = express.Router();
const cors = require("../cors");
const Expense = require("./expenseModel");
const Transaction = require("../transaction/transactionModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");

const ROLES = require("../shared/rolesConstant");
var moment = require("moment");

expenseRouter.use(bodyParser.json());

expenseRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
      const find = queryBuilder(req);
    
     try {
    console.log("find inside get complaints: ", find);
    Expense.find(find)
   .populate('expenseCategoryRef')
   .populate('paymentMethod')
      .then(
        (Expense) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Expense);
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
  const expenseData = {...req.body, user: req.user._id, vendorId: req.user.vendorId}
    Expense.create(expenseData)
    .then(
      async (data) => {
        let transactionOBJ = {
          reason:'expense',
          reasonId : req.body.expenseCategoryRef._id,
          amount : 0,
          entityId  : data._id,
          entityType  :'Expense',
          entityName: data.name,
          reasonReadableNo : req.body.expenseCategoryRef.name,
          paymentMethod:req.body?.paymentMethod,
          paymentMadeBy:req.body?.paymentMadeBy,
          debit:req.body.amount,
          credit:  0
        }
           // Create the transaction
     
           const  createdTransaction = await Transaction.create(transactionOBJ);
           if (!createdTransaction) {
             throw new Error('createdTransaction creation failed');
           }
        
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
    res.end("PUT operation not supported on /Expense");
  });



  expenseRouter
  .route("/returnrecent")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .put(cors.corsWithOptions, verifyUser,async (req, res) => {

    
      try {
        const orderNumbers = req.body.orderNumbers;
        const updateData = { status: "upload", recent: true, technician: [] };
    
        // Update batch orders based on order numbers
        const result = await Expense.updateMany(
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
expenseRouter
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
  const totalComplaints = await Expense.countDocuments(find);
  const totalPages = Math.ceil(totalComplaints / pageSize);

  const complaints = await Expense.find(find)
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



expenseRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, verifyUser, (req, res, next) => {
    Expense.findById(req.params.productId)
    .populate('expenseCategoryRef')
    .populate('paymentMethod')
      .then(
        (Expense) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Expense);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .post(cors.corsWithOptions,  (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /Expense/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {
    // Generate the current date and time


    Expense.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (Expense) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Expense);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, (req, res, next) => {
    Expense.findByIdAndRemove(req.params.productId)
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

expenseRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions,verifyUser, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let find = queryBuilder(req)
    console.log("find inside get: paginate complaints", find);
    
    try {
      const totalComplaints = await Expense.countDocuments(find);
      const totalPages = Math.ceil(totalComplaints / pageSize);
      let order = 1;
      if(req.params.ordering == "desc") order = -1
      const complaints = await Expense.find(find)
      .populate('expenseCategoryRef')
      .populate('paymentMethod')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      res.json({
        data: complaints,
        page,
        pageSize,
        totalItems: totalComplaints,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

module.exports = expenseRouter;
