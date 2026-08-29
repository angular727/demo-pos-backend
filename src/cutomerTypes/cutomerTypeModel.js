const mongoose = require("mongoose");


const cutomerSchema = new mongoose.Schema({
  
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
 
    },
      types: [],
   
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
 const cutomerType = mongoose.model("cutomerType", cutomerSchema);
 

module.exports = cutomerType
