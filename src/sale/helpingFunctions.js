 
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const saleRouter = express.Router();
const cors = require("../cors");
const Sale = require("./saleModel");
const Stock = require("../stock/stockModel");
const StockSale = require("./saleStockModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const Customer = require("../customer/customerModel");
const Transaction = require("../transaction/transactionModel");
const ROLES = require("../shared/rolesConstant");
const SaleHistory = require("../historyLog/saleHistoryModel");
let { editSaleTransaction} = require('../transaction/transactionCommon');
const { createInvoice } = require("../shared/invoicePDF"); 
 
 async function updateStockAndLogSales(saleRefArray, session) {
    const allStockProductsIds = [];
  
    for (const productData of saleRefArray) {
      const stock = await Stock.findById(productData.stockRef._id).session(session);
      if (!stock) {
        throw new Error(`Stock with ID ${productData.stockRef._id} not found.`);
      }
  
      // Check for sufficient stock and update
      if (stock.totalStock < productData.saleQuantity) {
        throw new Error(`Insufficient stock for product with ID ${productData.stockRef._id}`);
      }
  
      await stock.subtractStock(productData.saleQuantity, session);
      console.log(`Updated stock for product ${productData.stockRef._id}`);
  
      // Create StockSale entry
      delete productData._id; // Ensure no _id in productData for creation
      let saleStock = await StockSale.create([productData], { session });
      allStockProductsIds.push(saleStock._id);
    }
  
    return allStockProductsIds;
  }


  
  async function createSaleTransaction(formData, session) {
    formData.customerRef = formData.customerRef._id;
    console.log("form data is", formData);
    const sale = await Sale.create([formData], { session: session });
    const saleCreated = await Sale.findById(sale._id)
      .populate({
        path: 'customerRef',
      })
      .populate({
        path: 'saleRef',
        populate: {
          path: 'stockRef',
          populate: {
            path: 'productRef',
          },
        },
      })
      .session(session);
  
    if (!saleCreated) {
      throw new Error('Sale creation failed');
    }
  
    // Handle customer ledger if necessary
    if (!formData.walkingCustomer && formData?.updateLedger) {
      await createCustomerTransaction(saleCreated, formData, session);
    }
  
    return saleCreated;
  }


  
  async function createCustomerTransaction(saleCreated, formData, session) {
    const transactionObj = {
      reason: "invoice",
      reasonId: saleCreated._id,
      amount: 0,
      entityId: formData.customerRef._id,
      entityType: 'Customer',
      entityName: formData.customerRef.name,
      reasonReadableNo: saleCreated.orderNo,
      paymentMethod: formData?.paymentMethod,
      paymentMadeBy: formData?.paymentMadeBy,
      debit: formData.totalAfterDiscount + (formData?.deliveryCharges || 0),
      credit: formData.receivedAmount || 0,
    };
  
    console.log("Creating transaction:", transactionObj);
    const createdTransaction = await Transaction.create([transactionObj], { session });
  
    if (!createdTransaction) {
      throw new Error('Transaction creation failed');
    }
  }

  async function generateInvoiceAndSendResponse(saleResult, res) {
    createInvoice(saleResult, '../public/invoice/' + saleResult.orderNo + '.pdf', (doc) => {
      res.setHeader('Content-Disposition', 'attachment; filename=' + saleResult.orderNo + "-report.pdf");
      res.status(200);
      res.setHeader("Content-Type", "application/pdf");
      doc.pipe(res);
    });
  }



// Helper function to create SaleHistory object
function createSaleHistoryObject(originalSale, remarks) {
    const saveHistory = {
      orderNo: originalSale.orderNo,
      totalAfterDiscount: originalSale.totalAfterDiscount,
      remarks: remarks,
      orderStatus: 'Rejected',
      customerRef: originalSale.customerRef,
      saleRef: []
    };
    
    originalSale.saleRef.forEach(sale => {
      saveHistory.saleRef.push({
        saleQuantity: sale.saleQuantity,
        totalDiscount: sale.totalDiscount,
        totalPrice: sale.totalPrice,
        stockRef: sale.stockRef._id,
        salePrice: sale.salePrice,
        saleDiscount: sale.saleDiscount
      });
    });
    
    return saveHistory;
  }
  
  // Helper function to restore stock and remove StockSale record
  async function restoreStockAndRemoveSaleStock(sale, session) {
    const stock = await Stock.findById(sale.stockRef).session(session);
    if (!stock) throw new Error(`Stock not found for ID ${sale.stockRef}`);
    
    await stock.addStock(sale.saleQuantity).session(session);
    const deletedSaleStock = await StockSale.findByIdAndRemove(sale._id).session(session);
    if (!deletedSaleStock) throw new Error('Failed to delete sale stock');
  }
  
  // Helper function to delete sale and related transaction
  async function deleteSaleAndTransaction(saleRefId, session) {
    const deletedSale = await Sale.findByIdAndRemove(saleRefId).session(session);
    if (!deletedSale) throw new Error('Failed to delete sale');
    
    const deletedTransaction = await Transaction.findOneAndRemove({ reasonId: saleRefId }).session(session);
    if (!deletedTransaction) throw new Error('Transaction not found');
    
    console.log('Sale and transaction deleted successfully');
  }







  module.exports = { updateStockAndLogSales, createSaleTransaction, createCustomerTransaction,
     generateInvoiceAndSendResponse, createSaleHistoryObject, restoreStockAndRemoveSaleStock, deleteSaleAndTransaction }