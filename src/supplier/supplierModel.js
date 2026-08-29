const mongoose = require("mongoose");
const { format } = require('date-fns');

const supplierSchema = new mongoose.Schema({
  
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
      supplierNumber: {
        type: Number,
        default: 0,
        unique: true
      },
      supplierName: {
        type: String,
        default: ''
      },
      email: {
        type: String,
        default: ''
      },
      phone:{
        type: String, 
        default: ''
      },
      openingBalance: {
        type: String,
      },

      amountPayable: {
        type: Number,
        default:0,
      },
      amountAdvanced: {
        type: Number,
        default:0,
      },
      balanceType: {
        type: String,
        default: '',
      },
      address: {
        type: String,
      },
      ownerName: {
        type: String,
      },
      type: {
        type: String,
      
      },
      weChat: {
        type: String,
      },
      paymentMethod: {
        type: String,
      },
      accountNo: {
        type: String,
      },
      businessName:{
        type: String,
      },
      address1:{
        type: String,
      },
      city:{
        type: String,
      },
      accountTitle: {
        type: String,
      },
      openingBalance: {
        type: String,
      },
      balance: {
        type: String,
      },
     
      whatsapp: {
        type: String, 
        default: ''
      },
      pageLink: {
        type: String, 
        default: ''
      },
      refferedBy: {
        type: String,
        default: ''
      },
      QRImage: {
        type: String,
        default: ''
      },
      transactions:[]
     
},

 { timestamps: true });

 supplierSchema.pre('save', async function(next) {

  if (!this.supplierNumber) {
      const highestProduct = await Supplier.findOne({}, {}, { sort: { 'supplierNumber': -1 } }); // Find the product with the highest ID
      if (highestProduct) {
        console.log("supplierNumber", highestProduct);
          this.supplierNumber = +highestProduct.supplierNumber + 1; // Increment the highest product ID by 1
      } else {
          this.supplierNumber = 1; // If there are no existing products, start from 1
      }
  }
  next();
});
//  function setUploadDate(){
//   const formattedDate = format(new Date(), 'yyyy-MM-dd');;
//   return formattedDate;
//  }
 const Supplier = mongoose.model("Supplier", supplierSchema);
 

module.exports = Supplier
