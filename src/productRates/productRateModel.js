const mongoose = require("mongoose");


const rateSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
     vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true
            
          },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'product'
},
   
      rate:{
        type: Number,
        default: 0
      },
    
     
},

 { timestamps: true });


//  function setUploadDate(){
//   const formattedDate = format(new Date(), 'yyyy-MM-dd');;
//   return formattedDate;
//  }
 const Rate = mongoose.model("Rate", rateSchema);
 

module.exports = Rate
