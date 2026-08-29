const ROLES = require("./rolesConstant");
const {ReturnObj, HistoryObj }= require("./return-obj");
var moment = require("moment");
const FEEDBACKOBJECT = {
  reason:false,
  remarks:'',
  feedback:'',
  user: '',
}
// status       enum: ['upload','pending', 'fnaAppr','nccBypas', 'nccAppr', 'nccClose'],
//take a req and return a query object for mongoose
function feedbackSetup(req) {
 
  let returnComplaint = {};
  let feedBack={}
  let previousFeedback=[]
  // let complaint = req.body.complaint;
  if(req.user.role === ROLES.ncc){
    if(req.body.complaint?.nccFeedback[0]?.feedback){
      previousFeedback = req.body.complaint.nccFeedback;
    }
  
    feedBack.remarks = req.body?.remarks;
    feedBack.feedback = req.body.feedback; //['satisfied','unSatisfied', 'close'];
    feedBack.reason = req.body?.reason  
    feedBack.date = moment().format("YYYY-MM-DD");
    feedBack.time = moment().format('HH:mm:ss');;
    feedBack.user = req.user._id;
    if(feedBack.feedback ==='unSatisfied'){
      //return and      returnDissatisfied flae true and chnage the status
      previousFeedback.push(feedBack)
      returnComplaint ={
     returnDissatisfied:true, status:'resolved', nccFeedback:previousFeedback}
   
     
    }else if(feedBack.feedback === 'satisfied'){
      previousFeedback.push(feedBack)
          // after ncc approvel it should go to recently resolved
      returnComplaint ={recentlyResolved: true,status:'nccAppr', nccFeedback:previousFeedback};
    }else if(feedBack.feedback === 'close'){
      previousFeedback.push(feedBack)
      returnComplaint ={status:'nccClose',recentlyResolved: true, nccFeedback:previousFeedback};
    }
    return returnComplaint;

  }else if (req.user.role===ROLES.fna || req.user.role===ROLES.fnaAdmin){
    if(req.body.complaint?.vendorFeedback[0]?.feedback){
      previousFeedback = req.body.complaint.vendorFeedback;
    }
    feedBack.feedback = req.body.feedback; //['satisfied','unSatisfied', 'returnRecent];
    
    feedBack.reason = req.body?.reason; //['nccBypas',...] 
    feedBack.user = req.user._id;
    feedBack.date = moment().format("YYYY-MM-DD");
    feedBack.time = moment().format('HH:mm:ss');;
    if(feedBack.feedback ==='unSatisfied'){
        //if feed back unsatisfied then it should go to recent upload again
      feedBack.remarks = req.body.remarks;
      previousFeedback.push(feedBack)
      returnComplaint ={...ReturnObj,
      returnDissatisfied:true, status:'upload', vendorFeedback:previousFeedback}
     
    }else if(feedBack.feedback ==='returnRecent'){
      
      feedBack.returnToRecentRemarks = req.body.remarks;
      previousFeedback.push(feedBack)
      returnComplaint = {...ReturnObj, status:'upload', vendorFeedback:previousFeedback}
    }else if(feedBack.feedback ==='satisfied'){
      feedBack.remarks = req.body.remarks;
      //to send direct to recently resolve without ncc approvel
     
      previousFeedback.push(feedBack)
     
      if(feedBack.reason === 'nccByPass'){
        returnComplaint ={ status:'nccByPass', recentlyResolved:true, vendorFeedback:previousFeedback}
      }else{
        console.log("previousFeedback: ", previousFeedback);
        returnComplaint ={ status:'fnaAppr', vendorFeedback:previousFeedback}
      }
    }
  }else if(req.user.role === ROLES.cci){
    if(req.body.complaint?.cciFeedback[0]?.feedback){
      previousFeedback = req.body.complaint.cciFeedback;
    }
  
    feedBack.remarks = req.body?.remarks;
    feedBack.feedback = req.body.feedback; //['satisfied','unSatisfied', 'close'];
    feedBack.reason = req.body?.reason  
    feedBack.date = moment().format("YYYY-MM-DD");
    feedBack.time = moment().format('HH:mm:ss');;
    feedBack.user = req.user._id;
    if(feedBack.feedback ==='sendToVendor'){
      //return and      returnDissatisfied flae true and chnage the status
      previousFeedback.push(feedBack)
      returnComplaint ={returnDissatisfied:true, status:'resolved', cciFeedback:previousFeedback}
   
     
    }else if(feedBack.feedback ==='sendToNCC'){
      previousFeedback.push(feedBack)
      returnComplaint ={returnDissatisfied:true, status:'fnaAppr', cciFeedback:previousFeedback}
   
    }
    
    // if(feedBack.feedback === 'satisfied'){
    //   previousFeedback.push(feedBack)
    //       // after ncc approvel it should go to recently resolved
    //   returnComplaint ={recentlyResolved: true,status:'cciAppr', cciFeedback:previousFeedback};
    // }else if(feedBack.feedback === 'close'){
    //   previousFeedback.push(feedBack)
    //   returnComplaint ={status:'cciClose',recentlyResolved: true, cciFeedback:previousFeedback};
    // }
    return returnComplaint;

  }
      return returnComplaint;
}


function historyObjSetup(req) {
 
  let historyComplaint = {...HistoryObj};
  let complaint = req.body.complaint;
  
  // let complaint = req.body.complaint;
  if(req.user.role === ROLES.ncc || req.user.role===ROLES.fna || req.user.role===ROLES.fnaAdmin){
   for(let i in historyComplaint){
  
    if (complaint[i]) {
    
      historyComplaint[i] = complaint[i];
    }
   }
    
    historyComplaint.user = req.user._id;
    historyComplaint.complaint = complaint._id;
    
    return historyComplaint;

  }

}
// Export the function
module.exports = { feedbackSetup, historyObjSetup };
