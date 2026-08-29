const mongoose = require("mongoose");
const { format } = require('date-fns');

const taskSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
   vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
         
          
        },
      title: {
        type: String,
        required: true,
      },
    
      description: {
        type: String,
     
      },
      
      date: {
        type: Date,
        default: Date.now 
      },
    
     
},

 { timestamps: true });


 const Task = mongoose.model("Task", taskSchema);

 module.exports = Task;
 
