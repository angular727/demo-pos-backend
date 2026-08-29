const mongoose = require('mongoose');

class newQueryBuilder {
  constructor(queryParams, req) {
    this.query = {};
    this.user = req.user
    this.queryParams = queryParams;
    this.queryType = req.queryType
    this.InventoryQuery = req.InventoryQuery

    const NestedObjects = ['vendorRemarks','vendorDate','nccFeedback', 'nccRemarks',
      'nccReason','shopPic', 'beforePic', 'afterPic', 'optionalPic','compressorPic','closeComplaintPic',
      'gasLeakPic','moreOtherPartsPic','otherPartsPic','servicePic']
    // Define nested field mappings
    this.nestedFields = {
      'customerName': 'customerInfo.name',
      'productName': 'prouctInfo.name',

    };



    if(this.queryParams?.startDate && this.queryParams?.endDate){
      this.buildDateFilters()
    }

    
             

  }
  

  buildDateFilters() {

    const dateTypes = {'saleDate':'saleDate', 'createdAt':'createdAt', 'purchaseDate':'purchaseDate'}; // Add your date field names
   
    if(this.queryParams?.dateFilter){
      this.query[this.queryParams?.dateFilter] = {
        $gte: new Date(this.queryParams.startDate),
        $lte: new Date(this.queryParams.endDate),
      };
    }else{
        // Create start and end dates
        const startDate = new Date(this.queryParams.startDate);
        startDate.setHours(0, 0, 0, 0);  // Set to beginning of day


        const endOfDay = new Date(this.queryParams.endDate);
        endOfDay.setHours(23, 59, 59, 999); //
      this.query.createdAt= {
        $gte: startDate,
        $lte: endOfDay,
      };
    }

    return this;
  }

  buildStringFilters() {
    const matchingString = { 'name': 'name', 'place': 'place',
      'accountTitle':'accountTitle',productName:'productName',    };

  for(let i in matchingString){
      if(!this.queryParams[matchingString[i]]) continue
      if(typeof this.queryParams[matchingString[i]] === 'string'){
        //find matching string query
        this.query[matchingString[i]] = {$regex: this.queryParams[matchingString[i]], $options: 'i'}
      }else if(Array.isArray(this.queryParams[matchingString[i]])){
        //find matching string query from array
        this.query[matchingString[i]] = {
          $regex: this.queryParams[matchingString[i]].map(term => `\\b${term}\\b`).join('|'),
          $options: 'i'
        }
      }
     
      console.log("this.query ", this.query);
    }
    return this;
  }

  buildNestedFilters() {
    const uniqueFields = {
      'customerName': 'customerInfo.name',
      'productName': 'productInfo.name',
      'productCode': 'productInfo.productId',
      'supplierName': 'supplierInfo.name',
      categoryName: 'productInfo.categoryName',
    };
  
    // Object to store conditions grouped by field type
    const groupedConditions = {};
    
    for (let field in uniqueFields) {
      if (!this.queryParams[field]) continue;
  
      const mappedField = uniqueFields[field];
      
      if (typeof this.queryParams[field] === 'string') {
        // For single string values
        if (field === 'productCode') {
          groupedConditions[field] = { [mappedField]: parseInt(this.queryParams[field]) };
        } else {
          groupedConditions[field] = { [mappedField]: { $regex: this.queryParams[field], $options: 'i' } };
        }
      } else if (Array.isArray(this.queryParams[field])) {
        // For array values, create an array of conditions for this field
        const conditions = this.queryParams[field].map(term => {
          if (field === 'productCode') {
            return { [mappedField]: parseInt(term) };
          } else {
            return { [mappedField]: { $regex: term, $options: 'i' } };
          }
        });
        
        // Group conditions for this field with OR
        groupedConditions[field] = { $or: conditions };
      }
    }
  
    // Combine all field conditions with AND
    const finalConditions = [];
    for (let field in groupedConditions) {
      finalConditions.push(groupedConditions[field]);
    }
  
    // If we have conditions, set the final query
    if (finalConditions.length > 0) {
      if (finalConditions.length === 1) {
        // If only one field type, use its conditions directly
        this.query = finalConditions[0];
      } else {
        // If multiple field types, combine them with AND
        this.query = { $and: finalConditions };
      }
    }
  
    return this;
  }

