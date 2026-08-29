const mongoose = require("mongoose");
const { format } = require('date-fns');

const productSchema = new mongoose.Schema({
  
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
    sNo: {
      type: Number,
   
    },
    barcode: {
      type: String,
      unique: true,
      index:1,
    },
    optionalBarCode: {
      type: String,
      
    },
     status: {
      type: String,
      
    },
      productId: {
        type: Number,
      
        unique: true,
      },
      name:{

        type: String, 
        unique: true,
        index:1,
        default: ''
      },
      ProductsNameurdu: {
        type: String, 
        default: ''
      },
     
      brand: {
        type: String,
  
      },
      categoryRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
       
      },
      categoryName:{
        type: String,
      },

      subcategory: {
        type: String,
      },
      
      limit: {
        type: String,
      },
      unit:{
        type: String,
      }, 
      variation: {
        type: String,
      
      },
      crossSign: {
        type: Boolean,
        default: false
      },
      scale: {
        type: String,
        default: false
      },
      packType: {
        type: String,
        default: ''
    },
    unitPerpack: {
        type: Number,
        default: 0  // Default to 0 for products that don't come in boxes
    },
   
      description:{
        type: String,
        default: ''
      },
      images:[]
     
},

 { timestamps: true });

 productSchema.pre('save', async function(next) {

  if (!this.productId) {
      const highestProduct = await Product.findOne({}, {}, { sort: { 'productId': -1 } }); // Find the product with the highest ID
      if (highestProduct) {
        console.log("highestProduct", highestProduct);
          this.productId = +highestProduct.productId + 1; // Increment the highest product ID by 1
      } else {
          this.productId = 1; // If there are no existing products, start from 1
      }
  }
  // Generate barcode after productId is known
  if (!this.barcode) {
    this.barcode = `PRD${this.productId}`;
  }
  next();
});

 const Product = mongoose.model("product", productSchema);
 

module.exports = Product
