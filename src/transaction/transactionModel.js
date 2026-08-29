const mongoose = require("mongoose");
const { format } = require('date-fns');

const transactionSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
     vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
      
         
      },
    //reason mean invoice, invoiceReturn, sale, saleReturn and expense categories etc..
    reason: {
        type: String,
        // required: true,
      },
      reasonId: {
        type: String,
        // required: true,
      },
      reasonReadableNo: {
        type: String,
        // required: true,
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        
        refPath: 'entityType' // Reference to either 'Company' or 'Customer' model
    },
    entityType: {
        type: String,
        enum: ['Expense', 'Customer', 'Supplier','WalkingCustomer', 'Payment', 'Patient'],
        required: true
    },
    entityName: {
      type: String,
      // required: true,
    },
  //   type: {
  //     type: String,
  //     enum: ['Debit', 'Credit'],
  //     required: true
  // },
      description: {
        type: String,
        // required: true,
      },
      debit:{
        type: Number,
        required: true,
        default:0
     },
      credit:{
        type: Number,
        required: true,
        default:0
      },
  
      depositor: {
        type: String,
    },
    paymentMadeBy: {
      type: String,
    
    },
      salePrice:{
        type: String, 
        default: ''
      },
      transactionDate:{
        type: Date,
       
        default: format(new Date(), 'yyyy-MM-dd'),
      },
      paymentMethod: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Payment',
      },
     
      paymentDetail: {
        type: String,
      },
     
   
     
},

 { timestamps: true });



 const Transaction = mongoose.model("Transaction", transactionSchema);
 

module.exports = Transaction
