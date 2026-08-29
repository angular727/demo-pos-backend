const mongoose = require("mongoose");


const bankSchema = new mongoose.Schema({
  
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
 
    },
      banks: [],
   
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
 const bank = mongoose.model("bank", bankSchema);
 

module.exports = bank
