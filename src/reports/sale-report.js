// 1. Customer-wise Sales Report (Most to Least)
const Sale = require("../sale/saleModel");
const mongoose = require('mongoose');
// Method 1: Get customer-wise sales summary
const getCustomerWiseSalesSummary = async (find) => {
  const queryObj = {...find};
  if (queryObj) {
    queryObj.customerRef =  { $exists: true, $ne: null };
  }
  
    console.log("find. inside queryObj ", queryObj);
  const customerSales = await Sale.aggregate([
    // Filter out sales without customer reference (optional)
    {
      $match: 
          queryObj,
    },
    // Lookup customer details
    {
      $lookup: {
        from: 'customers',
        localField: 'customerRef',
        foreignField: '_id',
        as: 'customer'
      }
    },
    // Unwind customer array
    {
      $unwind: '$customer'
    },
    // Group by customer
    {
      $group: {
        _id: '$customerRef',
        customerName: { $first: '$customer.name' },
        customerPhone: { $first: '$customer.phone' },
        customerEmail: { $first: '$customer.email' },
        totalOrders: { $sum: 1 },
        totalAmount: { $sum: '$totalAfterDiscount' },
        totalQuantity: { $sum: '$totalQuantity' },
        totalDiscount: { $sum: '$totalDiscount' },
        totalReceived: { $sum: '$receivedAmount' },
        totalRemaining: { $sum: '$remainingAmount' }
      }
    },
    // Sort by total amount (descending)
    {
      $sort: {
        totalAmount: -1
      }
    },
    // Project final output
    {
      $project: {
        _id: 0,
        customerId: '$_id',
        customerName: 1,
        customerPhone: 1,
        customerEmail: 1,
        totalOrders: 1,
        totalAmount: { $round: ['$totalAmount', 2] },
        totalQuantity: 1,
        totalDiscount: { $round: ['$totalDiscount', 2] },
        totalReceived: { $round: ['$totalReceived', 2] },
        totalRemaining: { $round: ['$totalRemaining', 2] },
        averageOrderValue: { 
          $round: [{ $divide: ['$totalAmount', '$totalOrders'] }, 2] 
        },
        averageQuantityPerOrder: {
          $round: [{ $divide: ['$totalQuantity', '$totalOrders'] }, 2]
        }
      }
    }
  ]);
  
  return customerSales;
};
  // Method 2: Get detailed sales for a specific customer
