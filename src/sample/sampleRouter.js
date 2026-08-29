
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const sampleRouter = express.Router();
const cors = require("../cors");
const Sample = require("./sampleModel");

const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");

const ROLES = require("../shared/rolesConstant");
var moment = require("moment");

sampleRouter.use(bodyParser.json());

sampleRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors,  (req, res, next) => {
    //  const find = queryBuilder(req);
    let find = req.query
   
     try {
    console.log("find inside get products: ", find);
    Sample.find(find)
  
      .then(
        (Sample) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Sample);
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
    const sampleData ={...req.body, user: req.user._id, vendorId: req.user.vendorId}
      Sample.create(sampleData)
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
      })
 

  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /Sample");
  });



  sampleRouter
  .route("/returnrecent")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .put(cors.corsWithOptions, verifyUser,async (req, res) => {

    
      try {
        const orderNumbers = req.body.orderNumbers;
        const updateData = { status: "upload", recent: true, technician: [] };
    
        // Update batch orders based on order numbers
        const result = await Sample.updateMany(
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
sampleRouter
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
  const totalProducts = await Sample.countDocuments(find);
  const totalPages = Math.ceil(totalProducts / pageSize);

  const products = await Sample.find(find).populate({
    path: "technician",
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  res.json({
    products: products,
    page,
    pageSize,
    totalProducts,
    totalPages,
  });
} catch (error) {
 
  res.status(500).json({ error: "Internal Server Error" });
}
   
  });

  sampleRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    Sample.findById(req.params.productId)

      .then(
        (product) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(product);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })

  .put(cors.corsWithOptions, (req, res, next) => {

    Sample.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (product) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(product);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, (req, res, next) => {
    Sample.findByIdAndRemove(req.params.productId)
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

sampleRouter
  .route("/:pagesize/:page/ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let find = {}
    console.log("find inside get: paginate products", find);
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    try {
      const totalProducts = await Sample.countDocuments(find);
      const totalPages = Math.ceil(totalProducts / pageSize);

      const products = await Sample.find(find)
        .sort({ createdAt: order })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      res.json({
        products: products,
        page,
        pageSize,
        totalProducts,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

module.exports = sampleRouter;
