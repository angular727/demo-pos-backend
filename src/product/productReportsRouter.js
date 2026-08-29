
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const cors = require("../cors");
const Complaint = require("./complaintModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");

var moment = require("moment");

// Define a function to dynamically get the 'io' instance
function getIO() {
  const { io } = require('../../bin/www'); // Adjust the path as necessary
  return io;
}

// total pending by user
async function emitComplaints(queryObj,user) {
  try {
    let req={};
    req.user = user;
    req.body = queryObj;
    let find = queryBuilderWithBody(req)
    console.log('emitComplaints find:', find);
     
    const result = await Complaint.find(find).populate({
      path: "technician",
    })
   
    getIO().emit('complaint', result );
    console.log('complaint complaint:', result);
  } catch (err) {
      getIO().emit('complaint', null );
      console.error('Error emitting total Complaint:', err);
  }

  //   const totalCount = await Complaint.countDocuments(find);

}


  // total pending by user
  async function emitComplaintCount(user) {
    try {
    
      let find={technician:user._id}
       
      const result = await Complaint.aggregate([
        {
          $match: find,  
          
        },
        {
          $group: {
            _id: null,
            totalReceived: {
              $sum: {
                $cond: [{ $eq: ["$status", "received"] }, 1, 0]
              }
            },
            totalMatched: {
              $sum: {
                $cond: [{ $eq: ["$status", "matched"] }, 1, 0]
              }
            },
            totalResolved:{
              $sum: {
             
                  $cond: [{ $in:['$status',  ['nccAppr','nccBypass','resolved','jheAppr']] }, 1, 0]
                
              }
            },
            // totalNotMatched: {
            //   $sum: {
            //     $cond: [{ $eq: ["$status", "unMatched"] }, 1, 0]
            //   }
            // },
            // totalApproved: {
            //   $sum: {
            //     $cond: [{ $eq: ["$approved", true] }, 1, 0]
            //   }
            // },
          
            // totalDissatisfied: {
            //   $sum: {
            //     $cond: [{ $eq: ["$returnByDissatisfied", true] }, 1, 0]
            //   }
            // },
            

            // totalNotApproved: {
            //   $sum: {
            //     $cond: [
            //       {
            //         $and: [
            //           { $eq: ['$approved', false] },
            //           { $eq: ['$status', 'resolved'] },
            //         ],
            //       },
            //       1,
            //       0,
            //     ],
            //   },
            // },
           
            // totalRecent: {
            //   $sum: {
            //     $cond: [{ $eq: ["$recent", true] }, 1, 0]
            //   }
            // },
            // totalComplaints: {
            //   $sum: {
            //     $cond: ["$orderNo", 1, 0]
            //   }
            // }
          }
        }
      ]);
      let totalCounts= result[0]
      getIO().emit('totalComplaintCount', totalCounts );
      console.log('emitComplaintCount totalCounts:', totalCounts);
    } catch (err) {
        getIO().emit('totalComplaintCount', null );
        console.error('Error emitting total Complaint count:', err);
    }

    //   const totalCount = await Complaint.countDocuments(find);
 
  }





module.exports = {emitComplaintCount,emitComplaints};
