
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const PurchaseRouter = express.Router();
const cors = require("../cors");
const Purchase = require("./puchaseModel");
const PurchaseReturn = require("../purchaseReturn/purchaseReturn");
const Stock = require("../stock/stockModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const Customer = require("../customer/customerModel");
const Transaction = require("../transaction/transactionModel");
const ROLES = require("../shared/rolesConstant");
const {updatePurchaseAndTransaction, createPurchaseAndTransaction} = 
require('./purchaseTransaction');
const { createPurchaseInvoice ,} = require("../shared/purchaseInvoicePDF"); 
const Sale = require("../sale/saleModel");
var moment = require("moment");
const mongoose = require("mongoose");
const newQueryBuilder = require('../shared/newQueryBuilder')
const BatchDetail = require("../inventory/inventoryUtils");
const Inventory = require("../inventory/inventoryModel");
const editPurchase = require("./editPurchase");
PurchaseRouter.use(bodyParser.json());

PurchaseRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    let find = queryBuilder(req);

     try {
    console.log("find inside get Purchase: ", find);
    Purchase.find(find)
    .populate({
      // Branch column ko user ka naam chahiye, sirf id nahi
      path: 'user',
      select: 'name shopName username'
    })
    .populate({
      path: 'supplierRef',
    })
    .populate({
      path: 'paymentMethod',
    })
    .populate({
        path: 'itemDetails.productRef'
    })
      .then(
        (Purchase) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Purchase);
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
 .post(cors.corsWithOptions, verifyUser, async (req, res, next) => {
  const formData = req.body;
  if(!formData?.user){
  formData.user =   req.user._id;
  }
 // Attach user ID from authenticated user
  formData.vendorId = req.user.vendorId; // Attach vendor ID from authenticated user
  let session = null;

  try {

    session = await mongoose.startSession();
    session.startTransaction();
    const createInventory = async (batchObj, session) => {
      try {
        // Ensure batchObj doesn't have InvetoryNo set
       
        delete batchObj.inventoryNo;
    
        // Create inventory with session
        const inventoryCreated = await Inventory.create([batchObj], { session });
        return inventoryCreated[0];
      } catch (error) {
        if (error.code === 11000) {
          // If duplicate key error occurs, retry the operation
          return await createInventory(batchObj, session);
        }
        throw error;
      }
    };
    const createdInventories = [];
    const errors = [];

    for (const productData of formData.itemDetails) {
      console.log("Processing productData: ", productData);
      try {
        delete productData._id;

        let batchNumber;
        try {
          batchNumber = generateBatchNumber(
            productData?.supplierId || 1, 
            productData.purchaseDate
          );
          productData.batchNumber = batchNumber;
        } catch (error) {
          throw new Error(`Batch number generation failed: ${error.message}`);
        }

        const batchObj = {
          user: req.user._id,
          vendorId: req.user.vendorId,
          ...productData,
          batchNumber: batchNumber,
          stockBarCode: productData.stockBarCode || '',
          productRef: productData.productRef._id,
          productId: productData.productRef.productId,
          totalInventory: productData.totalUnits,
          productName: productData.productRef.name,
          description: productData.description
        };

        const batchDetail = new BatchDetail(batchObj);
        if (!batchObj.productRef || !batchObj.productId || !batchObj.totalUnits) {
          throw new Error('Required fields missing in itemsDetail data');
        }
        
        // Use the new createInventory function
        const inventoryCreated = await createInventory(batchObj, session);
        createdInventories.push(inventoryCreated);

      } catch (error) {
        errors.push({
          productId: productData.productRef.productId,
          error: error.message
        });
      }
    }

    if (errors.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Errors occurred during inventory creation',
        errors: errors
      });
    }

    try {
      const result = await createPurchaseAndTransaction(formData, session);
      await session.commitTransaction();
      res.status(200).json(result);

    } catch (error) {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: 'Purchase transaction failed',
        error: error.message
      });
    }

  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    
    res.status(500).json({
      success: false,
      message: 'An error occurred during purchase processing',
      error: error.message
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }

})

  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /Purchase");
  });




  PurchaseRouter
  .route("/return/:id")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .put(cors.corsWithOptions,async (req, res, next) => {
    let formData = req.body;
    let returnObj = {supplierRef:formData?.supplierRef._id, returnDetail:[], totalReturnQuantity:formData?.totalReturnQuantity,
      totalReturnAmount:formData?.totalReturnAmount, invoiceNo:formData?.invoiceNo}
    for(let purchasedStock of formData.products){
      const stock = await Stock.findOne({_id: purchasedStock._id  });
      if (stock) {
        await stock.subtractStock(purchasedStock.returnQuantity); 
        //update orignal stock total pricing etc
        returnObj.returnDetail.push({
          itemDetails:purchasedStock._id,
          returnQuantity:purchasedStock.returnQuantity,
          returnPrice:purchasedStock.returnPrice,
          productRef: purchasedStock.productRef._id,
          unitPrice: purchasedStock.unitPrice,
          discount:purchasedStock.discount,
          
  
        })
        // returnObj.returnGrandTotal+=purchasedStock.totalReturnAmount;
      }else{
        next(new Error('Stock not found'));
      }
     
     
    }
   
    const purchaseReturn = await PurchaseReturn.create(returnObj);
    if(!purchaseReturn) next(new Error('Purchase not created'));
    let transactionOBJ = {
      reason:"returnPurchase",
      reasonId : purchaseReturn._id,
      amount : 0,
      entityId  : formData.supplierRef._id,
      entityType  :'Supplier',
      entityName: formData.supplierRef.name,
      reasonReadableNo : formData.invoiceNo,
      paymentMethod:formData?.paymentMethod,
      paymentMadeBy:formData?.paymentMadeBy,
      debit: 0,
      credit: formData.totalReturnAmount || 0
    }
    const supplierTransaction = await Transaction.create(transactionOBJ)
    if(!supplierTransaction) next(new Error('Supplier transaction errror'));
    res.statusCode = 200;
    res.json(purchaseReturn)
  })



  PurchaseRouter
    .route("/previousstock")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, (req, res, next) => {
      let find = req.query
      if(find.productId || find.productName === 0){
        Purchase.find(find) // Filter by productId
          .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
          .limit(2) // Limit the result to the last two entries
          .exec((err, stocks) => {
            if (err) {
              // Handle error
              console.error(err);
              return;
            }
          res.json(stocks);
        // Handle retrieved stocks
        console.log("Last two stocks:", stocks);
      });
    }else{
      res.json({message: "Please provide a product id or product name"})
    }
    })
    .post(cors.corsWithOptions, (req, res, next) => {
      res.statusCode = 403;
      res.end(
        "POST operation not supported on /Product/" + req.params.productId
      );
    })
    

 

