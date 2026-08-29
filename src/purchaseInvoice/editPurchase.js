const express = require('express');
const mongoose = require('mongoose');

const Purchase = require('./puchaseModel');
const Sale = require('../sale/saleModel');
const Inventory = require("../inventory/inventoryModel");
const Transaction = require("../transaction/transactionModel");

const editPurchase = async (req, res, next) => {
  const purchaseId = req.params.productId;
  const updateData = req.body;
  updateData.editBy = req.user._id; // Attach user ID from authenticated user
  updateData.vendorId = req.user.vendorId;
  let session = null;

  try {
    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // 1. Get and validate original purchase
    const originalPurchase = await Purchase.findById(purchaseId)
      .populate('itemDetails.productRef');
    if (!originalPurchase) {
      throw new Error('Purchase not found');
    }

    // 2. Compare and categorize items
    const {
      newItems,
      removedItems,
      modifiedItems
    } = compareItemDetails(originalPurchase.itemDetails, updateData.itemDetails);

    // 3. Validate price changes before processing
    validatePriceChanges(originalPurchase.itemDetails, updateData.itemDetails);

    // 4. Validate inventory constraints for modified items
    for (const item of modifiedItems) {
      if (item.newQuantity < item.oldQuantity) {
        const inventory = await Inventory.findOne({ 
          batchNumber: item.batchNumber 
        });
       
        const availableStock = inventory.totalInventory - 
          (item.oldQuantity - item.newQuantity);
        
        if (availableStock < 0) {
          throw new Error(
            `Cannot reduce quantity for batch ${item.batchNumber} as stock is in use`
          );
        }
  
      }
    }

    // 5. Validate removable items - check if they've been sold
    for (const item of removedItems) {
      const saleExists = await Sale.findOne({
        'saleDetail.batchNumber': item.batchNumber
      });
      
      if (saleExists) {
        throw new Error(
          `Cannot remove item with batch ${item.batchNumber} as it has been sold`
        );
      }
    }

    // 6. Process new items
    const newInventories = [];

    for (const item of newItems) {
      // Generate batch number for new items
      // const batchNumber = generateBatchNumber(
      //   updateData.supplierId || 1,
      //   updateData.purchaseDate
      // );
      delete item._id
     
      // Validate new item data
      if (!item.productRef || !item.totalUnits) {
        throw new Error('Required fields missing for new item');
      }

      const batchObj = {
        ...item,
        // batchNumber,
        productRef: item.productRef._id,
        productId: item.productRef.productId,
        totalInventory: item.totalUnits,
        productName: item.productRef.name,
        description: item.description,
        user:updateData.user,
        vendorId:updateData.vendorId
        
      };
     

      // Create new inventory
      const inventoryCreated = await Inventory.create([batchObj], { session });
      newInventories.push(inventoryCreated[0]);
    }

   // 7. Process removed items - Changed from Promise.all to sequential processing
    for (const item of removedItems) {
      await Inventory.deleteOne({ batchNumber: item.batchNumber }, { session });
   }
 
 
    // 8. Process modified items - update inventory
    for (const item of modifiedItems) {
      const difference = item.newQuantity - item.oldQuantity;
    
      // const findInventory = await Inventory.findOne({ batchNumber: item.batchNumber })
      await Inventory.updateOne(
        { batchNumber: item.batchNumber },
        { 
          $inc: { totalInventory: difference },
          $set: {
             user:updateData.user,
            unitPrice: item.newData.unitPrice,
            salePrice: item.newData.salePrice,
            // totalPrice: (item.newData.unitPrice * (findInventory.totalInventory + difference)) * (1 - (item.newData.discount / 100)),          
            caseQuantity: item.newData.caseQuantity,
            productRef: item.newData.productRef._id,
            productId: item.newData.productRef.productId,
            productName: item.newData.productRef.name,
            saleDiscount: item.newData?.saleDiscount || 0,
            unitPerCase: item.newData.unitPerCase,
            priceAfterDeliveryCharges: item.newData.priceAfterDeliveryCharges,
            discount: item.newData.discount,
            stockBarCode: item.newData.stockBarCode,
            


          }
        },
        { session }
      );
    }

    // 9. Calculate price difference and update payment
    // const originalTotal = calculateTotal(originalPurchase.itemDetails);
    // const newTotal = calculateTotal(updateData.itemDetails);
    const priceDifference = updateData.remainingAmount - originalPurchase.remainingAmount ;

    if (priceDifference !== 0) {
        const debit = priceDifference > 0 ? priceDifference :0;
        const credit = priceDifference < 0 ? Math.abs(priceDifference) : 0;
        const transactionOBJ = {
            reason: "editInvoice",
            reasonId: originalPurchase._id,
            amount: 0,
            entityId: updateData.supplierRef._id,
            entityType: 'Supplier',
            entityName: updateData.supplierRef.name,
            reasonReadableNo: updateData.invoiceNo,
            paymentMethod: updateData?.paymentMethod,
            paymentMadeBy: updateData?.paymentMadeBy,
            debit: debit,
            credit: credit,
            user: updateData.user,
            vendorId: updateData.vendorId
          };

          await Transaction.create([transactionOBJ], { session });
 

     
    }


    function makeUpdatedItem(newItems,
      removedItems,
      modifiedItems) {

      const new_Items = newItems.map(item => ({ ...item})) 
      const modifiedI_tems = modifiedItems.map(item => ({ ...item.newData }))
      const filterOrignal_Items = originalPurchase.itemDetails.filter(item => 
        !removedItems.find(ri => (ri.batchNumber === item.batchNumber || !ri.batchNumber))
    
  
     &&
        !modifiedItems.find(ri => ri.batchNumber === item.batchNumber)
      )
  
      return  {
        ...updateData,
        itemDetails: [
          ...filterOrignal_Items,
         ...modifiedI_tems,
        
         ...new_Items,
        ],
    
      }
  
    }
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      purchaseId,
      makeUpdatedItem(newItems,
        removedItems,
        modifiedItems)
     ,
      { new: true, session }
    );
   
    // Commit transaction if everything succeeded
    await session.commitTransaction();

    return {
      success: true,
      data: updatedPurchase,
      newInventories,
      priceDifference
    }

  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    return {
      success: false,
      message: 'Purchase update failed',
      error: error.message
    }
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

// Helper functions
function compareItemDetails(originalItems, updatedItems) {
  // console.log("item in originalItems updatedItems------------------- ", updatedItems,originalItems);
  const originalMap = new Map(
    originalItems.map(item => [item.batchNumber, item])
  );
  
  const newItems = [];
  const modifiedItems = [];
  const removedItems = [];

  // Find new and modified items
  updatedItems.forEach(item => {
   
    if (!item.batchNumber) {
      item.batchNumber = generateBatchNumber(updatedItems.supplierId || 1, item.purchaseDate);
      newItems.push(item);
    } else {
      const originalItem = originalMap.get(item.batchNumber);
        console.log("item in originalItem------------------- ",originalItem, item);
      if (originalItem) {
        if (
          originalItem.totalUnits !== item.totalUnits ||
          originalItem.purchasePrice !== item.purchasePrice ||
          originalItem.salePrice !== item.salePrice ||
          originalItem.unitPrice !== item.unitPrice ||
          originalItem.discount !== item.discount ||
          originalItem.priceAfterDeliveryCharges !== item.priceAfterDeliveryCharges ||
          originalItem.unitPriceAfterDisc !== item.unitPriceAfterDisc ||
          originalItem.expiryDate !== item.expiryDate ||
          originalItem.description !== item.description || originalItem.saleDiscount !== item.saleDiscount
          || originalItem.user !== item.user || originalItem.stockBarCode !== item.stockBarCode
          
        ) {
          modifiedItems.push({
            batchNumber: item.batchNumber,
            oldQuantity: originalItem.totalUnits,
            newQuantity: item.totalUnits,
            newData: item,
            user:item.user
          });
        }
        originalMap.delete(item.batchNumber);
      }
    }
  });

  // Remaining items in originalMap are removed items
  originalMap.forEach(item => {
    removedItems.push(item);
  });
console.log("item in modifiedItems ------------------- ", modifiedItems);
  return { newItems, removedItems, modifiedItems };
}

// function calculateTotal(items) {
//   return items.reduce((sum, item) => 
//     sum + (+item.unitPrice * +item.totalUnits), 0
//   );
// }

function validatePriceChanges(originalItems, updatedItems) {
  for (const item of updatedItems) {
    // if (!item.batchNumber) continue; // Skip new items

    // const originalItem = originalItems.find(
    //   oi => oi.batchNumber === item.batchNumber
    // );
    
    // if (originalItem) {
    //   // Check for maximum allowed price reduction (e.g., 50%)
    //   if (item.purchasePrice < originalItem.purchasePrice * 0.5) {
    //     throw new Error(
    //       `Price reduction for ${item.batchNumber} exceeds allowed limit of 50%`
    //     );
    //   }

    //   // Check for maximum allowed price increase (e.g., 100%)
    //   if (item.purchasePrice > originalItem.purchasePrice * 2) {
    //     throw new Error(
    //       `Price increase for ${item.batchNumber} exceeds allowed limit of 100%`
    //     );
    //   }

      // Validate sale price is higher than purchase price
      if (item.salePrice <= item.purchasePrice) {
        throw new Error(
          `Sale price must be higher than purchase price for ${item.batchNumber}`
        );
      }
    // }
  }
}
const generateBatchNumber = (supplierId, date = new Date()) => {
  try {
      const dateObject = date instanceof Date ? date : new Date(date);
      
      // Check if date is valid
      if (isNaN(dateObject.getTime())) {
          throw new Error('Invalid date');
      }

      const dateStr = dateObject.toISOString().split('T')[0].replace(/-/g, '');
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `SUP${supplierId.toString().slice(-3)}-${dateStr}-${randomStr}`;
  } catch (error) {
      console.error('Error generating batch number:', error);
      // You can either throw the error or return a default value
      throw error;
      // Or return a default with current date:
      // return generateBatchNumber(supplierId, new Date());
  }
};
module.exports = editPurchase;