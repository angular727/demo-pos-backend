const mongoose = require("mongoose");
const { format } = require('date-fns');

const returnProductSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
  
    
    orderNo: {
        type: Number,
        required: true,
      },
   
      productRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product',
      },
      saleRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sale',
      },
      returnProducts:[{
        batchNumber:String,
        productRef:{
          type: mongoose.Schema.Types.ObjectId,
          ref: 'product',
          required: true,
        },
        productId:String,
        productName: String,
        returnQuantity:{
         type: Number,
         default: 0,
        },
        saleDiscount:{
          type: Number,
          default: 0,
        },
        returnPrice:{
          type: Number,
          default: 0,
         },
      
      }],
      totalReturnQuantity:{
        type: Number,
        default: 0,
      },
      totalReturnAmount: {
        type: Number,
      },
      walkingCustomer: {
        type: Boolean, 
        default: false
      },
      wCustomerName: {
        type: String,
        default: ''
      },
      customerName:{
        type: String,
        default:'',
       
      },
      customerRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
       
      },
     
},

 { timestamps: true });


 const ReturnProduct = mongoose.model("ReturnProduct", returnProductSchema);

 module.exports = ReturnProduct;
 
