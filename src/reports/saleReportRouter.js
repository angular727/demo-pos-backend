
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const saleReportRouter = express.Router();
const cors = require("../cors");
const Sale = require("../sale/saleModel");
const Stock = require("../stock/stockModel");
const StockSale = require("../sale/saleStockModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const Customer = require("../customer/customerModel");
const Transaction = require("../transaction/transactionModel");
const ROLES = require("../shared/rolesConstant");
const newQueryBuilder = require('../shared/newQueryBuilder')
const { getCustomerWiseSalesSummary, getProductWiseSalesSummary, getProductSalesDetails, getCustomerProfitDetails,
  getCustomerWiseProfitSummary,topSoldProductsByTime, getCustomerSalesDetails,
  getMostProfitableProducts,loadProfitableProducts,getDailySales } = require("./sale-report"); 
const mongoose = require('mongoose');
var moment = require("moment");
const Purchase = require("../purchaseInvoice/puchaseModel");
const generateDailyReport = require("./sale-purchase-report");
saleReportRouter.use(bodyParser.json());

saleReportRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    let find = queryBuilder(req);

     try {
    console.log("find inside get sale: ", find);
    Sale.find(find)
    .populate({
      path: 'customerRef',
      path: 'saleRef',
      populate: {
        path: 'stockRef',
        populate: {
          path: 'productRef'
        }
      }
    }) 
      .then(
        (Sale) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Sale);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
    }
    catch(err){
        res.json(err);
    }
  })


// get product wise sale
//export
saleReportRouter
  .route("/poductprofit/:productRef?/:pagesize?/:page?")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
      let find ={}
      if(req.params.productRef){
       find = {
   
          'saleDetail.productRef': mongoose.Types.ObjectId(req.params.productRef)// Replace 'providedProductId' with the actual product _id
     
       }
      
      }

    console.log("find. inside productwiseprofit ", find);
    try {
      const result = await Sale.aggregate([
     
          { $match: {
            ...find
            }
          },
        
          {
              $sort: { totalProfit: -1 }
          },
          {
              $skip: (page - 1) * pageSize
          },
          {
              $limit: pageSize
          },
        
      ]);


      res.json(result) ;
  } catch (error) {
      console.error('Error fetching top profitable sales:', error);
      throw error;
  }
})
  //get sale wise profit calculated

saleReportRouter
  .route("/productwiseprofit/:pagesize?/:page?/:order?")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pagesize) || 10;
    let match = {};
    if(req.query.productName){
      match['saleDetail.productName'] = {$in: req.query.productName};
    }
    try {
      const profitAggregation = await Sale.aggregate([
        // Unwind the saleDetail array to process each item individually
        { $unwind: '$saleDetail' },
        { $match: match },

        // Group by productRef (or productId - you can switch between them)
        {
          $group: {
            _id: '$saleDetail.productRef', // Use 'saleDetail.productId' if preferred
            totalProfit: { $sum: '$saleDetail.productProfit' },
            totalSales: { $sum: 1 },
            totalQuantity: { $sum: '$saleDetail.saleQuantity' },
            avgProfitPerSale: { $avg: '$saleDetail.productProfit' }
          }
        },
        
        // Optional: Populate product details if you want the names
        {
          $lookup: {
            from: 'products', // Your products collection name
            localField: '_id',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        
        // Unwind productInfo to make it cleaner (optional)
        { $unwind: '$productInfo' },
        
        // Project the fields you want in the response
        {
          $project: {
            productId: '$_id',
            productName: '$productInfo.name', // Adjust based on your product schema
            totalProfit: 1,
            totalSales: 1,
            totalQuantity: 1,
            avgProfitPerSale: 1
          }
        },
        
        // Sort by total profit descending
        { $sort: { totalProfit: -1 } }
      ]);
  
      res.json({
        success: true,
        data: profitAggregation,
        count: profitAggregation.length
      });
    } catch (error) {
      console.error('Error aggregating product profit:', error);
      res.status(500).json({
        success: false,
        message: 'Error calculating product profits',
        error: error.message
      });
    }
  });
  

  saleReportRouter
  .route("/productwiseprofit/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pagesize) || 10;
    let match = {};
    
    try {
      const productId = req.params.productId;
      
      const profitAggregation = await Sale.aggregate([
        { $unwind: '$saleDetail' },
        {
          $match: {
            'saleDetail.productRef': mongoose.Types.ObjectId(productId) // Use productId if preferred
          }
        },
        {
          $group: {
            _id: '$saleDetail.productRef',
            totalProfit: { $sum: '$saleDetail.productProfit' },
            totalSales: { $sum: 1 },
            totalQuantity: { $sum: '$saleDetail.saleQuantity' },
            avgProfitPerSale: { $avg: '$saleDetail.productProfit' }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        {
          $project: {
            productId: '$_id',
            productName: '$productInfo.name',
            totalProfit: 1,
            totalSales: 1,
            totalQuantity: 1,
            avgProfitPerSale: 1
          }
        }
      ]);
  
      if (profitAggregation.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No sales found for this product'
        });
      }
  
      res.json({
        success: true,
        data: profitAggregation[0]
      });
    } catch (error) {
      console.error('Error aggregating product profit:', error);
      res.status(500).json({
        success: false,
        message: 'Error calculating product profit',
        error: error.message
      });
    }
  });

