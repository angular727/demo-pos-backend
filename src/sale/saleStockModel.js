const mongoose = require("mongoose");
const { format } = require('date-fns');

const stockSaleSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

     stockRef: {type: mongoose.Schema.Types.ObjectId,
      ref: 'Stock', },
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
    images:[]
 
},

 { timestamps: true });


 const StockSale = mongoose.model("StockSale", stockSaleSchema);
 

module.exports = StockSale
