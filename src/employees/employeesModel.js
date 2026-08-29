const mongoose = require("mongoose");


const employeeSchema = new mongoose.Schema({
  
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
   
    },
    designation: {
      type: String,
   
    },
    phone: {
      type: String,
   
    },
    salary: {
      type: String,
   
    },
    status: {
      type: String,
   
    },
      description:{
        type: String,
        default: ''
      },
    
     
},

 { timestamps: true });


//  function setUploadDate(){
//   const formattedDate = format(new Date(), 'yyyy-MM-dd');;
//   return formattedDate;
//  }
 const employees = mongoose.model("employees", employeeSchema);
 

module.exports = employees
