const mongoose = require("mongoose");
const { format } = require('date-fns');

const sampleSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
  vendorId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Vendor',
         required: true
         
       },
      sampleId: {
        type: Number,
      
        unique: true,
      },
      modelNo:{

        type: String, 
  
        default: ''
      },
      sampleName:{

        type: String, 
  
        default: ''
      },
     
      description: {
        type: String,
  
      },
   
      date:{
        type: String,
      },

      customerName: {
        type: String,
      },
      crossSign: {
        type: Boolean,
        default: false
      },
      position: {
        type: String,
      },
      positionNumber: {
        type: String,
      },
      topLeft: {
        type: String,
      },
      topRight: {
        type: String,
      },
      bottomLeft: {
        type: String,
      },
      bottomRight: {
        type: String,
      },
   
      description:{
        type: String,
        default: ''
      },
      images:[]
     
},

 { timestamps: true });

 sampleSchema.pre('save', async function(next) {

  if (!this.sampleId) {
      const highestProduct = await Sample.findOne({}, {}, { sort: { 'sampleId': -1 } }); // Find the sample with the highest ID
      if (highestProduct) {
        console.log("highestProduct", highestProduct);
          this.sampleId = +highestProduct.sampleId + 1; // Increment the highest sample ID by 1
      } else {
          this.sampleId = 1; // If there are no existing products, start from 1
      }
  }
  next();
});

 const Sample = mongoose.model("Sample", sampleSchema);
 

module.exports = Sample
