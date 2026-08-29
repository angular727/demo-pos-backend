const mongoose = require("mongoose");
const { format } = require('date-fns');

const shipingSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
   vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
          
          
        },
      trackingNo: {
        type: String,
      
      },
      parcelNo: {
        type: Number,
        unique: true
      },
      parcelWeight: {
        type: Number,
      },
      shipingCompany:{
        type: String, 
        default: ''
      },
      saleRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sale',

      },
      products:[],
       
      orderNo: {
        type: Number,
    
      },
     
      status: {
        type: String,
        enum: ['Pending','Delivered', 'Rejected']
      },
      c_Name: {
        type: String,
        default: ''
      },
      
      estimatedCharges: {
        type: String,
        default: ''
      },
      estimatedTime: {
        type: String,
        default: ''
      },
      
      detail: {
        type: String,
        default: ''
      },
    
      
     
},

 { timestamps: true });


 shipingSchema.pre('save', async function(next) {

  if (!this.parcelNo) {
      const highestProduct = await Shiping.findOne({}, {}, { sort: { 'parcelNo': -1 } }); // Find the product with the highest ID
      if (highestProduct) {
     console.log("highestParcel ", typeof highestProduct.parcelNo)
        this.parcelNo = highestProduct ? +(highestProduct.parcelNo) + 1 : 1;
        // Increment the highest product ID by 1
      } else {
          this.parcelNo = 1; // If there are no existing products, start from 1
      }
  }
  next();
});

 const Shiping = mongoose.model("shiping", shipingSchema);
 

module.exports = Shiping
