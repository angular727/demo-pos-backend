const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const vendorSchema = new Schema({
    username: {
      type: String,
      unique:true
    },
    name: {
      type: String,
      default: "",
      required: true
    },
    role: {
      type: String,
      default: "",
      required: true
    },
     vendorCode: {
      type: String,
      default: ""
    },
    
  
    email: {
      type: String,
      default: ""
    },
    dp: {
      type: String,
  
    },
    userRef:{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
     
    },

  }, { timestamps: true });
  



const Vendor = mongoose.model("Vendor",vendorSchema);

module.exports = Vendor;