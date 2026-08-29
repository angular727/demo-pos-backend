const express = require('express');

const Transaction = require("../transaction/transactionModel");

const Purchase = require("./puchaseModel");

async function createPurchaseAndTransaction(formData, session) {
    try {
      // Create purchase with session
      const createdPurchase = await Purchase.create([formData], { session });
      
      if (!createdPurchase || createdPurchase.length === 0) {
        throw new Error('Purchase creation failed');
      }
  
      const purchaseDoc = createdPurchase[0]; // Get the created purchase document
  
      console.log("Created Purchase ID:", purchaseDoc._id);
  
      // Prepare transaction object
      const transactionOBJ = {
        reason: "purchaseInvoice",
        reasonId: purchaseDoc._id,
        amount: formData.totalAfterDiscount,
        entityId: formData.supplierRef._id,
        entityType: 'Supplier',
        entityName: formData.supplierRef.name,
        reasonReadableNo: purchaseDoc.invoiceNo,
        transactionDate: purchaseDoc.transactionDate || new Date().toISOString().split('T')[0],
        paymentMethod: formData?.paymentMethod,
        paymentMadeBy: formData?.paymentMadeBy,
        debit: formData.totalAfterDiscount,
        credit: formData.paidAmount || 0,
        user: formData.user,
        vendorId: formData.vendorId
      };
  
      console.log("Creating transaction:", transactionOBJ);
  
      // Create transaction with session
      const createdTransaction = await Transaction.create([transactionOBJ], { session });
  
      if (!createdTransaction || createdTransaction.length === 0) {
        throw new Error('Transaction creation failed');
      }
  
      
      return {
        success: true,
        data:purchaseDoc
      };
  
    } catch (error) {
      console.error('Error in createPurchaseAndTransaction:', error);
      throw error; // Propagate error to parent for transaction rollback
    }
  }


  //update Transaction
  async function updatePurchaseAndTransaction(formData, session) {
    try {
      // Find and update the purchase
      const createdPurchase = await Purchase.findByIdAndUpdate(
        formData._id,
        { $set: formData },
        { new: true, session }
      );
  
      if (!createdPurchase) {
        throw new Error('Purchase update failed');
      }
  
      // Prepare the transaction object
      let transactionOBJ = {
        reason: "purchaseInvoice",
        reasonId: createdPurchase._id,
        amount: 0,
        entityId: formData.supplierRef._id,
        entityType: 'Supplier',
        entityName: formData.supplierRef.name,
        reasonReadableNo: createdPurchase.invoiceNo,
        transactionDate: createdPurchase.transactionDate || new Date().toISOString().split('T')[0],
        paymentMethod: formData?.paymentMethod,
        paymentMadeBy: formData?.paymentMadeBy,
        debit: formData.totalAfterDiscount,
        credit: formData.paidAmount || 0,
      };
  
      // Update or create the transaction
      const updateTransaction = await Transaction.findOneAndUpdate(
        { reasonId: formData._id },
        transactionOBJ,
        { session, new: true, upsert: true }
      );
  
      if (!updateTransaction) {
        throw new Error('Transaction creation failed');
      }
  
      return createdPurchase;
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  }
  module.exports = { createPurchaseAndTransaction, updatePurchaseAndTransaction};
