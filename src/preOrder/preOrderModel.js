const mongoose = require("mongoose");
const { format } = require('date-fns');

const preOrderSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
   vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
          required: true
          
        },
      productName: {
        type: String,
      
      },
      productRef:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stock',
       
        
      }],
      products:[],
       
      orderNo: {
        type: Number,
      
        unique: true,
      },
      soldPrice:{
        type: String, 
        default: ''
      },
      expiryDate:{
        type: Date, 
        default: ''
      },
      quantity: {
        type: String,
      },
      expiryDate: {
        type: String,
      },
      
      description: {
        type: String,
      },
      
      discount: {
        type: String,
      
      },
      subTotal:{
        type: String, 
        default: ''
      },
      totalDiscount: {
        type: String, 
        default: ''
      },
      previousBalance:{
        type: String,
        default: ''
      },
      grandTotal:{
          type: String,
        default: ''
      },
      receivedAmount:{
        type: String,
        default: ''
      },
      remainingAmmount:{
        type: String,
        default: ''
      },
      paymentMethod:{
        type: String,
        default: ''
      },
      accountType:{
        type: String,
        default: ''
      },
      accountNumber:{
        type: String,
        default: ''
      },
    totalAfterDiscount:{
        type: String,
        default: ''
      },
      deliveryChargesIncluded: {
        type: Boolean,
        default: false
      },
      deliveryCharges: {
        type: String, 
        default: ''
      },
      walkingCustomer: {
        type: Boolean, 
        default: false
      },
      wCustomerName: {
        type: String, 
        default: ''
      },
      wCustomerPhone: {
        type: String, 
        default: ''
      },
      customerRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
       
      },
     customerName:{
        type: String, 
        default: ''
      },
      totalPrice: {
        type: String, 
        default: ''
      },
      saleReturn: {
        type: Boolean,
        default: false
      }
     
},

 { timestamps: true });


 preOrderSchema.pre('save', async function(next) {

  if (!this.orderNo) {
      const highestProduct = await PreOrder.findOne({}, {}, { sort: { 'orderNo': -1 } }); // Find the product with the highest ID
      if (highestProduct) {
     console.log("highestProduct ", typeof highestProduct.orderNo)
        this.orderNo = highestProduct ? +(highestProduct.orderNo) + 1 : 1;
        // Increment the highest product ID by 1
      } else {
          this.orderNo = 1; // If there are no existing products, start from 1
      }
  }
  next();
});

 const PreOrder = mongoose.model("PreOrder", preOrderSchema);
 

module.exports = PreOrder
