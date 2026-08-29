const mongoose = require("mongoose");
const { format } = require('date-fns');

const OnlineSaleSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
   vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
          required: true
          
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

      // saleDetail:[ {
      //   stockRef: {type: mongoose.Schema.Types.ObjectId,
      //     ref: 'Stock',  required: true},
      //   productRef: {type: mongoose.Schema.Types.ObjectId,
      //     ref: 'product', required: true,  index: true},
      //   productName: String,  // Denormalized for quick access
      //   productId: Number,
      //    salePrice: Number,
      //    saleQuantity: Number,
      //    saleDiscount: Number,
      //    description: String,
      //    crossSign: Boolean,
      //    topLeft: Number,
      //    topRight:Number,
      //    bottomLeft:Number,
      //    bottomRight:Number,
      //    totalPrice: Number,
      //   images:[],
      // }
     
      // ],
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
            },
      
      OnlineSaleReturn: {
        type: Boolean,
        default: false
      },
     
     
      // orderNo: {
      //   type: Number,
      
      //   unique: true,
      //   default: 0
      // },
     
      // withImage:{
      //   type: Boolean,
      //   default: false
      // },
      // totalQuantity: {
      //   type: Number, 
      //   default: 0
      // },
      
      // description: {
      //   type: String,
      // },
      
    
      // updateLedger:{
      //   type: Boolean,
      //   default: false
      // },
      
      // subTotal:{
      //   type: Number, 
      //   default: 0
      // },
      // totalDiscount: {
      //   type: Number, 
      //   default: 0
      // },
      // previousePayable:{
      //   type: Number, 
      //   default: 0
      // },
      // previouseAdvance:{
      //   type: Number, 
      //   default: 0
      // },
      // grandTotal:{
      //   type: Number, 
      //   default: 0
      // },
      // receivedAmount:{
      //   type: Number, 
      //   default: 0
      // },
      // remainingAmount:{
      //   type: Number, 
      //   default: 0
      // },
      // totalAfterDiscount:{
      //   type: Number, 
      //   default: 0
      //   },
      // paymentMethod:{
      //   type: mongoose.Schema.Types.ObjectId,
      //    ref: 'Payment'
      //  },
      // accountType:{
      //   type: String,
      //   default: ''
      // },
      // accountNumber:{
      //   type: String,
      //   default: ''
      // },
   
      // deliveryChargesIncluded: {
      //   type: Boolean,
      //   default: false
      // },
      // deliveryCharges: {
      //   type: Number, 
      //   default: 0
      // },
      // walkingCustomer: {
      //   type: Boolean, 
      //   default: false
      // },
      // // customerName:{
      // //   type: String, 
      // //   default: ''
      // // },
      // // customerPhone: {
      // //   type: String, 
      // //   default: ''
      // // },
      // customerRef:{
      //   type: mongoose.Schema.Types.ObjectId,
      //   ref: 'Customer',
       
      // },
     
      // transactionDetails:{
      //   type:String,
      //   default:''
      // },
      // OnlineSaleReturn: {
      //   type: Boolean,
      //   default: false
      // },
      // paymentStatus:{
      //   type: String,
      //   default: 'none'
      // },
      // orderStatus:{
      //   type: String,
      //   default: 'none'
      // },
      // onlineOrder:{
      //   type: Boolean,
      //   default: false
      // },
      // remarks:{
      //   type: String,
      //   default: false
      // }
     
     
},

 { timestamps: true });



OnlineSaleSchema.pre('save', async function(next) {

  if (!this.orderNo) {
      const highestProduct = await OnlineSale.findOne({}, {}, { sort: { 'orderNo': -1 } }); // Find the product with the highest ID
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

 const OnlineSale = mongoose.model("OnlineSale", OnlineSaleSchema);
 

module.exports = OnlineSale
