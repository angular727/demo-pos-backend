const mongoose = require("mongoose");


const attendanceSchema = new mongoose.Schema({
  
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
    month: {
      type: String,
   
    },
    name: {
      type: String,
   
    },
    attendance: [],
  
    totalP:{
      type: String,
   
    },
    totalA:{
      type: String,
   
    },
    description:{
      type: String,
      default: ''
    },
    advance: {
      type: String,  // You can change this to Number if you want to store it as a number
     
    },
    date: {
      type: Date,
     
    },
    employId: {
      type: String,  // Assuming it's a string for employee ID
      required: true
    },
     salary: {
      type: String,  // You can change this to Number if you want to store it as a number
     },
    employee: {
      type: String,
      required: true
    },
    status: {
      type: String,
    
      required: true
    },
      startTime: {
      type: String,
    
    },
      endTime: {
      type: String,
     
    },
  
   
},

 { timestamps: true });


//  function setUploadDate(){
//   const formattedDate = format(new Date(), 'yyyy-MM-dd');;
//   return formattedDate;
//  }
 const Attendance = mongoose.model("Attendance", attendanceSchema);
 

module.exports = Attendance
