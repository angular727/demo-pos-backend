const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const ExcelJS = require('exceljs');
const Inventory = require('../inventory/inventoryModel');
const Stock = require('../stock/stockModel');
const Sale = require('../sale/saleModel');
const Purchase = require('../purchaseInvoice/puchaseModel');
const { verifyUser } = require('../../middlewares/authenticate');

// ============================================================
// REPORT CONFIG
// ============================================================
const reportConfigs = {

  inventory: {
    model: Inventory,
    searchFields: ['productName', 'batchNumber'], 
    dateField: 'createdAt',
    lookups: [],
    project: {
      productName:     '$productName',
      productNameUrdu: '$ProductsNameurdu',
      batchNumber:      '$batchNumber',
      inventoryNo:      '$inventoryNo',
      stockQty:         { $ifNull: ['$totalInventory', 0] },
      unitPrice:        { $round: [{ $toDouble: { $ifNull: ['$unitPrice', 0] } }, 2] },
      salePrice:        { $round: [{ $toDouble: { $ifNull: ['$salePrice', 0] } }, 2] },
      totalValue: {
        $round: [
          {
            $multiply: [
              { $toDouble: { $ifNull: ['$unitPrice', 0] } },
              { $toDouble: { $ifNull: ['$totalInventory', 0] } }
            ]
          },
          2
        ]
      },
      expiryDate: '$expiryDate',
      place:      '$place'
    },
    summaryField: 'totalValue',
    summaryLabel: 'totalStockValue',
    summaryFields: {
      totalStockQty:   'stockQty',
      totalUnitPrice:  'unitPrice',
      totalSalePrice:  'salePrice',
      totalTotalValue: 'totalValue'
    }
  },

  stock: {
    model: Stock,
    dateField: 'createdAt',
    searchFields: ['productName'],
    lookups: [
      { from: 'products', localField: 'productRef', foreignField: '_id', as: 'p' }
    ],
    project: {
      productName:     { $ifNull: [{ $arrayElemAt: ['$p.name', 0] }, ''] },
      productNameUrdu: { $ifNull: [{ $arrayElemAt: ['$p.ProductsNameurdu', 0] }, ''] },
      stockNo:          '$stockNo',
      stockQty:         { $ifNull: ['$totalStock', 0] },
      unitPrice:        { $round: [{ $toDouble: { $ifNull: ['$pricePerPiece', 0] } }, 2] },
      salePrice:        { $round: [{ $toDouble: { $ifNull: ['$salePrice', 0] } }, 2] },
      totalValue: {
        $round: [
          {
            $multiply: [
              { $toDouble: { $ifNull: ['$pricePerPiece', 0] } },
              { $toDouble: { $ifNull: ['$totalStock', 0] } }
            ]
          },
          2
        ]
      },
      expiryDate: '$expiryDate',
      place:      '$place'
    },
    summaryField: 'totalValue',
    summaryLabel: 'totalStockValue',
    summaryFields: {
      totalStockQty:   'stockQty',
      totalUnitPrice:  'unitPrice',
      totalSalePrice:  'salePrice',
      totalTotalValue: 'totalValue'
    }
  },

sale: {
  model: Sale,
  dateField: 'saleDate',
  searchFields: ['invoiceNo', 'customerName'], 
  lookups: [
    { from: 'customers', localField: 'customerRef', foreignField: '_id', as: 'c' }
  ],
  project: {
    invoiceNo: '$orderNo',
    date:      '$saleDate',
    customerName: {
      $cond: [
        { $eq: ['$walkingCustomer', true] },
        'Walking',
        { $ifNull: [{ $arrayElemAt: ['$c.name', 0] }, 'Walking'] }
      ]
    },
    qty: { $sum: '$saleDetail.saleQuantity' },

    grandTotal: { $round: [{ $toDouble: { $ifNull: ['$grandTotal', 0] } }, 2] },
    received:   { $round: [{ $toDouble: { $ifNull: ['$receivedAmount', 0] } }, 2] },
    discount:   { $round: [{ $toDouble: { $ifNull: ['$totalDiscount', 0] } }, 2] },

    // FIX: productProfit field pe trust nahi, batchDetails.unitPrice se live calculate
    costTotal: {
      $round: [
        {
          $sum: {
            $map: {
              input: '$saleDetail',
              as: 'item',
              in: {
                $multiply: [
                  { $toDouble: { $ifNull: ['$$item.batchDetails.unitPrice', 0] } },
                  { $toDouble: { $ifNull: ['$$item.saleQuantity', 0] } }
                ]
              }
            }
          }
        },
        2
      ]
    },

    netProfit: {
      $round: [
        {
          $subtract: [
            {
              $sum: {
                $map: {
                  input: '$saleDetail',
                  as: 'item',
                  in: {
                    $multiply: [
                      {
                        $subtract: [
                          { $toDouble: { $ifNull: ['$$item.salePrice', 0] } },
                          { $toDouble: { $ifNull: ['$$item.batchDetails.unitPrice', 0] } }
                        ]
                      },
                      { $toDouble: { $ifNull: ['$$item.saleQuantity', 0] } }
                    ]
                  }
                }
              }
            },
            { $toDouble: { $ifNull: ['$totalDiscount', 0] } }
          ]
        },
        2
      ]
    }
  },
  // summaryField: 'netProfit',
  // summaryLabel: 'totalProfit'
  summaryField: 'netProfit',
  summaryLabel: 'totalProfit',
  summaryFields: {
    totalQty:        'qty',
    totalCostTotal:  'costTotal',
    totalGrandTotal: 'grandTotal',
    totalReceived:   'received',
    totalDiscount:   'discount',
    totalNetProfit:  'netProfit'
  }

},

purchase: {
  model: Purchase,
  dateField: 'purchaseDate',
  searchFields: ['invoiceNo', 'supplierName'],
  lookups: [
    { from: 'suppliers', localField: 'supplierRef', foreignField: '_id', as: 's' }
  ],
  project: {
    invoiceNo:    '$invoiceNo',
    date:         '$purchaseDate',
    supplierName: { $ifNull: [{ $arrayElemAt: ['$s.name', 0] }, '-'] },
    products:     { $size: { $ifNull: ['$itemDetails', []] } },
    grandTotal:   { $round: [{ $toDouble: { $ifNull: ['$totalAfterDiscount', 0] } }, 2] },
    paidAmount:   { $round: [{ $toDouble: { $ifNull: ['$paidAmount', 0] } }, 2] },
    remaining: {
      $round: [
        {
          $subtract: [
            { $toDouble: { $ifNull: ['$totalAfterDiscount', 0] } },
            { $toDouble: { $ifNull: ['$paidAmount', 0] } }
          ]
        },
        2
      ]
    }
  },
//   summaryField: 'grandTotal',
//   summaryLabel: 'totalPurchaseValue'
// }
summaryField: 'grandTotal',
  summaryLabel: 'totalPurchaseValue',
  summaryFields: {
    totalProducts:    'products',
    totalGrandTotal:  'grandTotal',
    totalPaidAmount:  'paidAmount',
    totalRemaining:   'remaining'
  }
},

stockValuation: {
  model: Inventory,
  dateField: 'createdAt',
  searchFields: ['productName', 'productIdStr'],
  lookups: [],
  groupByProduct: true,
  project: {
    productId:       '$productId',
    productIdStr:    { $toString: { $ifNull: ['$productId', 0] } },
    productName:     '$productName',
    productNameUrdu: '$ProductsNameurdu',
    batchNumber:     '$batchNumber',
    totalUnits:      { $ifNull: ['$totalUnits', 0] },
    stockQty:        { $ifNull: ['$totalInventory', 0] },
    soldQty: {
      $subtract: [
        { $ifNull: ['$totalUnits', 0] },
        { $ifNull: ['$totalInventory', 0] }
      ]
    },
    unitPrice: { $round: [{ $toDouble: { $ifNull: ['$unitPrice', 0] } }, 2] },
    salePrice: { $round: [{ $toDouble: { $ifNull: ['$salePrice', 0] } }, 2] },
    buyValue: {
      $round: [{ $multiply: [
        { $toDouble: { $ifNull: ['$unitPrice', 0] } },
        { $toDouble: { $ifNull: ['$totalInventory', 0] } }
      ] }, 2]
    },
    saleValue: {
      $round: [{ $multiply: [
        { $toDouble: { $ifNull: ['$salePrice', 0] } },
        { $toDouble: { $ifNull: ['$totalInventory', 0] } }
      ] }, 2]
    },
    profit: {
      $round: [{ $multiply: [
        { $subtract: [
          { $toDouble: { $ifNull: ['$salePrice', 0] } },
          { $toDouble: { $ifNull: ['$unitPrice', 0] } }
        ] },
        { $toDouble: { $ifNull: ['$totalInventory', 0] } }
      ] }, 2]
    },
    expiryDate: '$expiryDate',
    place:      '$place',
    date:       '$createdAt'
  },
  summaryField: 'profit',
  summaryLabel: 'totalProfit',
  summaryFields: {
    totalPurchase:  'totalUnits',
    totalSold:      'soldQty',
    totalAvailable: 'stockQty',
    totalCostValue: 'buyValue',
    totalSaleValue: 'saleValue',
    totalProfit:    'profit'
  }
}

};

