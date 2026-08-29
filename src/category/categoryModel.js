const mongoose = require("mongoose");
const { format } = require('date-fns');

const categorySchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
          required: true
          
        },
    name: {
      type: String,
        required: true,
        index:1,
   
    },
      subcategories: [],
   
      description:{
        type: String,
        default: ''
      },
      active:{
        type: Boolean,
        default: true
      }
    
     
},

 { timestamps: true });


//  function setUploadDate(){
//   const formattedDate = format(new Date(), 'yyyy-MM-dd');;
//   return formattedDate;
//  }
 const Category = mongoose.model("category", categorySchema);
 

module.exports = Category
