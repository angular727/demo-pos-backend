// stockRouter.js
const express = require('express');
const router = express.Router();
const Transaction = require("./transactionModel");
const Customer = require("../customer/customerModel");
const Sale = require("../sale/saleModel");
const Stock = require("../stock/stockModel");
const Purchase = require("../purchaseInvoice/puchaseModel");
const mongoose = require('mongoose');
const User = require('../users/userModel');
// Function to update stock


async function createSaleTransaction(formData, session) {
  try {


    // Create Sale within the session
    let sale = await Sale.create([formData], { session });
    const SaleCreated = await Sale.findById(sale._id)
      .populate({
        path: 'customerRef',
      })
      .populate({
        path: 'saleRef',
        populate: {
          path: 'stockRef',
          populate: {
            path: 'productRef'
          }
        }
      }).session(session);

  

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
        paymentMethod: formData?.paymentMethod,
        paymentMadeBy: formData?.paymentMadeBy,
        transactionDate: SaleCreated?.saleDate || new Date().toISOString(),
        debit: formData.totalAfterDiscount + (formData?.deliveryCharges || 0),
        credit: formData.receivedAmount || 0,
         user: formData.user,
      // vendorId: formData.vendorId
      };

  

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
  

// Modified saleReturn function to accept session parameter
async function saleReturn(formData, session) {
  try {
    const saleUpdated = await Sale.findByIdAndUpdate(
      formData._id,
      { saleReturn: true, saleReturnRef: formData.saleReturnRef },
      { new: true, session } // Pass session to the update operation
    );

    if (!saleUpdated) {
      throw new Error('Sale update failed');
    }

    let transactionNeeded = true;

    if (formData.walkingCustomer) {
      transactionNeeded = false;
      return { saleUpdated: formData };
    }

    let transactionOBJ = {
      reason: "saleReturn",
      reasonId: formData._id,
      amount: 0,
      entityId: formData.customerRef._id,
      entityType: 'Customer',
      entityName: formData.customerRef.name,
      reasonReadableNo: formData.orderNo,
      paymentMethod: formData?.paymentMethod,
      paymentMadeBy: formData?.paymentMadeBy,
        transactionDate: formData?.saleDate || new Date().toISOString(),
      debit: 0,
      credit: formData.totalReturnAmount || 0,
      user: formData.user,
      // vendorId: formData.vendorId

    };


    if (transactionNeeded) {
      // Create transaction within the session
      const createdTransaction = await Transaction.create([transactionOBJ], { session });
      
      if (!createdTransaction?.[0]) {
        throw new Error('Transaction creation failed');
      }
    }

    return transactionOBJ ;
  } catch (error) {
    console.error('Error in saleReturn:', error);
    throw error; // Propagate error to trigger transaction rollback
  }
}

  async function editSaleTransaction(formData) {
    try {
      let transactionNeeded = true;
      // let customerUpdate = {amountPayable:0,amountAdvanced:0}
     
   
       
      const sale = await Sale.findByIdAndUpdate(formData._id, { $set: formData },{ new: true });
      const SaleCreated = await sale
       .populate({
         path: 'customerRef',
         path: 'saleRef',
         populate: {
           path: 'stockRef',
           populate: {
             path: 'productRef'
           }
         }
       })
  
      if (!SaleCreated) {
        throw new Error('Sale creation failed');
      }
          let transactionOBJ = {
            reason:"editInvoice",
            reasonId : SaleCreated._id,
            amount : 0,
            entityId  : formData.customerRef._id,
            entityName: formData.customerRef.name,
            entityType  :'Customer',
            reasonReadableNo : SaleCreated.orderNo,
            paymentMethod:formData?.paymentMethod,
            paymentMadeBy:formData?.paymentMadeBy,
             transactionDate: formData?.saleDate || new Date().toISOString(),
            debit:formData.totalAfterDiscount + (formData?.deliveryCharges || 0),
            credit: formData.receivedAmount || 0
          }
          if(!formData.walkingCustomer){
        
            // Create the transaction
            if(transactionNeeded){
              const updateTransaction = await Transaction.findOneAndUpdate({reasonId:formData._id},transactionOBJ);

            if (!updateTransaction) {
              throw new Error('createdTransaction creation failed');
            }
            }
           
    
            }else{
              transactionNeeded = false
            }
     
   
  
      return SaleCreated ;
    } catch (error) {
      console.error('Error creating transaction:', error);
      return { status: 'error', error: error.message };
    }
  }
  

  async function purchaseReturn(formData) {


    try {


      const saleUpdated = await Purchase.findByIdAndUpdate(
        formData._id,
        {purchaseReturn:true},
        { new: true }
      );

      if (!saleUpdated) {
        throw new Error('Sale creation failed');
      }
      let transactionNeeded = true;
      // let customerUpdate = {amountPayable:0,amountAdvanced:0}
  
      let transactionOBJ = {
        reason:"purchaseReturn",
        reasonId : formData.StockRef,
        amount : 0,
        entityType  :'Supplier',
        entityId  : formData.supplierRef,
        reasonReadableNo : formData.stockNo,
        entityName: formData.supplierRef?.name,
        // paymentMethod:formData?.paymentMethod,
        // paymentMadeBy:formData?.paymentMadeBy,
          transactionDate: formData?.purchaseDate || new Date().toISOString(),
        debit:0,
        credit: formData.returnedAmmount || 0,
         user: formData.user,
      // vendorId: formData.vendorId
      }
   

      // Create the transaction
        if(transactionNeeded){
        const  createdTransaction = await Transaction.create(transactionOBJ);
        if (!createdTransaction) {
          throw new Error('createdTransaction creation failed');
        }
      }

      return { ...transactionOBJ };
    } catch (error) {
      console.error('Error creating transaction:', error);
      return { status: 'error', error: error.message };
    }
  }

  //opening balance
  // Example 2: Get opening balance with entity details
async function getOpeningBalanceWithEntityDetails(entityId, beforeDate) {
    try {
        const result = await Transaction.aggregate([
            {
                $match: {
                    entityId: new mongoose.Types.ObjectId(entityId),
                    transactionDate: { $lt: new Date(beforeDate) }
                }
            },
            {
                $group: {
                    _id: {
                        entityId: "$entityId",
                        entityType: "$entityType",
                        // entityName: "$entityName"
                    },
                    totalDebit: { $sum: "$debit" },
                    totalCredit: { $sum: "$credit" },
                    transactionCount: { $sum: 1 }
                }
            },
            {
                $addFields: {
                    openingBalance: { $subtract: ["$totalDebit", "$totalCredit"] }
                }
            }
        ]);

        if (result.length === 0) {
            return {
                entityId,
                totalDebit: 0,
                totalCredit: 0,
                openingBalance: 0,
                transactionCount: 0
            };
        }

        return {
            entityId: result[0]._id.entityId,
            entityType: result[0]._id.entityType,
            entityName: result[0]._id.entityName,
            totalDebit: result[0].totalDebit,
            totalCredit: result[0].totalCredit,
            openingBalance: result[0].openingBalance,
            transactionCount: result[0].transactionCount
        };
    } catch (error) {
        console.error('Error calculating opening balance with details:', error);
        throw error;
    }
}



  module.exports = { createSaleTransaction,saleReturn,purchaseReturn,editSaleTransaction, getOpeningBalanceWithEntityDetails };
   //   if (transaction.type === 'Debit') {
      //     // If it's a debit transaction (customer needs to pay), update amountPayable
      //     customerUpdate = {
      //         amountPayable: Math.max(0, customerFound.amountPayable + transaction.amount),
      //         amountAdvanced: customerFound.amountAdvanced || 0
      //     };
      // } else if (transaction.type === 'Credit') {
      //     // If it's a credit transaction (customer paid in advance), update amountPayable and amountAdvanced
      //     const remainingAmount = Math.max(0, customerFound.amountPayable - transaction.amount); // Calculate remaining amount to pay
      //     const excessAmount = Math.max(0, transaction.amount - customerFound.amountPayable); // Calculate excess amount paid
      
      //     customerUpdate = {
      //         amountPayable: remainingAmount,
      //         amountAdvanced: customerFound.amountAdvanced + excessAmount
      //     };
      // }