const mongoose = require("mongoose");
const { format } = require('date-fns');

const saleHistorySchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
  
      // productRef:[{
      //   type: mongoose.Schema.Types.ObjectId,
      //   ref: 'Stock',
      //   required: true,
        
      // }],

      saleRef:[ ],
     
       
      orderNo: {
        type: Number,
      
        unique: true,
      },
      withImage:{
        type: Boolean,
        default: false
      },
      totalQuantity: {
        type: Number, 
        default: 0
      },
      
      description: {
        type: String,
      },
      
    
      
      subTotal:{
        type: Number, 
        default: 0
      },
      totalDiscount: {
        type: Number, 
        default: 0
      },
      previousePayable:{
        type: Number, 
        default: 0
      },
      previouseAdvance:{
        type: Number, 
        default: 0
      },
      grandTotal:{
        type: Number, 
        default: 0
      },
      receivedAmount:{
        type: Number, 
        default: 0
      },
      remainingAmount:{
        type: Number, 
        default: 0
      },
      totalAfterDiscount:{
        type: Number, 
        default: 0
        },
    
      accountType:{
        type: String,
        default: ''
      },
      accountNumber:{
        type: String,
        default: ''
      },
   
      deliveryChargesIncluded: {
        type: Boolean,
        default: false
      },
      deliveryCharges: {
        type: Number, 
        default: 0
      },
      walkingCustomer: {
        type: Boolean, 
        default: false
      },
      // customerName:{
      //   type: String, 
      //   default: ''
      // },
      // customerPhone: {
      //   type: String, 
      //   default: ''
      // },
      customerRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
       
      },
     
      transactionDetails:{
        type:String,
        default:''
      },
      saleReturn: {
        type: Boolean,
        default: false
      },
      paymentStatus:{
        type: String,
        default: 'none'
      },
      orderStatus:{
        type: String,
        default: 'none'
      },
      onlineOrder:{
        type: Boolean,
        default: false
      },
      remarks:{
        type: String,
        default: false
      }
     
     
},

 { timestamps: true });




 const SaleHistory = mongoose.model("SaleHistory", saleHistorySchema);
 

module.exports = SaleHistory
