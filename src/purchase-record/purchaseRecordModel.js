const mongoose = require("mongoose");
const { format } = require('date-fns');

const purchaseRecordSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
  
      title: {
        type: String,
        required: true,
      },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true
        
      },
     
      description: {
        type: String,
        default: ''
      },
      images:[],
 
     
      invoiceNo: {
        type: String,
        default: '',
      },
      
   
 
     
},

 { timestamps: true });
 

 const purchaseRecord = mongoose.model("purchaseRecord", purchaseRecordSchema);

 module.exports = purchaseRecord;
 
