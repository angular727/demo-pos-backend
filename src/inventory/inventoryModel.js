const mongoose = require("mongoose");
const { format } = require('date-fns');

const inventorySchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    editBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
  },
   vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
        
          
        },
    productRef:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product',
        required: true,
     
        
      },
      productId:{
          type: Number,
          
         
          index:1
      },
     productName: {
       type: String,
       default: '',
       index:1
     },
      inventoryNo:{
        type: Number,
        unique: true,

     
      },
      stockBarCode: {
        type: String,
        
      },

      
    barcode: {
        type: String,
        default: ''
      },
    
      batchNumber:{
        type: String,
        default: '',
        unique: true,
        required: true
      },
      totalInventory:{
        type: Number,
        default: 0,
      }, 
      extraUnit:{
        type: Number,
        default: 0,
      }, 
      packQuantity:{
        type: Number,
        default: 0
      },
      packType: {
        type: String,
      },
      totalUnits:{
        type: Number,
        default: 0
      },
      crossSign: {
        type: Boolean,
        default: false
      },
      description: {
        type: String,
      },
       ProductsNameurdu: {
        type: String, 
        default: ''
      },
      
      limit: {
        type: String,
      
      },
      
    
      
      purchaseReturn: {
        type: Boolean,
        default: false
      },
      discount: {
        type: Number, 
        default: 0
      },
    
      totalPrice: {
        type: Number, 
        default: 0
      },
      expiryDate: {
        type: Date,
        default: ''
      },
      placeNo:{
        type: String,
        default:''
      },
      place: {
        type: String,
        default:''
      
      },
      unitPerpack:{
        type: Number,
        default: 0,
      },
      unitPrice:{
        type: Number,
        default: 0,
      },
      wholeSalePrice:{
        type: Number, 
        default: 0
      },
      locations:[
        {name:String,
         quantity:Number
        }
      ],
      salePrice:{
        type: Number, 
        default: 0
      },
      unitPriceAfterDiliveryCharges:{
        type: Number,
        default: 0,
      },

      directAdd:{
       type: Boolean,
       default:false

      },
      saleDiscount: {
        type: Number, 
        default: 0
      },
      directInventory:{},
      inventoryAdjust:[{
        adjustmentType: String,
        quantity: Number,
        reason: String,
        date: String

      }]
     
},

 { timestamps: true });



// Create a separate counter collection
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model("counter", counterSchema);

// Helper function to get next sequence
// Helper function to get next sequence
async function getNextSequence(session) {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'inventoryNo' },
    { $inc: { seq: 1 } },
    { 
      new: true,
      upsert: true,
      session: session,
      setDefaultsOnInsert: true
    }
  );
  return counter.seq;
}

// Modified pre-save hook with error handling
inventorySchema.pre('save', async function(next) {
  try {
    if (!this.inventoryNo) {  // Changed from InvetoryNo to inventoryNo
      // Get the session from the document if it exists
      const session = this.$session();
      
      // Get next sequence number
      const nextNo = await getNextSequence(session);
      
      // Explicitly set the inventoryNo
      this.inventoryNo = nextNo;
      
      // Validate that we have a number
      if (typeof this.inventoryNo !== 'number') {
        throw new Error('Failed to generate valid inventory number');
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Define a schema method to subtract inventory
inventorySchema.methods.subtractInventory = async function(totalInventory,session) {
  // Ensure there's enough inventory available
  if (this.totalInventory < totalInventory) {
    throw new Error('Insufficient inventory');
  }

  // Subtract the specified totalInventory from the inventory
  this.totalInventory -= totalInventory;

  // Save the updated product document
  await this.save({ session });
};


// Define a schema method to subtract inventory  
inventorySchema.methods.addInventory = async function(totalInventory,session) {
  totalInventory = +totalInventory
  // Subtract the specified totalInventory from the inventory
  if ( totalInventory<0) {
    throw new Error('Insufficient inventory');
  }
  this.totalInventory += totalInventory;

  // Save the updated product document
  await this.save({ session });  
};
 const Inventory = mongoose.model("inventory", inventorySchema);
 

module.exports = Inventory