//export
PurchaseRouter
  .route("/export/:pagesize?/:page?")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .post(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
  
    let find = queryBuilderWithBody(req)
    console.log("find. ", find);
try {
  const totalPurchase = await Purchase.countDocuments(find);
  const totalPages = Math.ceil(totalPurchase / pageSize);

  const stocks = await Purchase.find(find)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  res.json({
    Purchase: stocks,
    page,
    pageSize,
    totalPurchase,
    totalPages,
  });
} catch (error) {
 
  res.status(500).json({ error: "Internal Server Error" });
}
   
  });

  //********** */ Api to get Purchase for everyday for a whole month ************
  PurchaseRouter
  .route("/datewise")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
  
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    try {
      const Purchases = await Purchase.aggregate([
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

    res.json(Purchases);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });


  PurchaseRouter
  .route("/invoice/.pdf")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async(req, res, next) => {
 try{



    const purchase = await Purchase.findById(req.query.id)
    .populate({
      path: 'supplierRef',
    })
    .populate({
     
          path: 'itemDetails.productRef'
  
    })
  
    if (!purchase) {
      throw new Error(`Sale with ID ${req.query.id} not found`);
    }

      createPurchaseInvoice(purchase,'../public/invoice/'+ purchase.orderNo+'.pdf',
      (doc)=>{
        res.setHeader('Content-Disposition', 'attachment; filename='+purchase.orderNo+"-report.pdf");
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/pdf");
    
          doc.pipe(res)
      }
      )
    }
    catch(err){
     res.json(err);
    }

  })


  PurchaseRouter
  .route("/exist")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .post(cors.corsWithOptions,async (req, res) => {
    try {
      const  stockRefs  = req.body?.itemDetails.map(stock => stock._id);
      console.log("stockRefs: ", stockRefs);
      // Validate stockRefs
      if (!Array.isArray(stockRefs) || stockRefs.length === 0) {
        return res.status(400).json({ error: 'Invalid stockRefs provided. Must be a non-empty array.' });
      }
  
      // Validate each itemDetails is a valid ObjectId
      const validStockRefs = stockRefs.filter(itemDetails => mongoose.Types.ObjectId.isValid(itemDetails));
  
      if (validStockRefs.length !== stockRefs.length) {
        return res.status(400).json({ error: 'One or more invalid stockRefs provided' });
      }
  
      // Check if the stockRefs exist in any sale's saleDetail
      const salesWithStocks = await Sale.find({
        'saleDetail.itemDetails': { $in: validStockRefs }
      }, 'saleDetail.itemDetails');

  
      res.json({
        results: salesWithStocks,
        message: 'Stock existence check completed'
      });
  
    } catch (error) {
      next(error);
    }
    });

PurchaseRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, verifyUser, (req, res, next) => {
    Purchase.findById(req.params.productId)
    .populate({
      path: 'supplierRef',
    })
    .populate({
      path: 'paymentMethod',
    })
    .populate({
        path: 'itemDetails.productRef'
    })
   
      .then(
        (Purchase) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Purchase);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /Purchase/" + req.params.productId
    );
  })
  //Purchase Update Scenarios:
  // 1-Create a transaction to handle all updates atomically
  // 2-compare the incoming purchase and orignal purchase using batch numbers
  // 4- if product don't have a batch numbers its mean we need to lot a new batch number and it is 
  // a new product so create new inventory for them
  // 5- if existing products are deleted in purchase, then check if that deleted product has not been sold usning Sale model
  // if tha batch number exist in sale its mean we can't delete that bacth number either from inventory or from itemDetails array
  // if it is not sold then we can delete from inventoy and itemDetails
  // 6- if existing products are updated, find the difference and update the inventory for updated
  //7- find the difference in orginal purchase invoice balance and incoming purchase balance
  //8- creae a new paymet/transaction for that difference
  // 9-  check the validation of the incoming purchase

  .put(cors.corsWithOptions, verifyUser,async (req, res, next) => {

   const result = await editPurchase(req, res, next);
   console.log("result is on update purchase ", result)
   if(result.success){
    res.status(200).json(result);
   }else{
    res.status(400).json(result);
   }
    // const session = await mongoose.startSession();
    // session.startTransaction();
  
    // try {
    //   const originalPurchase = await Purchase.findById(req.params.productId).session(session);
    //   if (!originalPurchase) {
    //     throw new Error(`Purchase with ID ${req.params.productId} not found`);
    //   }
  
    //   let updatedProducts = [];
    //   let addedProducts = [];
    //   let deletedProducts = [];
    //   let newStockCreated = [];
    //   let deleteStock = [];
  
    //   originalPurchase.itemDetails.forEach(sale => {
    //     let find = req.body.products.find(item => item._id.toString() === sale?.toString());
    //     if (!find) {
    //       if (sale) deletedProducts.push(sale);
    //     } else {
    //       if (find) updatedProducts.push(find);
    //     }
    //   });
  
    //   req.body.products.forEach(productId => {
    //     let find = originalPurchase.itemDetails.find(item => item?._id.toString() === productId._id.toString());
    //     if (!find) {
    //       addedProducts.push(productId);
    //     }
    //   });
  
    //   if (updatedProducts.length > 0) {
    //     for (const productData of updatedProducts) {
    //       const stockupdate = await Stock.findByIdAndUpdate(
    //         productData._id,
    //         { $set: productData },
    //         { session }
    //       );
    //       if (!stockupdate) {
    //         throw new Error(`Stock with ID ${productData._id} not found`);
    //       }
    //     }
    //   }
  
    //   if (addedProducts.length > 0) {
    //     for (const productData of addedProducts) {
    //       delete productData._id;
    //       const stockCreated = await Stock.create([productData], { session });
    //       if (!stockCreated) {
    //         throw new Error(`Stock creation failed`);
    //       }
    //       newStockCreated.push(stockCreated[0]._id);
    //     }
    //   }
  
    //   if (deletedProducts.length > 0) {
    //     for (const product_id of deletedProducts) {
    //       const stockDeleted = await Stock.findByIdAndDelete(product_id, { session });
    //       if (!stockDeleted) {
    //         throw new Error(`Stock with ID ${product_id} not found`);
    //       }
    //       deleteStock.push(product_id);
    //     }
    //   }
  
    //   req.body._id = req.params.productId;
    //   req.body.itemDetails = req.body.products.map(product => product._id);
    //   if (newStockCreated.length > 0) {
    //     req.body.itemDetails = [...req.body.itemDetails, ...newStockCreated];
    //   }
    //   if (deleteStock.length > 0) {
    //     req.body.itemDetails = req.body.itemDetails.filter(item => !deleteStock.includes(item));
    //   }
  
    //   const updatedPurchase = await updatePurchaseAndTransaction(req.body, session);
  
    //   await session.commitTransaction();
    //   session.endSession();
  
    //   res.status(200).json(updatedPurchase);
    // } catch (error) {
    //   await session.abortTransaction();
    //   session.endSession();
    //   next(error);
    // }


  })



  .delete(cors.corsWithOptions, verifyUser, async (req, res, next) => {
    // Start a new session
    const  purchaseId  = req.params.productId; // Assuming purchaseId is sent in the request body
    let session = null;
  console.log("purchaseId", purchaseId)
    try {
      // Validate purchaseId
      if (!purchaseId || !mongoose.Types.ObjectId.isValid(purchaseId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid purchaseId is required'
        });
      }

      // Start MongoDB session and transaction
      session = await mongoose.startSession();
      session.startTransaction();

      // Find the purchase
      const purchase = await  Purchase.findById(req.params.productId).session(session);
      if (!purchase) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: 'Purchase not found'
        });
      }

      // Extract batch numbers from purchase itemDetails
      const batchNumbers = purchase.itemDetails.map(item => item.batchNumber);

      // Check if any batch number exists in Sale documents
      const saleWithBatch = await Sale.findOne({
        'saleDetail.batchNumber': { $in: batchNumbers }
      }).session(session);

      if (saleWithBatch) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Cannot delete purchase: associated batch numbers found in sales records'
        });
      }

      // Delete associated inventory records
      const inventoryDeletionResult = await Inventory.deleteMany(
        {
          batchNumber: { $in: batchNumbers }
        },
        { session }
      );

      // Delete associated transaction records
      const transactionDeletionResult = await Transaction.deleteMany(
        {
          reasonId: purchase._id,
          reason: 'purchaseInvoice'
        },
        { session }
      );

      // Delete the purchase record
      await Purchase.deleteOne(
        { _id: purchaseId },
        { session }
      );

      // Commit the transaction
      await session.commitTransaction();

      // Respond with success
      res.status(200).json({
        success: true,
        message: 'Purchase and associated records successfully deleted',
        data: {
          deletedPurchaseId: purchaseId,
          deletedInventories: inventoryDeletionResult.deletedCount,
          deletedTransactions: transactionDeletionResult.deletedCount
        }
      });

    } catch (error) {
      // Rollback transaction on error
      if (session) {
        await session.abortTransaction();
      }

      // Log error for debugging (in production, use proper logging)
      console.error('Error in delete purchase:', error);

      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the purchase',
        error: error.message
      });

    } finally {
      // End the session
      if (session) {
        session.endSession();
      }
    }
  }
);

PurchaseRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    // const find = queryBuilder(req);
    let order = 1;
    if(req.params.ordering == "desc") order = -1
    const queryBuilder =   new newQueryBuilder(req.query, req)
    .buildStringFilters()
    .buildUniqueIdentifierFilters()
    const find = queryBuilder.build();

    const nestedBuilder =   new newQueryBuilder(req.query, req)
      .buildNestedFilters()
     
    const nestedFind = nestedBuilder.build();
    console.log("req.query inside query builder inside purchase: ", find);
    try {
      const aggregatePipeline = [
        { $match: find },  // Your existing find conditions
        {
          $lookup: {
            from: "suppliers",  // Assuming your product collection is named "products"
            localField: "supplierRef",
            foreignField: "_id",
            as: "supplierInfo"
          }
        },
        { $unwind: "$supplierInfo" },  // Deconstruct the productInfo array
        {
          $match: nestedFind, 
        },
       
        {
          $addFields: {
            "supplierName": "$supplierInfo.name",
            "totalProducts": { $size: "$itemDetails" },
            // Add any other fields from the Product document you want to include
          }
        },
        {
          $project: {
            supplierInfo: 0  // Exclude the productInfo field
          }
        },
        { $sort: { createdAt: order } },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize }
      ];
      const purchase = await Purchase.aggregate(aggregatePipeline);
      const totalProducts = await Purchase.countDocuments(find);
      const totalPages = Math.ceil(totalProducts / pageSize);

      res.json({
        data: purchase,
        page,
        pageSize,
        totalItems: totalProducts,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

  // utils/batchNumberGenerator.js
const generateBatchNumber = (supplierId, date = new Date()) => {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SUP${supplierId.toString().slice(-3)}-${dateStr}-${randomStr}`;
};

  async function validateStockRefs(stockRefs) {
    // Validate input
    if (!Array.isArray(stockRefs) || stockRefs.length === 0) {
      throw new Error('Invalid stockRefs provided. Must be a non-empty array.');
    }
  
    // Validate each itemDetails is a valid ObjectId
    const validStockRefs = stockRefs.filter(itemDetails => mongoose.Types.ObjectId.isValid(itemDetails));
  
    if (validStockRefs.length !== stockRefs.length) {
      throw new Error('One or more invalid stockRefs provided');
    }
  
    // Check if the stockRefs exist in any sale's saleDetail
    const salesWithStocks = await Sale.find({
      'saleDetail.itemDetails': { $in: validStockRefs }
    }, 'saleDetail.itemDetails');
  
  
    return salesWithStocks
    
  }

module.exports = PurchaseRouter;
