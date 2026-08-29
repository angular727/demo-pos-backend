const mongoose = require("mongoose");
const { format } = require('date-fns');

const purchaseSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
  editBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
       
        
      },

      invoiceNo: {
        type: String,
        default:''
      
      },
      itemDetails:[{

    productRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product',
        required: true,
     
        
      },
      barcode: {
        type: String,
        default: ''
      },
      description: {
        type: String,
      },
    
      productId:{
          type: Number,
        
      },
      ProductsNameurdu: {
        type: String, 
        default: ''
      },
     productName: {
       type: String,
       default: '',
     },
     packType:{
       type: String,
       default: '',
     },
     packQuantity:{
       type: Number,
       default: 0,
     },
      totalUnits:{
        type: Number,
        default: 0,
      }, 
      unit:{
        type: String, 
        default: ''
      },
   
      crossSign: {
        type: Boolean,
        default: false
      },
      description: {
        type: String,
      },
     
      
      limit: {
        type: String,
      
      },
      
    
        batchNumber:{
          type: String,
          default: '',
         
        },
      
      purchaseReturn: {
        type: Boolean,
        default: false
      },
      discount: {
        type: Number, 
        default: 0
      },
      saleDiscount: {
        type: Number, 
        default: 0
      },
    
    
      totalPrice: {
        type: Number, 
        default: 0
      },
      expiryDate: {
        type: Date,
        default: ''
      },
      placeNo:{
        type: String,
        default:''
      },
      place: {
        type: String,
        default:''
      
      },
      outstandingBalance:{
        type: Number, 
        default: 0
      },
      unitPerpack:{
        type: Number,
        default: 0,
      },
      unitPrice:{
        type: Number,
        default: 0,
      },
      unitPriceAfterDisc:{
        type: Number,
        default: 0,
      },
      wholeSalePrice:{
        type: Number, 
        default: 0
      },
      locations:[],
      salePrice:{
        type: Number, 
        default: 0
      },
      unitPriceAfterDiliveryCharges:{
        type: Number,
        default: 0,
      },
      extraUnit:{
        type: Number,
        default: 0
      },
      stockBarCode: {
        type: String,
        default: ''
      },
    }],
      // stockRef:[{
      //   type: mongoose.Schema.Types.ObjectId,
      //   ref: 'Stock',

      // }],
      paidAmount:{
        type: Number,
        default: 0
      },
      soldPrice:{
        type: Number, 
        default: 0
      },
     purchaseDate: {
        type: Date, 
        default: ''
     },
     totalPayable:{
       type: Number, 
       default: 0
     },
      quantity: {
        type: Number, 
        default: 0
      },
      
      description: {
        type: String,
      },
      
      discount: {
        type: Number, 
        default: 0
      
      },

      
      subTotal:{
        type: Number, 
        default: 0
      },
      totalDiscount: {
        type: Number, 
        default: 0
      },
     

      expiryDate: {
        type: Date, 
        default: ''
      },
      previousBalance:{
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
      paymentMethod:{
       type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
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
      type: Number, 
      default: 0
      },
      extraDiscount:{
        type: Number, 
        default: 0
      },
      deliveryChargesIncluded: {
        type: Boolean,
        default: false
      },
      deliveryCharges: {
        type: Number, 
        default: 0
      },
     
      supplierRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
       
      },
   
      totalPrice: {
        type: Number, 
        default: 0
      },
      purchaseReturn: {
        type: Boolean,
        default: false
      },
      balanceSummary: {  },
},

 { timestamps: true });



 const Purchase = mongoose.model("Purchase", purchaseSchema);
 

module.exports = Purchase
