const mongoose = require("mongoose");
const { format } = require('date-fns');

const saleSchema = new mongoose.Schema({
  
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
  
      // productRef:[{
      //   type: mongoose.Schema.Types.ObjectId,
      //   ref: 'Stock',
      //   required: true,
        
      // }],
   
      saleDetail:[ {
        // stockRef: {type: mongoose.Schema.Types.ObjectId,
        //   ref: 'Stock',  required: true},
        batchNumber: {type: String, required: true},
        batchDetails: {},
        productRef: {type: mongoose.Schema.Types.ObjectId,
          ref: 'product', required: true,  index: true},
        productName: String,  // Denormalized for quick access
        productId: Number,
     
         salePrice: Number,
         saleQuantity: Number,
         saleDiscount: Number,
         description: String,
         crossSign: Boolean,
         topLeft: Number,
         topRight:Number,
         bottomLeft:Number,
         bottomRight:Number,
         totalPrice: Number,

         productProfit: Number,
         totalUnits: Number,
        images:[],
      }
     
      ],
     
      saleDate: {
        type: Date,
        default: ''
    },
      orderNo: {
        type: String,
        required: true,
      
        unique: true,
      },
       orignalOrderNo:{
        type: String,
        default: ''
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
      
     
      notes: {
        type: String,
      },
      updateLedger:{
        type: Boolean,
        default: false
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
      balanceSummary:{
       
      },
      outstandingBalance:{
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
      saleReturnRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ReturnProduct',
      },
      paymentStatus:{
        type: String,
        default: 'none'
      },
      syncStatus: {
        type: String,
        default: 'synced'
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



//  saleSchema.pre('save', async function(next) {

//   if (!this.orderNo) {
//       const highestProduct = await Sale.findOne({}, {}, { sort: { 'orderNo': -1 } }); // Find the product with the highest ID
//       if (highestProduct) {
//      console.log("highestProduct ", typeof highestProduct.orderNo)
//         this.orderNo = highestProduct ? +(highestProduct.orderNo) + 1 : 1;
//         // Increment the highest product ID by 1
//       } else {
//           this.orderNo = 1; // If there are no existing products, start from 1
//       }
//   }
//   next();
// });

 const Sale = mongoose.model("Sale", saleSchema);
 

module.exports = Sale
