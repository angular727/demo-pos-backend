const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const visitSchema = new Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
      },
       vendorId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Vendor',
              required: true
              
            },
       user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
      price:{
        type:Number,
        default:0,
      },
     
      checkupStatus:{
          type: String,
        default:'none'
      },
      payments:[],
      description:
      {
        type: String,
        default:''
      },
      services:[{name:String, //'X-ray', 'Ultrasound', 'Checkup', 'Test'
        price:Number,
        description:String,
        appointmentTime:String,
        status:{
          type: String,
          default:'pending'
        }
      }],
   
   
      doctor:{
        type: String,
        default:''
      },
      appointmentTime:{
        type: String,
        default:''
      },
      visitNo:{
        type:Number,
        default:0,
        unique:true
      },
      diagnoses:[{
        title: String,
        description: String
      }],
      vitals:[],
      treatments:[],
      tests:[],
      testsSuggested: [],

     
     
      
},
   {
    timestamps: true
}   );

visitSchema.pre('save', async function(next) {

  if (!this.visitNo) {
      const highestProduct = await Visit.findOne({}, {}, { sort: { 'visitNo': -1 } }); // Find the product with the highest ID
      if (highestProduct) {
     console.log("highestProduct ", typeof highestProduct.visitNo)
        this.visitNo = highestProduct ? +(highestProduct.visitNo) + 1 : 1;
        // Increment the highest product ID by 1
      } else {
          this.visitNo = 1; // If there are no existing products, start from 1
      }
  }
  next();
});

var Visit = mongoose.model("Visit", visitSchema);

module.exports = Visit;