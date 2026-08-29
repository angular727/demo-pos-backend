
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const returnProductRouter = express.Router();
const cors = require("../cors");
const ReturnProduct = require("./saleReturnModel");
const Sale = require("../sale/saleModel");
const Stock = require("../stock/stockModel");
let {saleReturn} = require('../transaction/transactionCommon');
const mongoose = require("mongoose");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const Inventory = require("../inventory/inventoryModel");


returnProductRouter.use(bodyParser.json());

returnProductRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
     const find = req.query;
     try {
    console.log("find inside get returns: ", find);
    ReturnProduct.find(find)
      .populate("products.stockRef")
      .then(
        (ReturnProduct) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(ReturnProduct);
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
 .post(cors.corsWithOptions, verifyUser, async(req, res, next) => {
  // Start a session for the transaction

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const formData = req.body;
    formData.user = req.user._id;
    formData.vendorId = req.user.vendorId;
    if (formData.saleDetail.length > 0 || !formData.totalReturnAmount) {
      let returnProductDetails = [];

      // Process each product return within the transaction
      for (const productData of formData.saleDetail) {
        if (!productData?.returnQuantity) continue;

        let products = {
          productRef: productData.productRef,
          productId:productData.productId,
          productName: productData.productName,
          batchNumber: productData.batchNumber,
          returnQuantity: productData.returnQuantity,
          returnPrice: productData.returnPrice,
          saleDiscount: productData.saleDiscount,
        };

        returnProductDetails.push(products);

        const stock = await Inventory.findOne ({
          batchNumber:productData.batchNumber
        }).session(session);

        if (!stock) {
          throw new Error(`Stock with ID ${productData._id} not found.`);
        }

        // Update stock within transaction
        await stock.addInventory(productData.returnQuantity, session);
        console.log(`Updated stock for product ${productData._id}`);
      }

      let returnInvoice = {
        saleRef: formData._id,
        returnProducts: returnProductDetails,
        totalReturnAmount: formData.totalReturnAmount,
        orderNo: formData.orderNo,
        totalReturnQuantity: formData.totalReturnQuantity,
        customerRef: formData?.customerRef,
        customerName: formData?.customerRef.name,
        walkingCustomer: formData?.walkingCustomer || false,
        wCustomerName: formData?.wCustomerName || '',
      };

      // Create return products within transaction
      const returnProducts = await ReturnProduct.create([returnInvoice], { session });
      
      if (!returnProducts?.[0]) {
        throw new Error('Failed to create return products');
      }
        formData.saleReturnRef = returnProducts?.[0]._id;
      // Call saleReturn function with session
      const result = await saleReturn(formData, session);

      if (!result) {
        throw new Error(`Transaction error ${result}.`);
      }
     
      // If everything succeeded, commit the transaction
      await session.commitTransaction();
   
      res.status(200).json(result);
    }
  } catch (error) {
    // If an error occurred, abort the transaction
    await session.abortTransaction();
    console.error('Transaction error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to process return', 
      error: error.message 
    });
  } finally {
    // End the session
    session.endSession();
  }
});

 


  returnProductRouter
  .route("/returnrecent")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .put(cors.corsWithOptions, verifyUser,async (req, res) => {

    
      try {
        const orderNumbers = req.body.orderNumbers;
        const updateData = { status: "upload", recent: true, technician: [] };
    
        // Update batch orders based on order numbers
        const result = await ReturnProduct.updateMany(
          { order: { $in: orderNumbers } },
          { $set: updateData }
        );

        res.json({ updatedCount: result.nModified });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });



returnProductRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, verifyUser, (req, res, next) => {
    ReturnProduct.findById(req.params.productId)

      .then(
        (ReturnProduct) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(ReturnProduct);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /ReturnProduct/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {
    // Generate the current date and time


    ReturnProduct.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (ReturnProduct) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(ReturnProduct);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, (req, res, next) => {
    ReturnProduct.findByIdAndRemove(req.params.productId)
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

returnProductRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions,verifyUser, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    const find = req.query;
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    console.log("find inside get: paginate returns", find);
    
    try {
      const totalreturns = await ReturnProduct.countDocuments(find);
      const totalPages = Math.ceil(totalreturns / pageSize);

      const returns = await ReturnProduct.find(find)
      .populate("customerRef")
      // .populate("returnProducts.productRef")
        .sort({ createdAt: order })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      res.json({
        data: returns,
        page,
        pageSize,
       totalItems: totalreturns,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

module.exports = returnProductRouter;