const getCustomerSalesDetails = async (find) => {
  
  const queryObj = {...find};
  if (find.customerRef) {
    queryObj.customerRef = mongoose.Types.ObjectId(find.customerRef);
  }
  const customerDetails = await Sale.aggregate([
    // Match sales for specific customer
    {
      $match: queryObj,
    },
    // Lookup customer information
    {
      $lookup: {
        from: 'customers',
        localField: 'customerRef',
        foreignField: '_id',
        as: 'customerInfo'
      }
    },
    {
      $unwind: '$customerInfo'
    },
    // Lookup payment method information
    {
      $lookup: {
        from: 'payments',
        localField: 'paymentMethod',
        foreignField: '_id',
        as: 'paymentMethodInfo'
      }
    },
    {
      $unwind: {
        path: '$paymentMethodInfo',
        preserveNullAndEmptyArrays: true
      }
    },
    // Sort by sale date (most recent first)
    {
      $sort: {
        saleDate: -1
      }
    },
    // Project the details
    {
      $project: {
        _id: 0,
        saleId: '$_id',
        orderNo: 1,
        saleDate: 1,
        customer: {
          id: '$customerInfo._id',
          name: '$customerInfo.name',
          phone: '$customerInfo.phone',
          email: '$customerInfo.email'
        },
        saleDetails: '$saleDetail', // All products in this sale
        summary: {
          totalQuantity: 1,
          subTotal: { $round: ['$subTotal', 2] },
          totalDiscount: { $round: ['$totalDiscount', 2] },
          totalAfterDiscount: { $round: ['$totalAfterDiscount', 2] },
          grandTotal: { $round: ['$grandTotal', 2] }
        },
        paymentInfo: {
          method: '$paymentMethodInfo.name',
          methodId: '$paymentMethod',
          accountType: '$accountType',
          accountNumber: '$accountNumber',
          receivedAmount: { $round: ['$receivedAmount', 2] },
          remainingAmount: { $round: ['$remainingAmount', 2] }
        },
        description: 1,
        walkingCustomer: 1
      }
    }
  ]);
  
  return customerDetails;
};
  // 2. Product-wise Sales Report (Most to Least)

    // const getProductWiseSales = async () => {
    //   const productSales = await Sale.aggregate([
    //     // Unwind the saleDetail array instead of products
    //     {
    //       $unwind: '$saleDetail'
    //     },
    //     // Group by product
    //     {
    //       $group: {
    //         _id: '$saleDetail.productRef',
    //         productName: { $first: '$saleDetail.productName' },
    //         totalQuantitySold: { $sum: '$saleDetail.saleQuantity' },
    //         totalRevenue: { $sum: '$saleDetail.totalPrice' },
    //         averagePrice: { 
    //           $avg: '$saleDetail.salePrice' 
    //         },
    //         totalOrders: { $sum: 1 }
    //       }
    //     },
    //     // Sort by quantity sold (descending)
    //     {
    //       $sort: {
    //         totalQuantitySold: -1
    //       }
    //     },
    //     // Project final output
    //     {
    //       $project: {
    //         _id: 0,
    //         productId: '$_id',
    //         productName: 1,
    //         totalQuantitySold: 1,
    //         totalRevenue: { $round: ['$totalRevenue', 2] },
    //         averagePrice: { $round: ['$averagePrice', 2] },
    //         totalOrders: 1
    //       }
    //     }
    //   ]);
    //   return productSales;
    // };
  // Method 1: Get product-wise sales summary
const getProductWiseSalesSummary = async (find) => {

  const queryObj = {...find};
  const productSales = await Sale.aggregate([
    // Unwind the saleDetail array
    {
      $unwind: '$saleDetail'
    },
     // Match specific product
    {
      $match: queryObj,
    },
    // Group by product
    {
      $group: {
        _id: '$saleDetail.productRef',
        productName: { $first: '$saleDetail.productName' },
        totalQuantitySold: { $sum: '$saleDetail.saleQuantity' },
         totalDiscount: { $sum: '$saleDetail.saleDiscount' },
        totalRevenue: { $sum: '$saleDetail.totalPrice' },
        totalProfit: { $sum: '$saleDetail.productProfit' },
        averagePrice: { 
          $avg: '$saleDetail.salePrice' 
        },
        totalOrders: { $sum: 1 },
        saleDetail: { $push: '$saleDetail' }
      }
    },
    // Sort by quantity sold (descending)
    {
      $sort: {
        totalQuantitySold: -1
      }
    },
    // Project final output
    {
      $project: {
        _id: 0,
        productId: '$_id',
        productName: 1,
        totalQuantitySold: 1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
        totalProfit: { $round: ['$totalProfit', 2] },
        averagePrice: { $round: ['$averagePrice', 2] },
        totalOrders: 1,
        totalDiscount: { $round: ['$totalDiscount', 2] },
        saleDetail:1
      }
    }
  ]);
  
  return productSales;
};

