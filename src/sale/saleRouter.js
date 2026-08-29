
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const saleRouter = express.Router();
const cors = require("../cors");
const Sale = require("./saleModel");
// const Inventory = require("../stock/stockModel");
const StockSale = require("./saleStockModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const Customer = require("../customer/customerModel");
const Transaction = require("../transaction/transactionModel");
const ROLES = require("../shared/rolesConstant");
const SaleHistory = require("../historyLog/saleHistoryModel");
let { editSaleTransaction} = require('../transaction/transactionCommon');
const { createInvoice } = require("../shared/invoicePDF"); 
const { updateStockAndLogSales, 
    generateInvoiceAndSendResponse,  createSaleHistoryObject, restoreStockAndRemoveSaleStock, deleteSaleAndTransaction} = require('./helpingFunctions')
var moment = require("moment");
const mongoose = require("mongoose");
const newQueryBuilder = require('../shared/newQueryBuilder')
saleRouter.use(bodyParser.json());
const Inventory = require("../inventory/inventoryModel");

saleRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    let find = queryBuilder(req);

     try {
    console.log("find inside get sale: ", find);
    Sale.find(find)
  
    .populate({
      path: 'customerRef'
    })
    .populate({
      path: 'saleDetail.productRef'
    })
      .then(
        (Sale) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Sale);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
    }
    catch(err){
        res.json(err);
    }
  })
 
  .post(cors.corsWithOptions, verifyUser, async (req, res, next) => {
    const formData = req.body;
    formData.editBy = req.user._id;
    formData.user = req.user._id;
    // formData.vendorId = req.user.vendorId;
    const session = await mongoose.startSession();
    session.startTransaction();
  
    let transactionCommitted = false;
  
    try {
      // Validate formData
      if (!((formData.customerRef && formData.customerRef._id) || formData.wCustomerName) || formData.saleDetail.length === 0 || !formData.subTotal) {
        throw new Error('formData is missing required fields (customerName, grandTotal).');
      }
  
      let allStockProductsIds = [];
      for (const productData of formData.saleDetail) {
        console.log("productData is ", productData);
        // product profit calculation
        const deliveryCharges =+productData.batchDetails?.priceAfterDeliveryCharges || 0;
        const productProfit =  productData.totalPrice - (( deliveryCharges + (+productData.batchDetails.unitPrice))* productData.saleQuantity) ;
        
        
        productData.productProfit = productProfit;
        const stock = await Inventory.findOne({ batchNumber: productData.batchNumber }).session(session);
        if (!stock) {
          throw new Error(`Inventory with ID ${productData.batchNumber} not found.`);
        }
  
        // Check if there's sufficient stock
        if (stock.totalInventory < productData.saleQuantity) {
          throw new Error(`Insufficient stock for product with ID ${productData.batchNumber}`);
        }
  
        // Subtract stock
        await stock.subtractInventory(productData.saleQuantity, session);
        console.log(`Updated stock for product ${productData.batchNumber}`);
  
        // Create StockSale entry
        if (productData.hasOwnProperty('_id')) delete productData._id;
        // let saleStock = await StockSale.create([productData], { session });
        // allStockProductsIds.push(saleStock[0]._id);
      }
  
      if (formData.walkingCustomer) {
        console.log("walkingCustomer ", formstockData.walkingCustomer);
        delete formData.customerRef;
      }
  
      // formData.saleDetail = allStockProductsIds;
  
      // Call createSaleTransaction function within the session
      const result = await createSaleTransaction(formData, session);
  
      if (!result) {
        throw new Error(`Transaction error ${result}.`);
      }
  
      // Commit the transaction
      await session.commitTransaction();
      transactionCommitted = true;
  
      // Generate invoice if transaction is successful
      console.log(": result is: ", result);
      session.endSession();
      return res.status(200).json(result);
      // createInvoice(result, '../public/invoice/' + result.orderNo + '.pdf', (doc) => {
      //   res.setHeader('Content-Disposition', 'attachment; filename=' + result.orderNo + "-report.pdf");
      //   res.statusCode = 200;
      //   res.setHeader("Content-Type", "application/pdf");
      //   doc.pipe(res);
      // });
      // res.on('finish', () => {
      //   session.endSession();
      // });

      // res.status(200).json(result);
    } catch (error) {
      // Error occurred during any operation, abort transaction only if it wasn't committed
      if (!transactionCommitted) {
        await session.abortTransaction();
      }
      console.error(error);
      res.status(500).json({ message: 'An error occurred during sale processing.', error: error.message });
    } finally {
      session.endSession();
    }
  });
  
