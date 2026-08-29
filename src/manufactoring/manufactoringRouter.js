
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const manufactoringRouter = express.Router();
const cors = require("../cors");
const Manufactoring = require("./manufactoringModel");
const Transaction = require("../transaction/transactionModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");

const ROLES = require("../shared/rolesConstant");
var moment = require("moment");

manufactoringRouter.use(bodyParser.json());

manufactoringRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
  let find = queryBuilder(req);
   
     try {
    console.log("find inside get Manufactoring: ", find);
    Manufactoring.find(find)
  
      .then(
        (Manufactoring) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Manufactoring);
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
  Manufactoring.create(req.body)
  .then(
    (Manufactoring) => {
      if(req.body.openingBalance){

        Transaction.create({
            reason: "openingBalance",
            reasonId:Manufactoring._id,
             entityId: Manufactoring._id,
             entityType: "Manufactoring",
            debit: req.body.openingBalance,
            credit: 0,
      })
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
    }
 
  
  })
  
 })

  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /Manufactoring");
  });



  manufactoringRouter
  .route("/returnrecent")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .put(cors.corsWithOptions, verifyUser,async (req, res) => {

    
      try {
        const orderNumbers = req.body.orderNumbers;
        const updateData = { status: "upload", recent: true, technician: [] };
    
        // Update batch orders based on order numbers
        const result = await Manufactoring.updateMany(
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
manufactoringRouter
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
  const totalComplaints = await Manufactoring.countDocuments(find);
  const totalPages = Math.ceil(totalComplaints / pageSize);

  const complaints = await Manufactoring.find(find).populate({
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



manufactoringRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res, next) => {
    try {
    const Manufactoring = await Manufactoring.findById(req.params.productId);
    if (!Manufactoring) {
      return res.status(404).json({ message: 'Manufactoring not found' });
    }

    // const balance = await Transaction.aggregate([
    //   {
    //     $match: {
    //       entityId: Manufactoring._id,
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: '$entityId', // Group by ManufactoringId
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
    //   ...Manufactoring,
    //     balance: 0,
    //   });
    // }

    res.json(
      Manufactoring,
      // balance: balance[0].balance,
    );
  } catch (error) {
    res.status(500).json({ message: 'Error fetching Manufactoring balance' });
  }

  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /Manufactoring/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {
    // Generate the current date and time


    Manufactoring.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (Manufactoring) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Manufactoring);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, (req, res, next) => {
    Manufactoring.findByIdAndRemove(req.params.productId)
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

manufactoringRouter
  .route("/:pagesize/:page")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions,verifyUser, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    const find = queryBuilder(req);

    console.log("find inside get: paginate complaints", find);
    
    try {
      const totalComplaints = await Manufactoring.countDocuments(find);
      const totalPages = Math.ceil(totalComplaints / pageSize);

      const complaints = await Manufactoring.find(find)
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

module.exports = manufactoringRouter;