// ============================================================
// Helper — pipeline banata hai
// ============================================================
function buildPipeline(config, matchQuery, skip = null, limit = null, search = '') {   // <-- 'search' param add
  let pipeline = [{ $match: matchQuery }];

  config.lookups.forEach(lk => {
    pipeline.push({
      $lookup: { from: lk.from, localField: lk.localField, foreignField: lk.foreignField, as: lk.as }
    });
  });

  pipeline.push({ $addFields: config.project });

  // SEARCH FILTER - ADD
if (search && search.trim() !== '' && config.searchFields?.length) {
    const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pipeline.push({
      $match: {
        $or: config.searchFields.map(f => ({
          [f]: { $regex: safeSearch, $options: 'i' }
        }))
      }
    });
  }
  // END ADD

  if (config.groupByProduct) {
    pipeline.push({ $sort: { date: -1 } });
    pipeline.push({
      $group: {
        _id: '$productId',
        productId:       { $first: '$productId' },
        productName:     { $first: '$productName' },
        productNameUrdu: { $first: '$productNameUrdu' },
        batchCount:      { $sum: 1 },
        totalUnits:      { $sum: '$totalUnits' },
        stockQty:        { $sum: '$stockQty' },
        soldQty:         { $sum: '$soldQty' },
        buyValue:        { $sum: '$buyValue' },
        saleValue:       { $sum: '$saleValue' },
        profit:          { $sum: '$profit' },
        unitPrice:       { $first: '$unitPrice' },
        salePrice:       { $first: '$salePrice' },
        date:            { $first: '$date' },
        place:           { $first: '$place' }
      }
    });
  }
  // END GROUP

  const sortField = config.groupByProduct ? 'date' : config.dateField;   // <-- ADD

  if (skip !== null && limit !== null) {
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $sort: { [sortField]: -1 } }, { $skip: skip }, { $limit: limit }],
        // summary: [
        //   { $group: { _id: null, total: { $sum: `$${config.summaryField}` }, count: { $sum: 1 } } }
        // ]
        summary: [
          { $group: (() => {
              const g = { _id: null, total: { $sum: `$${config.summaryField}` }, count: { $sum: 1 } };
              if (config.summaryFields) {
                Object.entries(config.summaryFields).forEach(([key, field]) => {
                  g[key] = { $sum: `$${field}` };
                });
              }
              return g;
            })()
          }
        ]
      }
    });
} else {
    pipeline.push({ $sort: { [sortField]: -1 } });
  }

  return pipeline;
}