async function createSaleTransaction(formData, session) {
  try {

    console.log("formData inside createSaleTransaction is", formData);
    // Create Sale within the session
    let sale = await Sale.create([formData], { session });

    console.log(" sale is", sale[0]._id);

    const SaleCreated = await Sale.findById(sale[0]._id)
      .populate({
        path: 'customerRef',
      })
      .populate({
        path: 'saleDetail.productRef',
      })
     .session(session);

    console.log("SaleCreated is formData Id --------------------------------", SaleCreated);

    if (!SaleCreated) {
      throw new Error('Sale creation failed');
    }

    if (!formData.walkingCustomer && formData?.updateLedger) {
      let transactionOBJ = {
        reason: "invoice",
        reasonId: SaleCreated._id,
        amount: 0,
        entityId: formData.customerRef._id,
        entityType: 'Customer',
        entityName: formData.customerRef.name,
        reasonReadableNo: SaleCreated.orderNo,
      
        transactionDate: new Date(SaleCreated.saleDate).toISOString().split('T')[0]  || new Date().toISOString().split('T')[0],
        paymentMethod: formData?.paymentMethod,
        paymentMadeBy: formData?.paymentMadeBy,
        debit: formData.totalAfterDiscount ,
        credit: formData.receivedAmount || 0,
         user: formData.user,
      // vendorId: formData.vendorId
      };

      console.log("transaction is ", transactionOBJ);

      // Create the transaction within the session
      const createdTransaction = await Transaction.create([transactionOBJ], { session });
      if (!createdTransaction) {
        throw new Error('Transaction creation failed');
      }
    }

    return SaleCreated;
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw new Error(error.message);
  }
}