// Method 2: Get detailed sales for a specific product
const getProductSalesDetails = async (find) => {
  const queryObject = {...find};
  if (find.productRef) {
    delete queryObject.productRef;
    queryObject['saleDetail.productRef'] = mongoose.Types.ObjectId(find.productRef);
  }
console.log("queryObject inside product details: ", queryObject);
  const productDetails = await Sale.aggregate([
    // Unwind the saleDetail array
    {
      $unwind: '$saleDetail'
    },
    // Match specific product
    {
      $match: queryObject,
    },
    // Lookup customer information
    {
      $lookup: {
        from: 'customers',
        localField: 'customerRef',
        foreignField: '_id',
        as: 'customerInfo'
      }
    },
    {
      $unwind: {
        path: '$customerInfo',
        preserveNullAndEmptyArrays: true // For walking customers
      }
    },
    // Lookup payment method information (optional)
    {
      $lookup: {
        from: 'payments', // Adjust collection name if different
        localField: 'paymentMethod',
        foreignField: '_id',
        as: 'paymentMethodInfo'
      }
    },
    {
      $unwind: {
        path: '$paymentMethodInfo',
        preserveNullAndEmptyArrays: true
      }
    },
    // Sort by sale date (most recent first)
    {
      $sort: {
        saleDate: -1
      }
    },
    // Project the details
    {
      $project: {
        _id: 0,
        saleId: '$_id',
        saleDate: 1,
        customer: {
          id: '$customerInfo._id',
          name: '$customerInfo.name',
          phone: '$customerInfo.phone',
          email: '$customerInfo.email', // Add other customer fields as needed
          isWalkingCustomer: '$walkingCustomer'
        },
        productDetails: {
          productId: '$saleDetail.productRef',
          productName: '$saleDetail.productName',
          batchNumber: '$saleDetail.batchNumber',
          quantity: '$saleDetail.saleQuantity',
          salePrice: '$saleDetail.salePrice',
          
          discount: '$saleDetail.saleDiscount',
          totalPrice: { $round: ['$saleDetail.totalPrice', 2] },
          profit: { $round: ['$saleDetail.productProfit', 2] }
        },
        paymentInfo: {
          method: '$paymentMethodInfo.name', // Adjust based on your Payment schema
          methodId: '$paymentMethod',
          accountType: '$accountType',
          accountNumber: '$accountNumber',
          receivedAmount: { $round: ['$receivedAmount', 2] },
          remainingAmount: { $round: ['$remainingAmount', 2] },
          grandTotal: { $round: ['$grandTotal', 2] }
        },
        description: 1
      }
    }
  ]);
  
  return productDetails;
};

// Optional: Combined method that returns both summary and details
const getProductSalesReport = async (productId) => {
  const [summary] = await Sale.aggregate([
    {
      $unwind: '$saleDetail'
    },
    {
      $match: {
        'saleDetail.productRef': mongoose.Types.ObjectId(productId)
      }
    },
    {
      $group: {
        _id: '$saleDetail.productRef',
        productName: { $first: '$saleDetail.productName' },
        totalQuantitySold: { $sum: '$saleDetail.saleQuantity' },
        totalRevenue: { $sum: '$saleDetail.totalPrice' },
        totalProfit: { $sum: '$saleDetail.productProfit' },
        averagePrice: { 
          $avg: '$saleDetail.salePrice' 
        },
        totalOrders: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        productName: 1,
        totalQuantitySold: 1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
        totalProfit: { $round: ['$totalProfit', 2] },
        averagePrice: { $round: ['$averagePrice', 2] },
        totalOrders: 1
      }
    }
  ]);

  const details = await getProductSalesDetails(productId);

  return {
    summary,
    details
  };
};
  // 3. Customer-wise Profit Report
 // Method 1: Get customer-wise profit summary
