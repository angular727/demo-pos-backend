const mongoose = require("mongoose");


const unitSchema = new mongoose.Schema({
  
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    name: {
      type: String,
   
    },
      units: [],
   
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
 const Unit = mongoose.model("unit", unitSchema);
 

module.exports = Unit