//check if stock exist in sale
saleRouter
  .route("/exist")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .get(cors.corsWithOptions,async (req, res) => {

    
      try {
        req.queryType = 'sale'
        
        const queryBuilder =   new newQueryBuilder(req.query, req)
        .buildStringFilters()
        .buildUniqueIdentifierFilters()
        const find = queryBuilder.build();
        if(find.stockRef){
          find['saleDetail.itemDetails'] = mongoose.Types.ObjectId(find.stockRef)
          delete find.stockRef
        }
        console.log("find. ", find);
        // Update batch orders based on order numbers
        const result = await Sale.findOne(
          find,
        );

        
        if(!result){
          return res.status(200).json({ exist: false, data: result });
        }
        else{
          return res.status(200).json({exist:true, data: result});
        }

      
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

  saleRouter
    .route("/previousstock")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, (req, res, next) => {
      let find = req.query
      if(find.productId || find.productName === 0){
        Sale.find(find) // Filter by productId
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

    saleRouter
    .route("/invoice/.pdf")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, async(req, res, next) => {
   try{

        let withImage = req.query?.withImage || false
        console.log("withImage", withImage)
  
      const sale = await Sale.findById(req.query.id)
    
      .populate({
        path: 'customerRef'
      })
      .populate({
        path: 'saleDetail.productRef',
      })
      
    
      if (!sale) {
        throw new Error(`Sale with ID ${req.query.id} not found`);
      }
      if(withImage){
        sale.withImage = true
      }else{
        sale.withImage = false
      }
  
        createInvoice(sale,'../public/invoice/'+ sale.orderNo+'.pdf',
        (doc)=>{
          res.setHeader('Content-Disposition', 'attachment; filename='+sale.orderNo+"-report.pdf");
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
 

//export
saleRouter
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
  const totalSale = await Sale.countDocuments(find);
  const totalPages = Math.ceil(totalSale / pageSize);

  const stocks = await Sale.find(find)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  res.json({
    Sale: stocks,
    page,
    pageSize,
    totalSale,
    totalPages,
  });
} catch (error) {
 
  res.status(500).json({ error: "Internal Server Error" });
}
   
  });

  // Feedback
  saleRouter
  .route("/feedback")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .post(cors.corsWithOptions, async (req, res, next) => {
    const formData = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      if (formData.feedback === 'approved') {
        // Approve sale
        const updatedSale = await Sale.findByIdAndUpdate(
          formData.saleDetail,
          { $set: { orderStatus: 'Approved', remarks: formData.remarks } },
          { new: true, session }
        );
        if (!updatedSale) throw new Error('Sale update failed');
        
        await session.commitTransaction();
        res.json(updatedSale);
      } else if (formData.feedback === 'rejected') {
        // Reject sale and handle rollback
        const originalSale = await Sale.findById(formData.saleDetail)
          .populate('saleDetail')
          .session(session);
        
        if (!originalSale) throw new Error('Original sale not found');
        
        // Save to SaleHistory
        const saveHistory = createSaleHistoryObject(originalSale, formData.remarks);
        const saleHistory = await SaleHistory.create([saveHistory], { session });
        if (!saleHistory) throw new Error('Sale history save failed');
        
        // Restore stock and delete StockSale records
        for (const sale of originalSale.saleDetail) {
          await restoreStockAndRemoveSaleStock(sale, session);
        }
        
        // Delete sale and related transaction
        await deleteSaleAndTransaction(formData.saleDetail, session);
        
        await session.commitTransaction();
        res.status(200).json({ message: 'Sale and transaction deleted successfully.' });
      }
    } catch (err) {
      await session.abortTransaction();
      next(err);
    } finally {
      session.endSession();
    }
  })
  saleRouter
  .route("/datewise")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
  
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    try {
      const sales = await Sale.aggregate([
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

    res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  
  //********** */ Api to get sale for everyday for a whole month ************


  saleRouter
  .route("/customerproduct")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    let customerRef = req.query.customerRef;
    let productName = req.query.productName.trim();

    try {
      const sales = await Sale.find({ customerRef: customerRef })
        .sort({ date: -1 }) // Sort by date in descending order
        .populate({
          path: 'saleDetail',
          populate: {
            path: 'stockRef',
            populate: {
              path: 'productRef',
              match: { name: productName.trim() }
            }
          },
          
        })
        .exec();
        console.log("sales ---", sales.saleDetail);
      // Find the first sale where the product name matches
      let foundProduct;
      for(let sale of sales){
        const mostRecentSale = sale.saleDetail.find(sale => sale.stockRef && sale.stockRef.productRef);
        if(mostRecentSale) {
          foundProduct = sale;
        }
      }


  
      if (foundProduct) {
        res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(foundProduct);
      } else {
        res.statusCode = 404;
        res.end('Product not found');
      }
    } catch (error) {
      console.error('Error finding most recent product sale:', error);
      return null;
    }
   
  });


saleRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, verifyUser, (req, res, next) => {
    Sale.findById(req.params.productId)
  
    .populate({
      path: 'customerRef'
    })
    .populate({
      path: 'saleDetail.productRef'
    })
   
      .then(
        (Sale) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Sale);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /Sale/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions,verifyUser, async (req, res, next) => {
  
    const mongoose = require('mongoose');
    handleSaleUpdate(req, res);
    async function handleSaleUpdate(req, res) {
      const session = await mongoose.startSession();
      session.startTransaction();
    
      try {
        const formData = req.body;
        formData.user = req.user._id;
        formData._id = req.params.productId;
        console.log("formData is", formData);
        const originalSale = await Sale.findById(req.params.productId)
          .populate('customerRef')
          .populate('saleDetail.productRef')
        
          .session(session);
    
        if (!originalSale) {
          throw new Error('Sale not found');
        }
    
        // Compare original and edited sale data
        const deletedProducts = [];
        const addedProducts = [];
        const updatedProducts = [];
    
        // Check for deleted and updated products
        originalSale.saleDetail.forEach(originalProduct => {
          const updatedProduct = formData.saleDetail.find(item => 
            item.batchNumber === originalProduct.batchNumber
          );
    
          if (!updatedProduct) {
            deletedProducts.push(originalProduct);
          } else if (
            updatedProduct.saleQuantity !== originalProduct.saleQuantity ||
            updatedProduct.salePrice !== originalProduct.salePrice ||
            updatedProduct.saleDiscount !== originalProduct.saleDiscount ||
            updatedProduct.totalPrice !== originalProduct.totalPrice
          ) {
            updatedProducts.push({
              original: originalProduct,
              updated: updatedProduct
            });
          }
        });
    
        // Check for added products
        formData.saleDetail.forEach(newProduct => {
          const productProfit = ((+newProduct.batchDetails?.priceAfterDeliveryCharges || +newProduct.batchDetails.unitPrice)* newProduct.saleQuantity) - newProduct.totalPrice;
          newProduct.productProfit = productProfit;
          const existingProduct = originalSale.saleDetail.find(item => 
            item.batchNumber === newProduct.batchNumber
          );
    
          if (!existingProduct) {
            addedProducts.push(newProduct);
          }
          console.log("newProduct is", newProduct);
        });
    
        console.log('Deleted products:', deletedProducts);
        console.log('Added products:', addedProducts);
        console.log('Updated products:', updatedProducts);
    
        // Handle stock updates
        await updateStockAndBalance(deletedProducts, addedProducts, updatedProducts, formData, originalSale, session);
    
        // Update the sale
        const updatedSale = await Sale.findByIdAndUpdate(
          formData._id,
          { $set: formData },
          { new: true, session }
        ).populate('customerRef')
         .populate({
           path: 'saleDetail.productRef',
         })
       
    
        if (!updatedSale) {
          throw new Error('Sale update failed');
        }
    
        // Handle customer transaction if not a walking customer
        if (!formData.walkingCustomer) {
          const transactionOBJ = {
            reason: "editInvoice",
            reasonId: updatedSale._id,
            amount: 0,
            entityId: formData.customerRef._id,
            entityName: formData.customerRef.name,
            entityType: 'Customer',
            reasonReadableNo: updatedSale.orderNo,
            paymentMethod: formData?.paymentMethod,
            transactionDate:  new Date(formData.saleDate).toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
            paymentMadeBy: formData?.paymentMadeBy,
            debit: formData.totalAfterDiscount,
            credit: formData.receivedAmount || 0
          };
          console.log("transactionOBJ  ",transactionOBJ)
    
          await Transaction.findOneAndUpdate(
            { reasonId: formData._id },
            transactionOBJ,
            { session, upsert: true, new: true }
          );
        }
    
        await session.commitTransaction();
        session.endSession();
        res.status(200).json(updatedSale);
        // Generate and send invoice
        // createInvoice(updatedSale, '../public/invoice/' + updatedSale.orderNo + '.pdf',
        //   (doc) => {
        //     res.setHeader('Content-Disposition', 'attachment; filename=' + updatedSale.orderNo + "-report.pdf");
        //     res.statusCode = 200;
        //     res.setHeader("Content-Type", "application/pdf");
        //     doc.pipe(res);
        //   }
        // );
    
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error updating sale:', error);
        res.status(500).json({ error: error.message });
      }
    }
  
  })

  .delete(cors.corsWithOptions, verifyUser,async (req, res, next) => {
    //addd stock back to stock
    const mongoose = require('mongoose');

    try {
      const session = await mongoose.startSession();
      session.startTransaction();
    
      try {
        // Find the original sale
        const originalSale = await Sale.findById(req.params.productId)
          .populate('saleDetail')
          .session(session);
    
        if (!originalSale) {
          throw new Error('Sale not found');
        }
    
        // Add stock back to inventory
        for (const sale of originalSale.saleDetail) {
          console.log("sale is", sale);
          const stock = await Inventory.findOne({ batchNumber: sale.batchNumber }).session(session);
          if (!stock) {
            throw new Error(`Inventory not found for product: ${sale.productRef}`);
          }
          try {
            await stock.addInventory(sale.saleQuantity);
            console.log(`Added ${sale.saleQuantity} back to stock for product ${sale.productRef}`);
          } catch (stockError) {
            console.error(`Error adding stock for product ${sale.productRef}:`, stockError);
            throw new Error(`Failed to add stock for product ${sale.productRef}: ${stockError.message}`);
          }
        }
    
        // Delete the sale
        const deletedSale = await Sale.findByIdAndRemove(req.params.productId).session(session);
        if (!deletedSale) {
          throw new Error('Failed to delete sale');
        }
        console.log("Deleted sale:", deletedSale._id);
    
        // Delete associated transaction
        const deletedTransaction = await Transaction.findOneAndRemove({ reasonId: req.params.productId }).session(session);
        if (!deletedTransaction) {
          console.log('No associated transaction found');
        } else {
          console.log('Associated transaction deleted:', deletedTransaction._id);
        }
    
        // Commit the transaction
        await session.commitTransaction();
        session.endSession();
    
        res.status(200).json({ message: 'Sale and associated data deleted successfully.' });
      } catch (error) {
        // If an error occurs, abort the transaction
        await session.abortTransaction();
        session.endSession();
        console.error('Error in delete operation:', error);
        res.status(500).json({ error: error.message });
      }
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error in delete operation:', error);
      res.status(500).json({ error: error.message });
    }
    });



// Function to update stock and balance
async function updateStockAndBalance(deletedProducts, addedProducts, updatedProducts, formData, originalSale, session) {
  try {
    // Handle deleted products
    for (const product of deletedProducts) {
      console.log("Handling deleted product:", product);
      const stock = await Inventory.findOne({batchNumber: product.batchNumber }).session(session);
      if (!stock) {
        throw new Error(`Inventory not found for deleted product: ${ product.batchNumber}`);
      }
      await stock.addInventory(product.saleQuantity,session);
      console.log(`Added ${product.saleQuantity} to stock for product ${ product.batchNumber}`);
    }

    // Handle added products
    for (const product of addedProducts) {
      console.log("Handling added product:", product);
      const stock = await Inventory.findOne({ batchNumber: product.batchNumber }).session(session);
      if (!stock) {
        throw new Error(`Inventory not found for added product: ${ product.batchNumber}`);
      }
      await stock.subtractInventory(product.saleQuantity,session);
      console.log(`Subtracted ${product.saleQuantity} from stock for product ${ product.batchNumber}`);
    }

    // Handle updated products
    for (const { original, updated } of updatedProducts) {
      console.log("Handling updated product:", original, updated);
      const stock = await Inventory.findOne({batchNumber: original.batchNumber }).session(session);
      if (!stock) {
        throw new Error(`Inventory not found for updated product: ${original.batchNumber}`);
      }

      const quantityDifference = updated.saleQuantity - original.saleQuantity;
      if (quantityDifference < 0) {
        // More stock sold in the original sale, so add back to stock
        await stock.addInventory(Math.abs(quantityDifference),session );
        console.log(`Added ${Math.abs(quantityDifference)} to stock for product ${original.batchNumber}`);
      } else if (quantityDifference > 0) {
        // More stock sold in the updated sale, so subtract from stock
        await stock.subtractInventory(quantityDifference,session);
        console.log(`Subtracted ${quantityDifference} from stock for product ${original.batchNumber}`);
      }
      // If quantityDifference is 0, no stock adjustment is needed
    }

    console.log("Inventory updates completed successfully");
  } catch (error) {
    console.error("Error in updateStockAndBalance:", error);
    throw error; // Re-throw the error to be caught in the main transaction
  }
}



saleRouter
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
    console.log("find inside pagination sale", find , 'nested ', nestedFind);
    
            try {
              const aggregatePipeline =  [
          { $match: find },

          // Lookup customer
          {
            $lookup: {
              from: "customers",
              localField: "customerRef",
              foreignField: "_id",
              as: "customerRef"
            }
          },
          { $unwind: "$customerRef" },

          { $match: nestedFind },

           {
            $lookup: {
              from: "payments",
              localField: "paymentMethod",
              foreignField: "_id",
              as: "paymentMethod"
            }
          },
           { $unwind: "$paymentMethod" },
          // {
          //   $addFields: {
          //     customerName: "$customerInfo.name"
          //   }
          // },
          { $project: { customerInfo: 0 } },

          // 🔥 NEW: Lookup full product details
          {
            $lookup: {
              from: "products",
              localField: "saleDetail.productRef",
              foreignField: "_id",
              as: "productDetails"
            }
          },
          {
            $addFields: {
              saleDetail: {
                $map: {
                  input: "$saleDetail",
                  as: "sd",
                  in: {
                    $mergeObjects: [
                      "$$sd",
                      {
                        productRef: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$productDetails",
                                as: "pd",
                                cond: { $eq: ["$$pd._id", "$$sd.productRef"] }
                              }
                            },
                            0
                          ]
                        }
                      }
                    ]
                  }
                }
              }
            }
          },
          { $project: { productDetails: 0 } },

          // Sorting & Pagination
          { $sort: { createdAt: order } },
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize }
        ];
      const sales = await Sale.aggregate(aggregatePipeline);
      const totalProducts = await Sale.countDocuments(find);
      const totalPages = Math.ceil(totalProducts / pageSize);

      res.json({
        data: sales,
        page,
        pageSize,
        totalItems:totalProducts,
        totalPages,
      });
    } catch (error) {
     console.log("Error: ", error);
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

  //for multiple Sale some together before send to the client with pagination
  /*
  const aggregateQuery = [
    {
      $match: {
        $and: [
          { totalInventory: { $gt: 0 } }, // Quantity greater than 0
          find // Additional conditions if any
        ]
      }
    },
    {
      $group: {
        _id: "$productId",
        totalQuantity: { $sum: "$totalInventory" },
        count: { $sum: 1 } // Count the number of documents for each productId
      }
    },
    {
      $addFields: {
        multipleStock: { $gt: ["$count", 1] } // Flag indicating multiple Sale
      }
    },
    {
      $sort: { totalQuantity: -1 } // Sort by totalQuantity in descending order
    },
    {
      $skip: (page - 1) * pageSize // Pagination - skip documents
    },
    {
      $limit: pageSize // Limit number of documents returned
    }
  ];
  
  const stocks = await Sale.aggregate(aggregateQuery);
  
  res.json({
    Sale: stocks,
    page,
    pageSize,
    totalSale: stocks.length, // Using the length of the aggregated results
    totalPages: Math.ceil(stocks.length / pageSize) // Adjust totalPages accordingly
  });
  */

module.exports = saleRouter;