  buildUniqueIdentifierFilters() {
    const numberValue = {
      productId: 'productId',
      stockNo:'stockNo',
      totalInventory:'totalInventory',

 
    }
    const objectIdFields = { user:'user', customerRef:'customerRef', productRef:'productRef'}
  
    const uniqueFields = { 'caseType':'caseType', batchNumber:'batchNumber', barcode:'barcode',
      'totalStock':'totalStock', 'c_Name':'c_Name', orderStatus:'orderStatus',
     'businessName':'businessName','itemDetails.productName':'itemDetails.productName', 'status':'status',
        'phone':'phone', 'debit':'debit', 'credit':'credit', 'productRef':'productRef', 'accountTitle':'accountTitle',
        'accountNo':'accountNo', 'entityType':'entityType', 'entityId':'entityId', 'entityName':'entityName',
         'customerRef':'customerRef',invoiceNo:'invoiceNo',

         stockRef:'stockRef', 'email':'email', 'trackingNo':'trackingNo', 'orderNo': 'orderNo',   };
         if(!this.InventoryQuery){
          uniqueFields.productName='productName';
         }
        
    for(let i in uniqueFields){

      if(!this.queryParams[uniqueFields[i]]) continue

      if(typeof this.queryParams[uniqueFields[i]] === 'string'){
        this.query[uniqueFields[i]] = this.queryParams[uniqueFields[i]]
      }else if(Array.isArray(this.queryParams[uniqueFields[i]])){
        this.query[uniqueFields[i]] = {$in: this.queryParams[uniqueFields[i]]}
      }
    }
    for(let i in numberValue){
      if(!this.queryParams[numberValue[i]]) continue
      if(typeof this.queryParams[numberValue[i]] === 'string'){
        this.query[numberValue[i]] = parseInt(this.queryParams[numberValue[i]])
      }else if(Array.isArray(this.queryParams[numberValue[i]])){
        this.query[numberValue[i]] = {$in: this.queryParams[numberValue[i]].map(term => parseInt(term))}
      }
      //make aquery for objectIdFields
    }
    for(let i in objectIdFields){
      if(!this.queryParams[objectIdFields[i]]) continue
      if(typeof this.queryParams[objectIdFields[i]] === 'string'){
        this.query[objectIdFields[i]] = new mongoose.Types.ObjectId(this.queryParams[objectIdFields[i]])
      }else if(Array.isArray(this.queryParams[objectIdFields[i]])){
        this.query[objectIdFields[i]] = {$in: this.queryParams[objectIdFields[i]].map(term => new mongoose.Types.ObjectId(term))}
      }

    }
   
    // for(let i in booleanValues){
    //   if(!this.queryParams[booleanValues[i]]) continue
    //   if( this.queryParams[booleanValues[i]] == 'true'){
    //     this.query[booleanValues[i]] = true
    //   }else {
    //     this.query[booleanValues[i]] = false
    //   }
     
  
    // }
 
    return this;
  }

  buildRangeFilters() {
    // Handle numeric range filters for nested fields
    const rangeFields = ['itemQuantity'];
    
    rangeFields.forEach(field => {
      const mongoField = this.nestedFields[field];
      if (this.queryParams[`${field}Min`] || this.queryParams[`${field}Max`]) {
        const rangeQuery = {};
        
        if (this.queryParams[`${field}Min`]) {
          rangeQuery.$gte = Number(this.queryParams[`${field}Min`]);
        }
        
        if (this.queryParams[`${field}Max`]) {
          rangeQuery.$lte = Number(this.queryParams[`${field}Max`]);
        }

        // For array fields, use $elemMatch
        if (mongoField.includes('items.')) {
          this.query['items'] = {
            $elemMatch: {
              [mongoField.split('.')[1]]: rangeQuery
            }
          };
        } else {
          this.query[mongoField] = rangeQuery;
        }
      }
    });
    return this;
  }

  build() {
    return this.query;
  }
}


module.exports = newQueryBuilder