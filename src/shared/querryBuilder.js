

const mongoose = require('mongoose');

const ROLES = require("./rolesConstant");
var moment = require("moment");
const { ObjectId } = mongoose.Types;
//take a req and return a query object for mongoose



// Function to parse boolean query parameters
const parseBooleanQuery = (value) => {
 return value == 'true';

 
};



function queryBuilder(req) {
    const user = req.user
    const find = {}
    console.log("req.query inside query builder: ", req.query);

      if (
        req.query.hasOwnProperty("startDate") &&
        req.query.hasOwnProperty("endDate") && req.query.hasOwnProperty("dateFilter")
      ){
            const startDate = moment.utc(req.query.startDate).format("YYYY-MM-DD");
             const endDate = moment.utc(req.query.endDate).format("YYYY-MM-DD");
           
          find[req.query.dateFilter] = {
            $gte: startDate,
            $lte: endDate,
          };
          delete req.query.startDate;
          delete req.query.endDate;
          delete req.query.dateFilter;
      }else{
        if (
          req.query.hasOwnProperty("startDate") &&
          req.query.hasOwnProperty("endDate")
        ) {
          // Create start and end dates
                const startDate = new Date(req.query.startDate);
                startDate.setHours(0, 0, 0, 0);  // Set to beginning of day


          const endOfDay = new Date(req.query.endDate);
          endOfDay.setHours(23, 59, 59, 999); //
            find["createdAt"] = {
              $gte: startDate,
              $lte: endOfDay
            };
          delete req.query.startDate;
          delete req.query.endDate;
        }
      }
      if (req.query.hasOwnProperty("name") && Array.isArray(req.query.name)) {
        find["name"] =req.query.name.map(substring => new RegExp(substring, 'i'));
        
        delete req.query.name;
      }else   if (req.query.hasOwnProperty("name") && typeof(req.query.name) == 'string') {
        // find["name"] =req.query.name.map(substring => new RegExp(substring, 'i'));
        find["name"] = {
          $regex: new RegExp(req.query.name, "i") // "i" for case-insensitive search
        };
        delete req.query.name;
      }
      if (req.query.hasOwnProperty("onlineOrder") && req.query.onlineOrder == 'false') {
      
          find["$or"] = [
            { "onlineOrder": false },
            { "onlineOrder": { $exists: false } }
          ];
       
        delete req.query.onlineOrder;
      }
      if(req.query.stockNo){
        find ['stockNo']=  parseInt(req.query.stockNo)
    
      delete req.query.stockNo
      }
      if(req.query.orderNo){
        find ['orderNo']=  parseInt(req.query.orderNo)
    
      delete req.query.orderNo
      }
         if(req.query.patientNo){
        find ['patientNo']=  parseInt(req.query.patientNo)
    
      delete req.query.patientNo
      }
      if(req.query.place){
        find['place']= {
          $regex: new RegExp(req.query.place, "i") // "i" for case-insensitive search
        };
          delete req.query.place
          
      };
           if(req.query.fullName){
            find['fullName']= {
              $regex: new RegExp(req.query.fullName, "i") // "i" for case-insensitive search
            };
              delete req.query.fullName
          
      };
         if(req.query.firstName){
            find['firstName']= {
              $regex: new RegExp(req.query.firstName, "i") // "i" for case-insensitive search
            };
              delete req.query.firstName
          
      };
      if(req.query.lastName){
            find['lastName']= {
              $regex: new RegExp(req.query.lastName, "i") // "i" for case-insensitive search
            };
              delete req.query.lastName
          
      };
      if(req.query.productName){
     

        if(req.query.productName?.length>0){
          const regexQueries = req.query.productName.map(term => ({
            'productInfo.name': { $regex: term, $options: 'i' }
          }));
          
          find['$or'] = regexQueries;
          delete req.query.productName
        
        
        }else{
          find['productInfo.name']= {
            $regex: req.query.productName,
            $options: 'i' // case-insensitive
        }
        delete req.query.productName
        }
        
          
      };
      if(req.query.totalStock){
        find['totalStock']= parseInt(req.query.totalStock)
          delete req.query.totalStock
      };
      if(req.query.placeNo){
        find['placeNo']= {$in: req.query.placeNo};
          delete req.query.placeNo
      };
      if(req.query.hasOwnProperty('minStock') || req.query.hasOwnProperty('maxStock')){
        find['totalStock']= {
          $gte:parseInt(req.query.minStock) ,
          $lte: parseInt(req.query.maxStock) 
        };
          delete req.query.minStock
          delete req.query.maxStock
      };

      if(req.query.subTotal){
        find['subTotal']= parseInt(req.query.subTotal)
          delete req.query.subTotal
      };
      if(req.query.grandTotal){
        find['grandTotal']= parseInt(req.query.grandTotal)
          delete req.query.grandTotal
      };
      if(req.query.user){
        find['user']= ObjectId(req.query.user)
          delete req.query.user
      };
      if(req.query.totalDiscount){
        find['totalDiscount']= parseInt(req.query.totalDiscount)
          delete req.query.totalDiscount
      };
      if (req.query.productId && req.stockQuery) {
        const regexQueries = req.query.productId.map(term => ({
          'productInfo.productId': {$in: Array.isArray(req.query.productId) ? req.query.productId.map(Number) : [req.query.productId].map(Number)}
        }));
        
        find['$or'] = regexQueries;
      
      delete req.query.productId 
    }
     

      if(req.query.accountTitle){
        find['accountTitle']= {
              $regex: req.query.accountTitle,
              $options: 'i' // case-insensitive
          }
          delete req.query.accountTitle
      };
      
      if(req.query.supplierName){
        find['supplierInfo.name']= {
              $regex: req.query.supplierName,
              $options: 'i' // case-insensitive
          }
          delete req.query.supplierName
          
      };
      if(req.query.deliveryCharges){
        find['deliveryCharges']= parseInt(req.query.deliveryCharges)
          delete req.query.deliveryCharges
      };
      if(req.query.totalAfterDiscount){
        find['totalAfterDiscount']= parseInt(req.query.totalAfterDiscount)
          delete req.query.totalAfterDiscount
      };
      if(req.query.shipingCompany){
        find['shipingCompany']={
              $regex: req.query.shipingCompany,
              $options: 'i' // case-insensitive
          }
          delete req.query.shipingCompan
      };
 
      if(req.query.customerName){
        find['customerInfo.name']= {
              $regex: req.query.customerName,
              $options: 'i' // case-insensitive
          }
          delete req.query.customerName
          
      };
     
      if(req.query.accountTitle){
        find['accountTitle'] ={
              $regex: req.query.accountTitle,
              $options: 'i' // case-insensitive
          }
          delete req.query.accountTitle
      };
      
      if(req.query.phone){
        find['phone'] ={
              $regex: req.query.phone,
              $options: 'i' // case-insensitive
          }
          delete req.query.phone
      };
      if(req.query.productRef){
        const productObjectId = ObjectId(req.query.productRef)
        find['productRef']= productObjectId

      delete req.query.productRef
      }
      if(req.query.stockRef){
        const productObjectId = ObjectId(req.query.stockRef)
        find['stockRef']= productObjectId

      delete req.query.stockRef
      }
     
    // Handle credit filter
    if(parseBooleanQuery(req.query.credit) && parseBooleanQuery(req.query.debit) ){
      find['$or'] = [
        { credit: { $gt: 0 } },
        { debit: { $gt: 0 } }
      ]
      delete req.query.credit
      delete req.query.debit

    }else if (parseBooleanQuery(req.query.credit) ) {
    
        find.credit = { $gt: 0 };
      
      delete req.query.credit
    }else if(req.query.hasOwnProperty("credit") ){

      delete req.query.credit
    }
     if (parseBooleanQuery(req.query.debit)) {

        find.debit = { $gt: 0 };
          
      delete req.query.debit
   
    }else if(req.query.hasOwnProperty("debit")  ){
      delete req.query.debit
    }

      return { ...req.query, ...find };

}



