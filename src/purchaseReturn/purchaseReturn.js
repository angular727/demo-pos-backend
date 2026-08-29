const mongoose = require("mongoose");

const purchaseReturnSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
     vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true
            
          },
    purchaseRef:{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      required:true
    },
    supplierRef:{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required:true
    },
    supplierName:{
      type: String,
      default: ''
    },
    invoiceNo:{
      type: String,
      default: ''
    },
    returnItems:[{
      productRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
  
      },
      batchNumber:{
        type: String,
        default: '',
      },
      returnQuantity:{
        type: Number,
        default: 0,
       },
     
   
       returnPrice: {
        type: Number,
        default: 0,
      },
      totalPrice:{
        type: Number,
        default: 0,
      },
      totalUnits:{
        type: Number,
        default: 0,
      },  
      unitPrice:{
        type: Number,
        default: 0,
      },
      pricePerPiece:{
        type: Number,
        default: 0,
      },
      discount:{
        type: Number,
        default: 0
      },
  
    }],
   
    totalReturnQuantity:{
      type: Number,
      default: 0
    },
   
    
   
    totalReturnAmount:{
      type: Number,
      default: 0
    },
 
    reason: { // Added for tracking return purpose
      type: String,
      trim: true,
      default: '',
    },
    totalReturnPricing: {
      type: Number,
      default: 0
    }
     
},

 { timestamps: true });


 const PurchaseReturn = mongoose.model("PurchaseReturn", purchaseReturnSchema);
// Pre-save middleware to calculate totals
// purchaseReturnSchema.pre('save', function (next) {
//   const doc = this;
//   doc.totalReturnQuantity = doc.returnItems.reduce((sum, item) => sum + item.returnQuantity, 0);
//   doc.totalReturnAmount = doc.returnItems.reduce((sum, item) => {
//     const discountedPrice = item.unitPrice * (1 - (+item.discount || 0) / 100);
//     const itemTotal = item.returnQuantity * (item.returnPrice || discountedPrice);
//     item.totalPrice = parseFloat(itemTotal.toFixed(2));
//     return sum + item.totalPrice;
//   }, 0);
//   doc.totalReturnAmount = parseFloat(doc.totalReturnAmount.toFixed(2));
//   next();
// });
 module.exports = PurchaseReturn;
 
