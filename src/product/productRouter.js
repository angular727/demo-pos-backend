
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const productRouter = express.Router();
const cors = require("../cors");
const Product = require("./productModel");

const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const { generateBarcode } = require('./barcode-img');

const ROLES = require("../shared/rolesConstant");
var moment = require("moment");
const Stock = require("../stock/stockModel");

productRouter.use(bodyParser.json());

productRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors,  (req, res, next) => {
    //  const find = queryBuilder(req);
    let find = queryBuilder(req);
   
     try {
    console.log("find inside get products: ", find);
    Product.find(find)
  
      .then(
        (Product) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Product);
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

  const productData ={...req.body, user: req.user._id, vendorId: req.user.vendorId}

      Product.create(productData)
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
    res.end("PUT operation not supported on /Product");
  });



  productRouter
  .route("/barcode/:productId")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .get(cors.corsWithOptions, verifyUser,async (req, res) => {

    
    try {
      const product = await Product.findOne({ productId: req.params.productId });
      console.log("product-------", product);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      const barcodePng = await generateBarcode(product.barcode);
    
      res.type('png');
      res.send(barcodePng);
    } catch (err) {
      res.status(500).json({ message: 'Error generating barcode', error: err.message });
    }
    });


  productRouter
  .route("/returnrecent")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .put(cors.corsWithOptions, verifyUser,async (req, res) => {

    
      try {
        const orderNumbers = req.body.orderNumbers;
        const updateData = { status: "upload", recent: true, technician: [] };
    
        // Update batch orders based on order numbers
        const result = await Product.updateMany(
          { order: { $in: orderNumbers } },
          { $set: updateData }
        );

        res.json({ updatedCount: result.nModified });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

//exist
    productRouter
    .route("/exist")
    .options(cors.corsWithOptions, async (req, res) => {
      res.sendStatus(200);
    })
  
    .get(cors.corsWithOptions,async (req, res) => {
  
      
        try {
          
    //    // Create case-insensitive regex pattern
    // const namePattern = new RegExp(`^${req.query.name}$`, 'i');
    let find ={}
          if(req.query?.name){
            find = { name: req.query.name }
          }else if(req.query?.productId){
            find = { productId: req.query.productId }
          }
    const result = await Product.findOne(
      find
    );
  
          res.json(result);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
      });



//export
productRouter
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
  const totalProducts = await Product.countDocuments(find);
  const totalPages = Math.ceil(totalProducts / pageSize);

  const products = await Product.find(find).populate({
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

  productRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    Product.findById(req.params.productId)

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

    Product.findByIdAndUpdate(
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
  .delete(cors.corsWithOptions, async (req, res, next) => {

    try {
      const product = await Stock.findOne({ productRef: req.params.productId });
      if (product) {
        // Create a custom error object
        const error = {
          status: 400,
          message: "Can't delete product because it's in stock"
        };
        // Send the error response
        return res.status(error.status).json(error);
      } else {
        const deletedProduct = await Product.findByIdAndRemove(req.params.productId);
        if (deletedProduct) {
          // Emit total if needed
          ////////////////////////////emit total 
  
          res.status(200).json(deletedProduct);
        } else {
          // If product wasn't found
          res.status(404).json({ status: 404, message: "Product not found" });
        }
      }
    } catch (err) {
      // Handle any other errors
      res.status(500).json({ status: 500, message: err.message });
    }
  });
 

productRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    const find = queryBuilder(req)
    console.log("find inside get: paginate products", find);
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    try {
      const totalProducts = await Product.countDocuments(find);
      const totalPages = Math.ceil(totalProducts / pageSize);

      const products = await Product.find(find)
        .sort({ createdAt: order })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      res.json({
        data: products,
        page,
        pageSize,
        totalProducts,
        totalItems: totalProducts,
        totalPages
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

module.exports = productRouter;
