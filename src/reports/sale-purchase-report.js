const mongoose = require('mongoose');
const Sale = require("../sale/saleModel");
const Purchase = require("../purchaseInvoice/puchaseModel");
async function generateDailyReport(find) {
    
//   const start = new Date(query?.startDate);
//   start.setHours(0, 0, 0, 0);
  
//   const end = new Date(query?.endDate);
//   end.setHours(23, 59, 59, 999);

  // Get daily purchases
  const dailyPurchases = await Purchase.aggregate([
    {
      $match: find
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%d-%b-%Y", date: "$purchaseDate" }
        },
        totalPurchase: { $sum: "$totalAfterDiscount" },
        // purchaseDiscount: { $sum: "$totalDiscount" },
        // netPurchase: { $sum: { $subtract: ["$subTotal", "$totalDiscount"] } }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  // Get daily sales
  const dailySales = await Sale.aggregate([
    {
      $match:find
    },
    {
      $unwind: "$saleDetail"
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%d-%b-%Y", date: "$saleDate" }
        },
        totalSale: { $sum: "$totalAfterDiscount" },
        // saleDiscount: { $sum: "$saleDetail.saleDiscount" },
        // netSale: { 
        //   $sum: { 
        //     $subtract: ["$saleDetail.totalPrice", "$saleDetail.saleDiscount"] 
        //   } 
        // }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  // Combine purchase and sales data
  const dateSet = new Set([
    ...dailyPurchases.map(p => p._id),
    ...dailySales.map(s => s._id)
  ]);

  const dailyReport = Array.from(dateSet).sort().map(date => {
    const purchase = dailyPurchases.find(p => p._id === date) || {
      totalPurchase: 0,
    //   purchaseDiscount: 0,
    //   netPurchase: 0
    };

    const sale = dailySales.find(s => s._id === date) || {
      totalSale: 0,
    //   saleDiscount: 0,
    //   netSale: 0
    };

    // const profit = sale.netSale - purchase.netPurchase;

    return {
      date,
      purchase: {
        gross: purchase.totalPurchase,
        // discount: purchase.purchaseDiscount,
        // net: purchase.netPurchase
      },
      sale: {
        gross: sale.totalSale,
        // discount: sale.saleDiscount,
        // net: sale.netSale
      },
    //   profit
    };
  });

  return dailyReport;
}

module.exports = generateDailyReport;
// Example usage:
/*
const report = await generateDailyReport('2024-10-07', '2024-10-14');
console.table(report.map(day => ({
  Date: day.date,
  'Purchase (Net)': day.purchase.net.toFixed(2),
  'Sale (Net)': day.sale.net.toFixed(2),
  'Profit': day.profit.toFixed(2)
})));
*/