const getCustomerWiseProfitSummary = async (find) => {
  const queryObj = { ...find };
  if (queryObj) {
    queryObj.walkingCustomer= false,
    queryObj.customerRef = { $exists: true, $ne: null };
  }
  const customerProfit = await Sale.aggregate([
    // Filter out walking customers (optional - remove if you want to include them)
    {
      $match: queryObj,
    },
    // Unwind saleDetail array
    {
      $unwind: '$saleDetail'
    },
    // Lookup customer details
    {
      $lookup: {
        from: 'customers',
        localField: 'customerRef',
        foreignField: '_id',
        as: 'customer'
      }
    },
    {
      $unwind: '$customer'
    },
    // Group by customer and calculate totals
    {
      $group: {
        _id: '$customerRef',
        customerName: { $first: '$customer.name' },
        customerPhone: { $first: '$customer.phone' },
        customerEmail: { $first: '$customer.email' },
        totalProfit: { $sum: '$saleDetail.productProfit' },
        totalRevenue: { $sum: '$saleDetail.totalPrice' },
        totalQuantitySold: { $sum: '$saleDetail.saleQuantity' },
        totalOrders: { $sum: 1 },
        uniqueSales: { $addToSet: '$_id' }
      }
    },
    // Calculate unique sale count
    {
      $addFields: {
        uniqueSaleCount: { $size: '$uniqueSales' }
      }
    },
    // Sort by profit (descending)
    {
      $sort: {
        totalProfit: -1
      }
    },
    // Project final output
    {
      $project: {
        _id: 0,
        customerId: '$_id',
        customerName: 1,
        customerPhone: 1,
        customerEmail: 1,
        totalProfit: { $round: ['$totalProfit', 2] },
        totalRevenue: { $round: ['$totalRevenue', 2] },
        profitMargin: {
          $round: [
            {
              $cond: {
                if: { $eq: ['$totalRevenue', 0] },
                then: 0,
                else: {
                  $multiply: [
                    { $divide: ['$totalProfit', '$totalRevenue'] },
                    100
                  ]
                }
              }
            },
            2
          ]
        },
        totalQuantitySold: 1,
        totalOrders: 1,
        uniqueSales: '$uniqueSaleCount',
        averageProfitPerOrder: {
          $round: [
            { $divide: ['$totalProfit', '$totalOrders'] },
            2
          ]
        },
        averageRevenuePerOrder: {
          $round: [
            { $divide: ['$totalRevenue', '$totalOrders'] },
            2
          ]
        }
      }
    }
  ]);
  
  return customerProfit;
};

// Method 2: Get detailed sales for a specific customer
const getCustomerProfitDetails = async (find) => {
  const queryObject = {...find};
  if(find.customerRef) {
    queryObject.customerRef = mongoose.Types.ObjectId(find.customerRef);
  }
  const customerDetails = await Sale.aggregate([
    // Match sales for specific customer
    {
      $match: queryObject,
    },
    // Unwind saleDetail array
    {
      $unwind: '$saleDetail'
    },
    // Lookup customer information
    {
      $lookup: {
        from: 'customers',
        localField: 'customerRef',
        foreignField: '_id',
        as: 'customerInfo'
      }
    },
    {
      $unwind: '$customerInfo'
    },
    // Lookup payment method information (optional)
    {
      $lookup: {
        from: 'payments',
        localField: 'paymentMethod',
        foreignField: '_id',
        as: 'paymentMethodInfo'
      }
    },
    {
      $unwind: {
        path: '$paymentMethodInfo',
        preserveNullAndEmptyArrays: true
      }
    },
    // Sort by sale date (most recent first)
    {
      $sort: {
        saleDate: -1
      }
    },
    // Project the details
    {
      $project: {
        _id: 0,
        saleId: '$_id',
        orderNo: 1,
        saleDate: 1,
        customer: {
          id: '$customerInfo._id',
          name: '$customerInfo.name',
          phone: '$customerInfo.phone',
          email: '$customerInfo.email'
        },
        productDetails: {
          productId: '$saleDetail.productRef',
          productName: '$saleDetail.productName',
          batchNumber: '$saleDetail.batchNumber',
          quantity: '$saleDetail.saleQuantity',
          salePrice: { $round: ['$saleDetail.salePrice', 2] },
          discount: { $round: ['$saleDetail.saleDiscount', 2] },
          totalPrice: { $round: ['$saleDetail.totalPrice', 2] },
          profit: { $round: ['$saleDetail.productProfit', 2] },
          profitMargin: {
            $round: [
              {
                $cond: {
                  if: { $eq: ['$saleDetail.totalPrice', 0] },
                  then: 0,
                  else: {
                    $multiply: [
                      { $divide: ['$saleDetail.productProfit', '$saleDetail.totalPrice'] },
                      100
                    ]
                  }
                }
              },
              2
            ]
          }
        },
        paymentInfo: {
          method: '$paymentMethodInfo.name',
          accountType: '$accountType',
          receivedAmount: { $round: ['$receivedAmount', 2] },
          remainingAmount: { $round: ['$remainingAmount', 2] },
          grandTotal: { $round: ['$grandTotal', 2] }
        },
        description: 1
      }
    }
  ]);
  
  return customerDetails;
};

  // In your Sale model controller (e.g., saleController.js)
