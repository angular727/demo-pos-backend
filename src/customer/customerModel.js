const mongoose = require("mongoose");
const { format } = require('date-fns');

const customerSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
   vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
      
          
      },
      name: {
        type: String,
        required: true,
      },
      readableId: {
        type: Number,
        unique:true
       
      },
      businessName: {
        type: String,
     
      },
      ownerName:{
        type: String,
      },
      userRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      email: {
        type: String,
        default: ''
      },
      phone:{
        type: String, 
        default: ''
      },
     
      city: {
        type: String,
      },
      
      address: {
        type: String,
      },
      address1: {
        type: String,
      },
      // previousBalance: {
      //   type: String,
      // },
      // debit: {
      //   type: String,
      // },
      // credit:{
      //     type: String,
      // },
      openingBalance: {
        type: String,
      },

      amountPayable: {
        type: Number,
        default:0,
      },
      amountAdvanced: {
        type: Number,
        default:0,
      },
      balanceType: {
        type: String,
        default: '',
      },
      type: {
        type: String,
      
      },
      whatsapp: {
        type: String, 
        default: ''
      },
      pageLink: {
        type: String, 
        default: ''
      },
      refferedBy: {
        type: String,
        default: ''
      },
      transactions:[]
 
     
},

 { timestamps: true });
 customerSchema.pre('save', async function(next) {

  if (!this.readableId) {
      const highestProduct = await Customer.findOne({}, {}, { sort: { 'readableId': -1 } }); // Find the product with the highest ID
      if (highestProduct) {
     console.log("highestProduct ", typeof highestProduct.readableId)
        this.readableId = highestProduct ? +(highestProduct.readableId) + 1 : 1;
        // Increment the highest product ID by 1
      } else {
          this.readableId = 1; // If there are no existing products, start from 1
      }
  }
  next();
});

 const Customer = mongoose.model("Customer", customerSchema);

 module.exports = Customer;
 
