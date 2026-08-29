
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const visitRouter = express.Router();
const cors = require("../cors");
const Visit = require("./visitModel");


const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");



visitRouter.use(bodyParser.json( ));

visitRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    let find = queryBuilder(req)
     try {
    console.log("find inside get visits: ", find);
    Visit.find(find)
      .populate('patient')
      .then(
        (Visit) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Visit);
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
 
      
      Visit.create(req.body)
        .then(
          (data) => {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.json(data);
          },
          (err) => {
            console.log("err: ", err);
            res.statusCode = 409;

            if (err.code === 11000) {
              
              return res.json({
                success: false,
                message: `Error: visits already Exist or any required field is missing. please check and try again`,
              });
            } else{
              next(err);
            }
            

          }
        )
        .catch((err) => next(err));

})

  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /Visit");
  });






  visitRouter
  .route("/lastvisit")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, verifyUser, (req, res, next) => {
    let find = queryBuilder(req)
    
      // find['$or']= [
      //   { diagnosis: null },
      //   { diagnosis: { $exists: false } }
      // ]
    
    Visit.findOne(find)
    .sort({ createdAt: -1 }) // Sort by createdAt in descending order
    .limit(1)
   
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



visitRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, verifyUser, (req, res, next) => {
    Visit.findById(req.params.productId)
    
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
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /Visit/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {
    // Generate the current date and time
   

    Visit.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
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
  .delete(cors.corsWithOptions, (req, res, next) => {
    Visit.findByIdAndRemove(req.params.productId)
      .then(
        (resp) => {
       
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(resp);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  });

visitRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    
    let order = 1;
    if(req.params.ordering == "desc") order = -1
          
    let find = queryBuilder(req)
    
    console.log("find inside get: paginate visits", find);
    
    try {

      // Perform aggregation to get the paginated data
      const visits = await Visit.find(find)
      .populate('patient')
       const totalVisits = await Visit.countDocuments(find);

      const totalPages = Math.ceil(totalVisits / pageSize);

      res.json({
        visits: visits,
        page:parseInt(page),
        pageSize: parseInt(pageSize),
        totalVisits:totalVisits,
        totalPages:totalPages,
      });
    } catch (error) {
     console.log("error: ", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
    
    //old implementation
    // let order = 1;
    // if(req.params.ordering == "desc") order = -1
          
    // let find = queryBuilder(req)
    // console.log("find inside get: paginate visits", find);
    
    // try {
    //   const totalVisits = await Visit.countDocuments(find);
    //   const totalPages = Math.ceil(totalVisits / pageSize);

    //   const visits = await Visit.find(find)
    //     .sort({ createdAt: order })
    //     .skip((page - 1) * pageSize)
    //     .limit(pageSize)
    //     .exec();

    //   res.json({
    //     visits: visits,
    //     page,
    //     pageSize,
    //     totalVisits,
    //     totalPages,
    //   });
    // } catch (error) {
     
    //   res.status(500).json({ error: "Internal Server Error" });
    // }


  });

module.exports = visitRouter;
