const mongoose = require("mongoose");
const { format } = require('date-fns');

const manufactoringSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
  
      name: {
        type: String,
        required: true,
      },
  
     
      subSteps: []
      
 
     
},

 { timestamps: true });
//  manufactoringSchema.pre('save', async function(next) {

//   if (!this.readableId) {
//       const highestProduct = await Manufactoring.findOne({}, {}, { sort: { 'readableId': -1 } }); // Find the product with the highest ID
//       if (highestProduct) {
//      console.log("highestProduct ", typeof highestProduct.readableId)
//         this.readableId = highestProduct ? +(highestProduct.readableId) + 1 : 1;
//         // Increment the highest product ID by 1
//       } else {
//           this.readableId = 1; // If there are no existing products, start from 1
//       }
//   }
//   next();
// });

 const Manufactoring = mongoose.model("Manufactoring", manufactoringSchema);

 module.exports = Manufactoring;
 