saleReportRouter
  .route("/totalprofit")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pagesize) || 10;
    let match = {};
    
    if (req.query.productRef) {
        match['saleDetail.productRef'] = mongoose.Types.ObjectId(req.query.productRef);
    }

    try {
      const result = await Sale.aggregate([
        { $unwind: '$saleDetail' },
        { $match: match },
        {
            $lookup: {
                from: 'stocks',
                localField: 'saleDetail.stockRef',
                foreignField: '_id',
                as: 'stockDetails'
            }
        },
        { $unwind: '$stockDetails' },
        {
            $addFields: {
                profit: {
                    $subtract: [
                        { $multiply: ['$saleDetail.salePrice', '$saleDetail.saleQuantity'] },
                        { $multiply: ['$stockDetails.priceAfterDeliveryCharges', '$saleDetail.saleQuantity'] }
                    ]
                }
            }
        },
        {
            $group: {
                _id: '$saleDetail.productRef',
                totalProfit: { $sum: '$profit' },
                totalQuantity: { $sum: '$saleDetail.saleQuantity' },
                productName: { $first: '$saleDetail.productName' },
                productId: { $first: '$saleDetail.productId' }
            }
        },
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'productDetails'
            }
        },
        { $unwind: '$productDetails' },
        {
            $group: {
                _id: null,
                totalOverallProfit: { $sum: '$totalProfit' },
                products: {
                    $push: {
                        _id: '$_id',
                        productDetails: '$productDetails',
                        totalProfit: '$totalProfit',
                        totalQuantity: '$totalQuantity',
                        productName: '$productName',
                        productId: '$productId'
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                totalOverallProfit: 1,
                products: 1
            }
        }
    ]);
    
    // The result will be an array with one object
    // containing totalOverallProfit and an array of all products
    const { totalOverallProfit, products } = result[0];

        res.json(totalOverallProfit);
    } catch (error) {
        console.error('Error fetching top profitable sales:', error);
        next(error);
    }
});
  
//get analytics

saleReportRouter
  .route("/saleTrend")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    // let find = queryBuilder(req)

    

 
    try {
      let result = [];
     
      const queryBuilder =   new newQueryBuilder(req.query, req)
        .buildStringFilters()
        .buildUniqueIdentifierFilters()
        const find = queryBuilder.build();
        console.log("find. inside top sold ", find);
      result = await getDailySales(find);
    
     
      console.log("most sold ", result);

    


      res.json(result) ;
  } catch (error) {
      console.error('Error fetching top profitable sales:', error);
      throw error;
  }
})

//most sold product


saleReportRouter
  .route("/mostsold")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    // let find = queryBuilder(req)

    

 
    try {
      let result = [];
     
      const queryBuilder =   new newQueryBuilder(req.query, req)
        .buildStringFilters()
        .buildUniqueIdentifierFilters()
        const find = queryBuilder.build();
        console.log("find. inside top sold ", find);
      result = await topSoldProductsByTime(find);
    
     
      console.log("most sold ", result);

    


      res.json(result) ;
  } catch (error) {
      console.error('Error fetching top profitable sales:', error);
      throw error;
  }
})

saleReportRouter
  .route("/mostprofitable")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    const queryBuilder =   new newQueryBuilder(req.query, req)
    .buildStringFilters()
    .buildUniqueIdentifierFilters()
    const find = queryBuilder.build();

    

    console.log("find. inside totalsale ", find);
    try {
      let result=[];
    
  
      result = await getMostProfitableProducts(find);
      console.log("most proftable ", result);
      // const formattedResult = result.map(item => ({
      //   label: item.productName,
      //   value: item.totalProfit,
      //   quantity: item.totalQuantity
      // }));
     

    


      res.json(result) ;
  } catch (error) {
      console.error('Error fetching top profitable sales:', error);
      throw error;
  }
})


