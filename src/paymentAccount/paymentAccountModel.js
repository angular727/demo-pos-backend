const mongoose = require("mongoose");
const { format } = require('date-fns');

const paymentSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
   vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
          required: true
          
        },
      accountType: {
        type: String,
        default: ''
      },
      accountTitle: {
        type: String,
     
        default: ''
      },
      depositor:{
        type: String,
        default: ''
      },
      accountNo: {
        type: String,
        default: ''
      },
      
      description: {
        type: String,
        default: ''
      },
      accountOwner:{
        type: String, 
        default: ''
      },
     
      openingBalance: {
        type: String,
      },
      
      branchAddress: {
        type: String,
      },
    
      transactions:[]
 
     
},

 { timestamps: true });


 const Payment = mongoose.model("Payment", paymentSchema);

 module.exports = Payment;
 
