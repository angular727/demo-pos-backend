const express = require('express');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const router = express.Router();
const Sale = require('../sale/saleModel');
const { verifyUser } = require('../../middlewares/authenticate');

function buildMatchQuery({ startDate, endDate, userId }) {
  // userId na ho ya 'all' ho -> pura business (sab users ki sales combine).
  // Warna sirf usi specific user ki sales.
  let matchQuery = {};
  if (userId && userId !== 'all' && mongoose.Types.ObjectId.isValid(userId)) {
    matchQuery.user = new mongoose.Types.ObjectId(userId);
  }
  if (startDate && endDate) {
    matchQuery.saleDate = {
      $gte: new Date(`${startDate}T00:00:00.000Z`),
      $lte: new Date(`${endDate}T23:59:59.999Z`)
    };
  }
  return matchQuery;
}

// NOTE: Bara $push (poora saleDetail array har invoice se ek hi grouped document mein)
// "All Users" jaise bare result-set par MongoDB ki 16MB per-document limit tor deta hai
// (BSONObjectTooLarge). Isliye product-wise sum MongoDB mein hi $unwind + $group se nikalte
// hain — koi bara array kabhi ek document mein jama nahi hota, chahay data kitna bhi ho.
async function getDaysData(matchQuery, search) {
  const searchLower = (search || '').toLowerCase();

  // Har din + product ka combined qty/revenue/profit (same product multiple invoices mein bika ho to add)
  const productAgg = await Sale.aggregate([
    { $match: matchQuery },
    { $addFields: { dayKey: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } } } },
    { $unwind: "$saleDetail" },
    ...(searchLower ? [{ $match: { "saleDetail.productName": { $regex: search, $options: "i" } } }] : []),
    {
      $group: {
        _id: { day: "$dayKey", product: "$saleDetail.productName" },
        qty: { $sum: "$saleDetail.saleQuantity" },
        revenue: { $sum: { $multiply: ["$saleDetail.saleQuantity", "$saleDetail.salePrice"] } },
        // Profit = (Revenue - Cost) - Discount. saleDetail.productProfit field ghalat hai
        // (discount ko totalPrice se subtract nahi karta), isliye discount yahan alag se minus karte hain.
        cost: { $sum: { $multiply: ["$saleDetail.saleQuantity", { $ifNull: ["$saleDetail.batchDetails.unitPrice", 0] }] } },
        discount: { $sum: { $ifNull: ["$saleDetail.saleDiscount", 0] } }
      }
    }
  ]);

  // Combine karna: har din ke andar products jama karo, taake koi bhi bika hua product miss na ho
  const dayMap = {};
  productAgg.forEach(p => {
    const day = p._id.day;
    if (!dayMap[day]) dayMap[day] = { date: day, products: [] };
    const revenue = p.revenue || 0;
    const cost = p.cost || 0;
    const discount = p.discount || 0;
    dayMap[day].products.push({
      productName: p._id.product || 'Unknown',
      totalQuantitySold: p.qty || 0,
      calcRevenue: Math.round(revenue),
      calcNetProfit: Math.round((revenue - cost) - discount)
    });
  });

  // Har din ke totals hamesha uski product-list ka sum hain.
  // Items = din mein kitne alag (distinct) products bikay (invoice count nahi).
  return Object.values(dayMap)
    .map((day) => {
      const products = day.products.sort((a, b) => b.totalQuantitySold - a.totalQuantitySold);
      return {
        date: day.date,
        items: products.length,
        totalQty: products.reduce((s, p) => s + p.totalQuantitySold, 0),
        totalRevenue: products.reduce((s, p) => s + p.calcRevenue, 0),
        totalNetProfit: products.reduce((s, p) => s + p.calcNetProfit, 0),
        products
      };
    })
    .filter(day => !searchLower || day.products.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

router.get('/', verifyUser, async (req, res) => {
  try {
    const { startDate, endDate, search, userId, page = 1, limit = 50 } = req.query;
    const matchQuery = buildMatchQuery({ startDate, endDate, userId });
    const allDays = await getDaysData(matchQuery, search);

    const total = allDays.length;
    const start = (page - 1) * limit;
    const finalData = allDays.slice(start, start + parseInt(limit));

    res.json({ success: true, data: finalData, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /day-by-day-product-report/excel?startDate=&endDate=&userId=&search=
// Poore date-range ka complete data ek .xlsx file mein download karta hai (backend se generate hoti hai).
router.get('/excel', verifyUser, async (req, res) => {
  try {
    const { startDate, endDate, search, userId } = req.query;
    const matchQuery = buildMatchQuery({ startDate, endDate, userId });
    const allDays = await getDaysData(matchQuery, search);

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Product-wise detail (har din ka har product, kuch bhi miss nahi) — pehli/default sheet,
    // taake file kholte hi saare items (qty/revenue/profit) foran dikhein.
    const detailSheet = workbook.addWorksheet('Product Details');
    detailSheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Product Name', key: 'productName', width: 40 },
      { header: 'Qty', key: 'qty', width: 10 },
      { header: 'Revenue', key: 'revenue', width: 14 },
      { header: 'Profit', key: 'profit', width: 14 }
    ];
    detailSheet.getRow(1).font = { bold: true };
    allDays.forEach(day => {
      day.products.forEach(p => {
        detailSheet.addRow({ date: day.date, productName: p.productName, qty: p.totalQuantitySold, revenue: p.calcRevenue, profit: p.calcNetProfit });
      });
    });
    detailSheet.addRow({
      date: '',
      productName: 'GRAND TOTAL',
      qty: allDays.reduce((s, d) => s + d.totalQty, 0),
      revenue: allDays.reduce((s, d) => s + d.totalRevenue, 0),
      profit: allDays.reduce((s, d) => s + d.totalNetProfit, 0)
    }).font = { bold: true };

    // Sheet 2: Daily Summary
    const summarySheet = workbook.addWorksheet('Daily Summary');
    summarySheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Items', key: 'items', width: 10 },
      { header: 'Qty', key: 'qty', width: 10 },
      { header: 'Revenue', key: 'revenue', width: 14 },
      { header: 'Profit', key: 'profit', width: 14 }
    ];
    summarySheet.getRow(1).font = { bold: true };
    allDays.forEach(day => {
      summarySheet.addRow({ date: day.date, items: day.items, qty: day.totalQty, revenue: day.totalRevenue, profit: day.totalNetProfit });
    });
    summarySheet.addRow({
      date: 'GRAND TOTAL',
      items: allDays.reduce((s, d) => s + d.items, 0),
      qty: allDays.reduce((s, d) => s + d.totalQty, 0),
      revenue: allDays.reduce((s, d) => s + d.totalRevenue, 0),
      profit: allDays.reduce((s, d) => s + d.totalNetProfit, 0)
    }).font = { bold: true };

    detailSheet.views = [{ state: 'frozen', ySplit: 1 }];
    summarySheet.views = [{ state: 'frozen', ySplit: 1 }];
    workbook.views = [{ activeTab: 0 }];

    const fileName = `Product-Sales-Report-${startDate || 'all'}_to_${endDate || 'all'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