//total sale
saleReportRouter
  .route("/sale-report/:pagesize?/:page?/:order?")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let find = queryBuilder(req)

    

    try {
      let result = [];
    
     // Get the reports
     if(find?.reportType == 'customerSales'){
      delete find.reportType;
         if(find?.customerRef){
        result = await getCustomerSalesDetails(find);
      }else{
         result = await getCustomerWiseSalesSummary(find);
      }
     
     }else if(find?.reportType == 'productSales'){
       delete find.reportType;
      if(find?.productRef){
        result = await getProductSalesDetails(find);
      }else{
        result = await getProductWiseSalesSummary(find);
      }
   
       
     }else if(find?.reportType == 'customerProfit'){
       delete find.reportType;
        if(find?.customerRef){
        result = await getCustomerProfitDetails(find);
      }else{
        result = await getCustomerWiseProfitSummary(find);
      }
      
     }


    


      res.json({
        data: result,
        page,
        pageSize,
        totalItems:result.length,
        totalPages:result.length,
      }) ;
  } catch (error) {
      console.error('Error fetching top profitable sales:', error);
      throw error;
  }
})

//total sale
saleReportRouter
  .route("/totalsale")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let find = queryBuilder(req)

  

    console.log("find. inside totalsale ", find);
    try {
      const result = await Sale.aggregate([
     
        { $match: {
          ...find
          }
        },
          {
            $group: {
              _id: null,
              totalSales: { $sum: "$totalAfterDiscount" }
            }
          },
         
        
          {
              $sort: { totalProfit: -1 }
          },
          {
              $skip: (page - 1) * pageSize
          },
          {
              $limit: pageSize
          },
        
      ]);


      res.json(result) ;
  } catch (error) {
      console.error('Error fetching top profitable sales:', error);
      throw error;
  }
})


//total sale purchase report
saleReportRouter
  .route("/salePurchaseReport/:pagesize?/:page?/:order?")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    let find = queryBuilder(req)
    try {
      
     const result = await generateDailyReport(find)
     console.table(result.map(day => ({
      Date: day.date,
      'Purchase (Net)': day.purchase.net?.toFixed(2),
      'Sale (Net)': day.sale.net?.toFixed(2),
      // 'Profit': day.profit?.toFixed(2)
    })));
      res.json({
        data:result,
        page: 1,
        
        pageSize:null,
        totalItems: null,
        totalPages:null
      }) ;
  } catch (error) {
      console.error('Error fetching top profitable sales:', error);
      throw error;
  }
})

//total sale
saleReportRouter
  .route("/totalsale")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let find = queryBuilder(req)

  

    console.log("find. inside totalsale ", find);
    try {
      const result = await Sale.aggregate([
     
        { $match: {
          ...find
          }
        },
          {
            $group: {
              _id: null,
              totalSales: { $sum: "$totalAfterDiscount" }
            }
          },
         
        
          {
              $sort: { totalProfit: -1 }
          },
          {
              $skip: (page - 1) * pageSize
          },
          {
              $limit: pageSize
          },
        
      ]);


      res.json(result) ;
  } catch (error) {
      console.error('Error fetching top profitable sales:', error);
      throw error;
  }
})


//total purchase
saleReportRouter
  .route("/totalpurchase")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    let find = queryBuilder(req)

  

    console.log("find. inside totalsale ", find);
    try {
      const result = await Purchase.aggregate([
     
        { $match: {
          ...find
          }
        },
          {
            $group: {
              _id: null,
              totalPurchase: { $sum: "$totalAfterDiscount" },
              totalDelivery: { $sum: "$deliveryCharges" }
            }
          },
         
        
          {
              $sort: { totalProfit: -1 }
          },
          {
              $skip: (page - 1) * pageSize
          },
          {
              $limit: pageSize
          },
        
      ]);


      res.json(result) ;
  } catch (error) {
      console.error('Error fetching top profitable sales:', error);
      throw error;
  }
})
  //********** */ Api to get sale for everyday for a whole month ************
 
saleReportRouter
  .route("/:pagesize/:page")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
    const find = queryBuilder(req);
    
    
    try {
      const totalSale = await Sale.countDocuments(find);
      const totalPages = Math.ceil(totalSale / pageSize);
      console.log("find inside get: paginate stocks", find);
      const stocks = await Sale.find(find)
      .populate({
        path: 'customerRef',
        path: 'saleRef',
        populate: {
          path: 'stockRef',
          populate: {
            path: 'productRef'
          }
        }
      }) 
     
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      res.json({
        data: stocks,
        page,
        pageSize,
        totalItems:totalSale,
        totalPages,
      });
    } catch (error) {
     
      res.status(500).json({ error: "Internal Server Error" });
    }


  });

  //for multiple Sale some together before send to the client with pagination


module.exports = saleReportRouter;
