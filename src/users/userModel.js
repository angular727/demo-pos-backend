const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
    username: {
      type: String,
      unique:true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      // required: truesss
     
    },
    name: {
      type: String,
      default: ""
    },
    role: {
      type: String,
      default: ""
    },
     vendor: {
      type: String,
      default: ""
    },
  
    cws: {
      type: [String],
      default: []
    },
    email: {
      type: String,
      default: ""
    },
    dp: {
      type: String,
  
    },
    customerRef:{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
     
    },
    phone: {
      type: String,
      default: ""
  },
  easypaisa: {
      type: String,
      default: ""
  },
  jazzCash: {
      type: String,
      default: ""
  },
  bankNo: {
      type: String,
      default: ""
  },
  bankCode: {
      type: String,
      default: ""
  },
  idCard: {
    type: String,
    default: ""
  },
  city: {
    type: String,
    default: ""
  },
  area: {
    type: String,
    default: ""
  },
  territory: {
    type: [String],
      default: []
  
  },
  DOB: {
    type: String,
    default: ""
  },
  designation: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    default: ""
  },
  shopName: {
    type: String,
    default: ""
  },
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    default: ""
  },
  distributors: [{}],
  
    admin: {
      type: Boolean,
      default: false
    },
   
    
  }, { timestamps: true });
  

userSchema.plugin(passportLocalMongoose);

var User = mongoose.model("User",userSchema);

module.exports = User;