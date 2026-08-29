const mongoose = require("mongoose");
const { format } = require('date-fns');

const stockSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
   vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
          required: true
          
        },
      // productName: {
      //   type: String,
      //   required: true,
      // },
      productRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product',
        required: true,
        index: true,
        
      },
     
      stockNo:{
        type: Number,
        default: 0,
        unique: true,
     
      },
      pricePerPiece:{
        type: Number,
        default: 0,
      },
      priceAfterDeliveryCharges:{
        type: Number,
        default: 0,
      },
      extraPiece:{
        type: Number,
        default: 0
      },
      purchasedStock:{
        type: Number,
        default: 0
      },
      caseQuantity:{
        type: Number,
        default: 0,
      },
      piecePerCase:{
        type: Number,
        default: 0,
      },
      totalStock:{
        type: Number,
        default: 0,
      }, 
      caseType: {
        type: String,
        default: '',
      },
      images:[],
      // purchasePrice: {
      //   type: String,
      //   default: ''
      // },
      salePrice:{
        type: String, 
        default: ''
      },
      unitType: {
        type: String,
        default: '',
    },
    // typeQuantity:{
    //   type: String,
    //     default: '',
    // },
    // piecesPerType: {
    //     type: Number,
    //     default: 0  // Default to 0 for products that don't come in boxes
    // },
      // totalStock: {
      //   type: Number,
      // },
    
      wCustomerName: {
        type: String, 
        default: ''
      },
      place: {
        type: String,
        default:''
      
      },
      wholeSalePrice:{
        type: String, 
        default: ''
      },
      location:[],
      
      placeNo:{
        type: String,
        default:''
      },
      expiryDate: {
        type: Date,
        default: ''
      },
      crossSign: {
        type: Boolean,
        default: false
      },
      description: {
        type: String,
      },
      discount: {
        type: String,
      },
      purchaseReturn: {
        type: Boolean,
        default: false
      },
      
      limit: {
        type: String,
      
      },
      unit:{
        type: String, 
        default: ''
      },
      supplier: {
        type: String, 
        default: ''
      },
    
      totalPrice: {
        type: String, 
        default: ''
      },
      
     
},

 { timestamps: true });


 stockSchema.pre('save', async function(next) {

  if (!this.stockNo) {
      const highestProduct = await Stock.findOne({}, {}, { sort: { 'stockNo': -1 } }); // Find the product with the highest ID
      if (highestProduct) {
        console.log("stockNo", highestProduct);
          this.stockNo = +highestProduct.stockNo + 1; // Increment the highest product ID by 1
      } else {
          this.stockNo = 1; // If there are no existing products, start from 1
      }
  }
  next();
});
// // Define a schema method to subtract stock
// stockSchema.methods.subtractStock = async function(totalStock,session) {
//   // Ensure there's enough stock available
//   if (this.totalStock < totalStock) {
//     throw new Error('Insufficient stock');
//   }

//   // Subtract the specified totalStock from the stock
//   this.totalStock -= totalStock;

//   // Save the updated product document
//   await this.save({ session });
// };


// // Define a schema method to subtract stock
// stockSchema.methods.addStock = async function(totalStock) {
//   totalStock = +totalStock
//   // Subtract the specified totalStock from the stock
//   if ( totalStock<0) {
//     throw new Error('Insufficient stock');
//   }
//   this.totalStock += totalStock;

//   // Save the updated product document
//   await this.save();
// };
 const Stock = mongoose.model("Stock", stockSchema);
 

module.exports = Stock
