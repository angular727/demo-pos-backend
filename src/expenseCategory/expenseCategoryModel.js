const mongoose = require("mongoose");
const { format } = require('date-fns');

const expenseCategorySchema = new mongoose.Schema({
  
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
      subcategories: [],
   
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
 const ExpenseCategory = mongoose.model("ExpenseCategory", expenseCategorySchema);
 

module.exports = ExpenseCategory
