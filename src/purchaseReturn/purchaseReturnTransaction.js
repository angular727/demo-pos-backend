const express = require('express');

const Transaction = require("../transaction/transactionModel");

const PurchaseReturn = require("./purchaseReturn");

async function createPurchaseReturnTransaction(formData, session) {
    try {
      // Create purchase with session
      const createdPurchase = await PurchaseReturn.create([formData], { session });
      
      if (!createdPurchase || createdPurchase.length === 0) {
        throw new Error('Purchase creation failed');
      }
  
      const purchaseDoc = createdPurchase[0]; // Get the created purchase document
  
      console.log("Created Purchase ID:", purchaseDoc._id);
  
      // Prepare transaction object
      const transactionOBJ = {
        reason: "purchaseReturn",
        reasonId: purchaseDoc._id,
        amount: formData.totalReturnPricing,
        entityId: formData.supplierRef._id,
        entityType: 'Supplier',
        entityName: formData.supplierName,
        reasonReadableNo: purchaseDoc.invoiceNo,
        transactionDate: purchaseDoc.transactionDate || new Date().toISOString().split('T')[0],
        paymentMethod: formData?.paymentMethod,
        paymentMadeBy: formData?.paymentMadeBy,
        debit: 0,
        credit: formData.totalReturnPricing,
        
        user: formData.user,
        vendorId: formData.vendorId
      };
  
      console.log("Creating transaction:", transactionOBJ);
  
      // Create transaction with session
      const createdTransaction = await Transaction.create([transactionOBJ], { session });
  
      if (!createdTransaction || createdTransaction.length === 0) {
        throw new Error('Transaction creation failed');
      }
  
      
      return purchaseDoc
  
    } catch (error) {
      console.error('Error in createPurchaseAndTransaction:', error);
      throw error; // Propagate error to parent for transaction rollback
    }
  }
  module.exports = { createPurchaseReturnTransaction};
