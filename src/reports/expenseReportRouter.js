
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const expenseReportRouter = express.Router();
const cors = require("../cors");


const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const ROLES = require("../shared/rolesConstant");
const Expense = require("../expense/expenseModel");
expenseReportRouter.use(bodyParser.json());

expenseReportRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    let find = queryBuilder(req);

     try {
    console.log("find inside get Expense: ", find);
    Expense.find(find)
   
      .then(
        (expense) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(expense);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
    }
    catch(err){
        res.json(err);
    }
  })



 
  



//total Expense
expenseReportRouter
  .route("/totalExpense")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let find = queryBuilder(req)

  

    console.log("find. inside totalExpense ", find);
    try {
      const result = await Expense.aggregate([
     
        { $match: {
          ...find
          }
        },
          {
            $group: {
              _id: null,
              totalExpenses: { $sum: "$amount" }
            }
          },
         
        
          {
              $sort: { totalProfit: -1 }
          },
          {
              $skip: (page - 1) * pageSize
          },
          {
              $limit: pageSize
          },
        
      ]);


      res.json(result) ;
  } catch (error) {
      console.error('Error fetching top profitable Expenses:', error);
      throw error;
  }
})

  //********** */ Api to get Expense for everyday for a whole month ************
 
expenseReportRouter
  .route("/:pagesize/:page")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    const find = queryBuilder(req);
    
    
    try {
      const totalExpense = await Expense.countDocuments(find);
      const totalPages = Math.ceil(totalExpense / pageSize);
      console.log("find inside get: paginate stocks", find);
      const stocks = await Expense.find(find)
      .populate({
        path: 'customerRef',
        path: 'ExpenseRef',
        populate: {
          path: 'stockRef',
          populate: {
            path: 'productRef'
          }
        }
      }) 
     
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      res.json({
        data: stocks,
        page,
        pageSize,
        totalExpense,
        totalItems:totalExpense,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

  

module.exports = expenseReportRouter;
