const mongoose = require("mongoose");
const { format } = require('date-fns');

const expenseSchema = new mongoose.Schema({
  
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
    expenseCategoryRef:{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
     
    },
    paymentMethod:{
      type: mongoose.Schema.Types.ObjectId,
       ref: 'Payment'
     },
     expenseBy:{
      type: String,
      default: ''
     },
     date: {
        type: Date,
        default: Date.now
     },
     paymentMadeBy:{
      type: String,
      default: ''
     },
      amount: {
        type: Number,
        default: 0
      },
      description:{
        type: String,
        default: ''
      },
    
     
},

 { timestamps: true });


//  function setUploadDate(){
//   const formattedDate = format(new Date(), 'yyyy-MM-dd');;
//   return formattedDate;
//  }
 const Expense = mongoose.model("Expense", expenseSchema);
 

module.exports = Expense
