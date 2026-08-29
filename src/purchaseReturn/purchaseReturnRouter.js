
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const purchaseReturnRouter = express.Router();
const cors = require("../cors");
const PurchaseReturn = require("./purchaseReturn");
const Purchase = require("../purchaseInvoice/puchaseModel");
const Inventory = require("../inventory/inventoryModel");
const Stock = require("../stock/stockModel");
let {purchaseReturn} = require('../transaction/transactionCommon');
const mongoose = require("mongoose");
const {createPurchaseReturnTransaction } = require("./purchaseReturnTransaction");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const newQueryBuilder = require('../shared/newQueryBuilder')

purchaseReturnRouter.use(bodyParser.json());

purchaseReturnRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
     const find = queryBuilder(req);
     try {
    console.log("find inside get complaints: ", find);
    PurchaseReturn.find(find)
    .populate({
      path: 'returnItems.productRef',
     
    })
   
      .then(
        (PurchaseReturn) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(PurchaseReturn);
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
 .post(cors.corsWithOptions,verifyUser, async(req, res, next) => {
  // Start a new Mongoose session
  const session = await mongoose.startSession();
  
  try {
    // Begin the transaction
    await session.startTransaction();

    req.body.vendorId = req.user.vendorId;
      const { purchaseRef, returnItems, reason ,totalReturnPricing, vendorId} = req.body;
    console.log("purchaseRef, returnItems, reason", purchaseRef, returnItems, reason);
    
    // Validate required fields
    if (!purchaseRef || !returnItems || !Array.isArray(returnItems) || returnItems.length === 0) {
      throw new Error('purchaseRef and returnItems are required and must be a non-empty array');
    }

    // Fetch the original purchase within the session
    const purchase = await Purchase.findById(purchaseRef)
      .populate('itemDetails.productRef')
      .populate('supplierRef')
      .session(session);
    
    if (!purchase) {
      throw new Error('Purchase not found');
    }

    // Validate return items against original purchase
    const purchaseItemsMap = new Map(
      purchase.itemDetails.map(item => [item.productRef._id.toString(), item])
    );

    const validatedReturnItems = returnItems.map(item => {
      const purchaseItem = purchaseItemsMap.get(item.productRef._id.toString());
      if (!purchaseItem) {
        throw new Error(`Product ${item.productRef._id} not found in original purchase`);
      }

      if (item.returnQuantity > purchaseItem.totalUnits) {
        throw new Error(`Return quantity for ${purchaseItem.productRef.name} exceeds purchased quantity`);
      }

      return {
        productRef: item.productRef._id,
        returnQuantity: item.returnQuantity,
        unitPrice: purchaseItem.unitPrice, // From original purchase
        totalUnits: purchaseItem.totalUnits, // Original purchased qty
        returnPrice: item.returnPrice || purchaseItem.unitPrice, // Allow override, default to unitPrice
        discount: item.discount || purchaseItem.discount || 0, // Inherit if provided
        batchNumber: item.batchNumber || '', // Allow override, default to empty string
      };
    });

    // Create the purchase return document within the session
    const purchaseReturn = new PurchaseReturn({
      purchaseRef,
      invoiceNo: purchase.invoiceNo, // Inherit from purchase
      supplierRef: purchase.supplierRef._id, // Inherit from purchase
      supplierName: purchase.supplierRef.name, // Inherit from purchase
      returnItems: validatedReturnItems,
      totalReturnPricing,
      reason: reason || '',
      vendorId:req.user.vendorId,
      user: req.user._id,
    });

    // Save the purchase return within the session
    const savedReturn = await createPurchaseReturnTransaction(purchaseReturn, session);
    // const savedReturn = await purchaseReturn.save({ session });

    // Update inventory (decrease stock) within the session
    await Promise.all(
      savedReturn.returnItems.map(async (item) => {
        const stock = await Inventory.findOne({ batchNumber: item.batchNumber }).session(session);
        
        if (!stock) {
          throw new Error(`Inventory not found for product: ${item.batchNumber}`);
        }
        
        try {
          await stock.subtractInventory(item.returnQuantity,  session );
        } catch (error) {
          throw new Error(`Failed to subtract inventory for product: ${item.batchNumber}`);
        }
      })
    );

    // Commit the transaction
    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Purchase return created successfully',
      data: savedReturn,
    });
  } catch (error) {
    // If an error occurs, abort the transaction
    await session.abortTransaction();

    console.error('Error creating purchase return:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create purchase return',
    });
  } finally {
    // Always end the session
    await session.endSession();
  }
})

  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /PurchaseReturn");
  });



  purchaseReturnRouter
  .route("/returnpurchase")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .put(cors.corsWithOptions, verifyUser,async (req, res) => {

    const { purchaseId } = req.params;
    const updatedPurchase = req.body;
  
    try {
      // Fetch the original purchase
      const originalPurchase = await Purchase.findById(purchaseId).populate('stockRef');
  
      if (!originalPurchase) {
        return res.status(404).json({ message: 'Purchase not found' });
      }
  
      // Compare original and updated purchase
      const originalStockMap = new Map();
      originalPurchase.stockRef.forEach(stockItem => {
        originalStockMap.set(stockItem._id.toString(), stockItem);
      });
  
      const updatedStockMap = new Map();
      updatedPurchase.stockRef.forEach(stockItem => {
        updatedStockMap.set(stockItem._id.toString(), stockItem);
      });
  
      // // Handle removed products
      // originalStockMap.forEach(async(originalStock, stockId) => {
      //   if (!updatedStockMap.has(stockId)) {
      //     // Product removed
      //     await Stock.findByIdAndUpdate(stockId, {
      //       $inc: { totalStock: -originalStock.quantity }
      //     });
      //   }
      // });
  
      // Handle added/modified products
      updatedStockMap.forEach(async (updatedStock, stockId) => {
        // if (!originalStockMap.has(stockId)) {
        //   // New product added
        //   await Stock.findByIdAndUpdate(stockId, {
        //     $inc: { totalStock: updatedStock.quantity }
        //   });
        // } else {
          // Quantity adjusted
          const originalStock = originalStockMap.get(stockId);
          const quantityDiff = updatedStock.quantity - originalStock.quantity;
  
          if (quantityDiff !== 0) {
            await Stock.findByIdAndUpdate(stockId, {
              $inc: { totalStock: quantityDiff }
            });
          }
        // }
      });
  
      // Update the purchase
      // await Purchase.findByIdAndUpdate(purchaseId, updatedPurchase);
  
      // Update supplier ledger
      const totalPriceDiff = updatedPurchase.totalPrice - originalPurchase.totalPrice;
      await SupplierLedger.updateOne(
        { supplierId: originalPurchase.supplierId },
        { $inc: { balance: totalPriceDiff } }
      );
  
      res.status(200).json({ message: 'Purchase updated successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred while updating the purchase' });
    }
  })
 



purchaseReturnRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, verifyUser, (req, res, next) => {
    PurchaseReturn.findById(req.params.productId)

      .then(
        (PurchaseReturn) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(PurchaseReturn);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /PurchaseReturn/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {
    // Generate the current date and time


    PurchaseReturn.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (PurchaseReturn) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(PurchaseReturn);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, (req, res, next) => {
    PurchaseReturn.findByIdAndRemove(req.params.productId)
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

purchaseReturnRouter
.route("/:pagesize/:page/:ordering?")

  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions,verifyUser, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    const queryBuilder =   new newQueryBuilder(req.query, req)
    .buildStringFilters()
    .buildUniqueIdentifierFilters()
    const find = queryBuilder.build();
    console.log("find inside get: paginate complaints", find);
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    try {
      const totalComplaints = await PurchaseReturn.countDocuments(find);
      const totalPages = Math.ceil(totalComplaints / pageSize);

      const complaints = await PurchaseReturn.find(find)
      // .populate('itemDetails.productRef')
      .populate('supplierRef')
        .sort({ createdAt: order })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      res.json({
        data: complaints,
        page,
        pageSize,
        totalItems:totalComplaints,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

module.exports = purchaseReturnRouter;