function queryBuilderWithBody(req) {
    const user = req.user
    const find = {}
  
      if (
        req.body.hasOwnProperty("startDate") &&
        req.body.hasOwnProperty("endDate") && req.body.hasOwnProperty("dateFilter")
      ){
        const startDate = moment.utc(req.body.startDate).format("YYYY-MM-DD");
             const endDate = moment.utc(req.body.endDate).format("YYYY-MM-DD");
          find[req.body.dateFilter] = {
            $gte: startDate,
            $lte: endDate,
          };
          delete req.body.startDate;
          delete req.body.endDate;
          delete req.body.dateFilter;
  
      }else{
        const endOfDay = new Date(req.body.endDate);
        endOfDay.setHours(23, 59, 59, 999); //
          find["createdAt"] = {
            $gte: new Date(req.body.startDate),
            $lte: endOfDay
          };
      }
    
      if (req.body.hasOwnProperty("name")) {
        find["name"] = {
          $regex: new RegExp(req.body.name, "i") // "i" for case-insensitive search
        };
        delete req.body.name;
      }
      if(req.body.stockNo){
        find ['stockNo']= {
              $regex: req.body.stockNo,
              $options: 'i' // case-insensitive
          }

      delete req.body.stockNo
      }
      
      if(req.body.productId){
        find['productInfo.productId']= {
              $regex: req.body.productId,
              $options: 'i' // case-insensitive
          }
          delete req.body.productId
      };
   
 
      if(req.body.productName){
        find['productName']= {
              $regex: req.body.productName,
              $options: 'i' // case-insensitive
          }
          delete req.body.productName
      };
      
    
      if(req.body.shipingCompany){
        find['shipingCompany']={
              $regex: req.body.shipingCompany,
              $options: 'i' // case-insensitive
          }
          delete req.body.shipingCompan
      };
 
      if(req.body.customerName){
        find['customerName'] ={
              $regex: req.body.customerName,
              $options: 'i' // case-insensitive
          }
          delete req.body.customerName
      };
      if(req.body.accountTitle){
        find['accountTitle'] ={
              $regex: req.body.accountTitle,
              $options: 'i' // case-insensitive
          }
          delete req.body.accountTitle
      };
    
      
      if(req.body.phone){
        find['phone'] ={
              $regex: req.body.phone,
              $options: 'i' // case-insensitive
          }
          delete req.body.phone
      };
      if(req.body.productRef){
        const productObjectId = ObjectId(req.body.productRef)
        find['productRef']= productObjectId

      delete req.body.productRef
      }
      
   
      // if (req.body.orderNo) {
      //   const orderNoValue = req.body.orderNo.toString(); // Convert to string for regex matching
      //   const orderNoRegex = new RegExp(orderNoValue); // Create regex dynamically
      //   find.orderNo = {
      //     $regex: orderNoRegex,
      //     $options: 'i' // case-insensitive
      //   };
      //   delete req.body.orderNo;
      // }
  
      return { ...req.body, ...find };
  
  }


// Export the function
module.exports = { queryBuilder, queryBuilderWithBody };