// ============================================================
// 1. PAGINATED REPORT
// ============================================================
router.get('/', verifyUser, async (req, res) => {
  try {
   let { reportType, startDate, endDate, page = 1, limit = 50, user, search } = req.query;   // <-- 'search' add


    const config = reportConfigs[reportType];
    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid reportType: ' + reportType });
    }

    // Admin agar kisi specific user ka data dekhna chahta hai, to user query param say
let targetuser = req.user._id; // By default login user ki ID

    if (user && user !== 'all' && user !== '') {
      targetuser = new mongoose.Types.ObjectId(user);
    }

    let matchQuery = { user: targetuser };

    if (startDate && endDate && startDate !== 'undefined' && startDate !== '') {
      matchQuery[config.dateField] = {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

const skip = (parseInt(page) - 1) * parseInt(limit);
const pipeline = buildPipeline(config, matchQuery, skip, parseInt(limit), search);   // <-- 'search' pass
    const result = await config.model.aggregate(pipeline);

    res.json({
      success: true,
      data: result[0].data,
      total: result[0].metadata[0]?.total || 0,
      // summary: {
      //   total: result[0].summary[0]?.total || 0,
      //   count: result[0].summary[0]?.count || 0,
      //   label: config.summaryLabel
      // }
      summary: {
        total: result[0].summary[0]?.total || 0,
        count: result[0].summary[0]?.count || 0,
        label: config.summaryLabel,
        ...(config.summaryFields
          ? Object.fromEntries(
              Object.keys(config.summaryFields).map(k => [k, result[0].summary[0]?.[k] || 0])
            )
          : {})
      }
    });
  } catch (err) {
    console.error('Universal Report Error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ============================================================
// 2. EXCEL EXPORT
// ============================================================
router.get('/excel', verifyUser, async (req, res) => {
  try {
  let { reportType, startDate, endDate, columns, user, search } = req.query;   // <-- 'search' add
    let selectedColumns = Array.isArray(columns) ? columns : (columns ? [columns] : []);

    const config = reportConfigs[reportType];
    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid reportType: ' + reportType });
    }

let targetuser = req.user._id;
if (user && user !== 'all' && user !== '') {
  targetuser = new mongoose.Types.ObjectId(user);
}
    let matchQuery = { user: targetuser };
    if (startDate && endDate && startDate !== 'undefined' && startDate !== '') {
      matchQuery[config.dateField] = {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    const pipeline = buildPipeline(config, matchQuery, null, null, search);   // <-- 'search' pass
    const rows = await config.model.aggregate(pipeline);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(reportType.toUpperCase() + ' Report');

    const colKeys = selectedColumns.length > 0 ? selectedColumns : Object.keys(config.project);

    sheet.columns = colKeys.map(k => ({ header: k, key: k, width: 20 }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };

    rows.forEach(row => {
      let rowData = {};
      colKeys.forEach(k => {
        let val = row[k];
        if (val instanceof Date) val = val.toLocaleDateString('en-GB');
        rowData[k] = val;
      });
      sheet.addRow(rowData);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report-${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Universal Report Excel Error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

module.exports = router;