const getMostProfitableProducts = async (query)=> {
  try {
    const profitableProducts = await Sale.aggregate([
      // Filter by date range
      {
        $match: {
          ...query
        }
      },
      // Unwind the saleDetail array
      { $unwind: '$saleDetail' },
      // Group by product and sum profit
      {
        $group: {
          _id: {
            productId: '$saleDetail.productId',
            productName: '$saleDetail.productName'
          },
          totalProfit: { $sum: '$saleDetail.productProfit' }
        }
      },
      // Sort by total profit descending
      { $sort: { totalProfit: -1 } },
      // Limit to top 5
      { $limit: 5 }
    ]);

    return profitableProducts;
  } catch (error) {
    throw new Error('Error fetching most profitable products: ' + error.message);
  }
}
  // In your Sale model controller
 const topSoldProductsByTime =  async (query) => {
   try {
     const topProducts = await Sale.aggregate([
       // Filter sales within the date range
       {
         $match: {
         ...query
         }
       },
       // Unwind the saleDetail array
       { $unwind: '$saleDetail' },
       // Group by product and date
       {
         $group: {
           _id: {
             productId: '$saleDetail.productId',
             productName: '$saleDetail.productName',
             date: {
               $dateToString: { format: '%Y-%m-%d', date: '$saleDate' }
             }
           },
           totalQuantity: { $sum: '$saleDetail.saleQuantity' }
         }
       },
       // Group again to structure data by product
       {
         $group: {
           _id: {
             productId: '$_id.productId',
             productName: '$_id.productName'
           },
           sales: {
             $push: {
               date: '$_id.date',
               quantity: '$totalQuantity'
             }
           }
         }
       },
       // Sort by total quantity (optional, to get top 5)
       {
         $addFields: {
           totalSold: { $sum: '$sales.quantity' }
         }
       },
       { $sort: { totalSold: -1 } },
       { $limit: 5 }
     ]);
 
     return topProducts;
   } catch (error) {
     throw new Error('Error fetching top products: ' + error.message);
   }
 }
  const getMostSoldAnalytics = async () => {
    try {
      const salesData = await Sale.aggregate([
        // Unwind the saleDetail array to work with individual products
        { $unwind: "$saleDetail" },
        
        // Group by product and month
        {
          $group: {
            _id: {
              productId: "$saleDetail.productRef",
              month: { $month: "$saleDate" },
              year: { $year: "$saleDate" }
            },
            productName: { $first: "$saleDetail.productName" },
            totalQuantity: { $sum: "$saleDetail.saleQuantity" },
            totalRevenue: { 
              $sum: { 
                $multiply: ["$saleDetail.salePrice", "$saleDetail.saleQuantity"] 
              }
            }
          }
        },
        
        // Group by product to get monthly data arrays
        {
          $group: {
            _id: "$_id.productId",
            productName: { $first: "$productName" },
            monthlySales: {
              $push: {
                month: "$_id.month",
                year: "$_id.year",
                quantity: "$totalQuantity",
                revenue: "$totalRevenue"
              }
            },
            totalQuantitySold: { $sum: "$totalQuantity" }
          }
        },
        
        // Sort by total quantity sold to get top products
        { $sort: { totalQuantitySold: -1 } },
        
        // Limit to top 5 products
        { $limit: 5 }
      ]);
  
      return salesData;
    } catch (error) {
      console.error('Error in getSalesAnalytics:', error);
      throw error;
    }
  };

  const loadProfitableProducts = async (find) =>  {
    try {
      // Modify the pipeline to get only necessary data for the chart
     const topProfits = await Sale.aggregate( [
        { 
          $unwind: '$saleDetail' 
        },
        { 
          $match: find  // Your existing match conditions
        },
        {
          $lookup: {
            from: 'stocks',
            localField: 'saleDetail.stockRef',
            foreignField: '_id',
            as: 'stockDetails'
          }
        },
        { 
          $unwind: '$stockDetails' 
        },
        {
          $addFields: {
            profit: {
              $subtract: [
                { 
                  $multiply: [
                    '$saleDetail.salePrice', 
                    '$saleDetail.saleQuantity'
                  ] 
                },
                { 
                  $multiply: [
                    '$stockDetails.priceAfterDeliveryCharges', 
                    '$saleDetail.saleQuantity'
                  ] 
                }
              ]
            }
          }
        },
        {
          $group: {
            _id: '$saleDetail.productRef',
            totalProfit: { $sum: '$profit' },
            totalQuantity: { $sum: '$saleDetail.saleQuantity' },
            productName: { $first: '$saleDetail.productName' }
          }
        },
        { 
          $sort: { 
            totalProfit: -1 
          } 
        },
        { 
          $limit: 8  // Limiting to top 8 products for better chart visualization
        },
        {
          $project: {
            _id: 1,
            productName: 1,
            totalProfit: {
              $round: ['$totalProfit', 2]  // Rounding profit to 2 decimal places
            },
            totalQuantity: 1
          }
        }
      ])
     return topProfits
    } catch (error) {
      console.error('Error loading profitable products:', error);
    }
  }
  
  const getDailySales = async (find) => {
    try {
      const { startDate, endDate } = find;
      
      // Default to last 30 days if no dates provided
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end - 30 * 24 * 60 * 60 * 1000);
  
      // Aggregate daily sales data
      const dailySales = await Sale.aggregate([
        { 
          $match: { 
            saleDate: { $gte: start, $lte: end },
            orderStatus: { $ne: 'cancelled' } // Exclude cancelled orders if applicable
          } 
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } },
            // totalAmount: { $sum: '$grandTotal' },
            invoiceCount: { $sum: 1 },
            // totalQuantity: { $sum: '$totalQuantity' },
            // totalDiscount: { $sum: '$totalDiscount' },
            // avgSaleAmount: { $avg: '$grandTotal' }
          }
        },
        {
          $sort: { '_id': 1 } // Sort by date ascending
        },
        {
          $project: {
            date: '$_id',
            // totalAmount: 1,
            invoiceCount: 1,
            // totalQuantity: 1,
            // totalDiscount: 1,
            // avgSaleAmount: { $round: ['$avgSaleAmount', 2] },
            _id: 0
          }
        }
      ]);
  
      // Calculate summary statistics
      const summary = await Sale.aggregate([
        { $match: { saleDate: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: null,
            // totalRevenue: { $sum: '$grandTotal' },
            totalInvoices: { $sum: 1 },
            // totalItemsSold: { $sum: '$totalQuantity' }
          }
        }
      ]);
  
      return{
        success: true,
        data: {
          dailySales,
          summary: summary[0] || { totalRevenue: 0, totalInvoices: 0, totalItemsSold: 0 }
        }
      }
    } catch (error) {
      console.error(error);
      return new Error('Error fetching daily sales data');
    }
  };
  module.exports = {getCustomerWiseSalesSummary,topSoldProductsByTime,getMostProfitableProducts,
      getCustomerWiseProfitSummary, getMostSoldAnalytics,
       getProductWiseSalesSummary,getCustomerProfitDetails,getCustomerSalesDetails,
     getProductSalesDetails,
     getProductSalesReport,
      loadProfitableProducts,getDailySales};




  