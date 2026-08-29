const mongoose = require("mongoose");
const { format } = require('date-fns');

const quotationSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    vendorId: {
           type: mongoose.Schema.Types.ObjectId,
           ref: 'Vendor',
           required: true
           
         },
    quotationId: { type: String, unique: true },
    customer: {
      name: { type: String, required: true },
      email: { type: String },
      phone: { type: String },
    },
    items: [
      {
         productRef: {type: mongoose.Schema.Types.ObjectId,
                 ref: 'product', required: true,  index: true},
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    validityDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'declined', 'converted'],
      default: 'draft',
    },
    notes: { type: String },
    
     
},

 { timestamps: true });

 quotationSchema.pre('save', async function(next) {

  if (!this.quotationId) {
      const highestProduct = await Quotation.findOne({}, {}, { sort: { 'quotationId': -1 } }); // Find the product with the highest ID
      if (highestProduct) {
        console.log("highestProduct", highestProduct);
          this.quotationId = +highestProduct.quotationId + 1; // Increment the highest product ID by 1
      } else {
          this.quotationId = 1; // If there are no existing products, start from 1
      }
  }
  next();
});
 const Quotation = mongoose.model("Quotation", quotationSchema);
 

module.exports = Quotation
