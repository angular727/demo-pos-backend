
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const taskRouter = express.Router();
const cors = require("../cors");
const Task = require("./taskModel");
const Transaction = require("../transaction/transactionModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");

const ROLES = require("../shared/rolesConstant");
var moment = require("moment");

taskRouter.use(bodyParser.json());

taskRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
  let find = queryBuilder(req);
   
     try {
    console.log("find inside get Task: ", find);
    Task.find(find)
  
      .then(
        (Task) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Task);
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
  const taskData ={...req.body, user: req.user._id, vendorId: req.user.vendorId}
  Task.create(taskData)
  .then(Task => {

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Task);
        },
        (err) => {
        
            next(err);            
  
        }
      )
   
      
      .catch((err) => next(err));

  
 })

  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /Task");
  });



  taskRouter
  .route("/returnrecent")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .put(cors.corsWithOptions, verifyUser,async (req, res) => {

    
      try {
        const orderNumbers = req.body.orderNumbers;
        const updateData = { status: "upload", recent: true, technician: [] };
    
        // Update batch orders based on order numbers
        const result = await Task.updateMany(
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
taskRouter
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
  const totaltasks = await Task.countDocuments(find);
  const totalPages = Math.ceil(totaltasks / pageSize);

  const tasks = await Task.find(find).populate({
    path: "technician",
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  res.json({
    tasks: tasks,
    page,
    pageSize,
    totaltasks,
    totalPages,
  });
} catch (error) {
 
  res.status(500).json({ error: "Internal Server Error" });
}
   
  });

//task datewise
  taskRouter
  .route("/datewise")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
  
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    try {
      const tasks = await Task.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { _id: 1 }
        }
    ]);

    res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

taskRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res, next) => {
    try {
    const Task = await Task.findById(req.params.productId);
    if (!Task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // const balance = await Transaction.aggregate([
    //   {
    //     $match: {
    //       entityId: Task._id,
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: '$entityId', // Group by TaskId
    //       debitTotal: {
    //         $sum: '$debit',
    //       },
    //       creditTotal: {
    //         $sum: '$credit',
    //       },
    //     },
    //   },
    //   {
    //     $project: {
    //       balance: {
    //         $subtract: ['$debitTotal', '$creditTotal'],
    //       },
    //     },
    //   },
    // ]);

    // if (balance.length === 0) {
    //   return res.json({
    //   ...Task,
    //     balance: 0,
    //   });
    // }

    res.json(
      Task,
      // balance: balance[0].balance,
    );
  } catch (error) {
    res.status(500).json({ message: 'Error fetching Task balance' });
  }

  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /Task/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {
    // Generate the current date and time


    Task.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (Task) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Task);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, (req, res, next) => {
    Task.findByIdAndRemove(req.params.productId)
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

taskRouter
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
    console.log("find inside get: paginate tasks", find);
    
    try {
      const totalProducts = await Task.countDocuments(find);
      const totalPages = Math.ceil(totalProducts / pageSize);

      const tasks = await Task.find(find)
        .sort({ createdAt: order })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      res.json({
        data: tasks,
        page,
        pageSize,
        totalItems:totalProducts,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

module.exports = taskRouter;
