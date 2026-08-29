
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const transactionRouter = express.Router();
const cors = require("../cors");
const Transaction = require("./transactionModel");
const Sale = require("../sale/saleModel");
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const newQueryBuilder = require('../shared/newQueryBuilder')
const mongoose  = require("mongoose");
const ROLES = require("../shared/rolesConstant");
var moment = require("moment");
const {getOpeningBalanceWithEntityDetails} = require('./transactionCommon')

transactionRouter.use(bodyParser.json());

transactionRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    const find = queryBuilder(req);
     try {

    // Transaction.aggregate([
    //   {
    //     $match: {
    //       customerId: mongoose.Types.ObjectId(customerId) // Match transactions for the specific customer
    //     }
    //   },
    //   {
    //     $group: {
    //       _id: null,
    //       totalDebit: { $sum: "$debit" } // Sum up all debit amounts
    //     }
    //   }
    // ])
    
    Transaction.find(find)
    .populate({
      path: 'paymentMethod',
    })
      
      .then(
        (Transaction) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Transaction);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
    }
    catch(err){
        res.json(err);
    }
  })
 //post call for to create
 .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
  const transactionData ={...req.body, user: req.user._id,} 
  Transaction.create(transactionData)
    .then(
      (data) => {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.json(data);
      },
      (err) => {
      
          next(err);            

      }
    )
    .catch((err) => next(err));
})

  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /Transaction");
  });

  transactionRouter
  .route("/summary")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
  
    try {
   
    
      const find = queryBuilder(req);
      // Build match condition based on provided parameters
      if(req.query.entityType == 'All'){
        delete req.query.entityType
      }else{
        if (req.query.entityId) {
          find.entityId = new mongoose.Types.ObjectId(req.query.entityId);
          delete req.query.entityId
        }
        if (req.query.entityType) {
          find.entityType = req.query.entityType;
          delete req.query.entityType
        }
      }
     
    
       // If neither parameter is provided, return error
       if (!find.entityId && !find.entityType) {
        return res.status(400).json({
            success: false,
            message: 'Please provide either entityId or entityType'
        });
    }
    
     

      const summary = await Transaction.aggregate([
          // Match documents based on provided criteria
          { $match: find },
          
          // Group and calculate totals
          {
              $group: {
                  _id: null,
                  totalDebit: { $sum: '$debit' },
                  totalCredit: { $sum: '$credit' },
                  // transactions: { $push: '$$ROOT' }
              }
          },
          
          // Calculate balance and format response
          {
              $project: {
                  _id: 0,
                  totalDebit: 1,
                  totalCredit: 1,
                  balance: { $subtract: ['$totalDebit', '$totalCredit'] },
                  // transactions: 1
              }
          }
      ]);

      // Handle case when no transactions are found
      if (!summary.length) {
          return res.status(200).json({
              success: true,
              data: {
                  totalDebit: 0,
                  totalCredit: 0,
                  balance: 0,
                  // transactions: []
              }
          });
      }

      res.status(200).json({
          success: true,
          data: summary[0]
      });

  } catch (error) {
      console.error('Error in getTransactionSummary:', error);
      res.status(500).json({
          success: false,
          message: 'Error calculating transaction summary',
          error: error.message
      });
  }
  });
//transactions summaries

// Assuming your Transaction model is already defined
// const Transaction = require('../models/Transaction');

/**
 * GET /api/transactions/summary
 * Query parameters:
 * - startDate: Start date for filtering (YYYY-MM-DD)
 * - endDate: End date for filtering (YYYY-MM-DD)
 * - reason: Optional filter by specific reason
 */

transactionRouter
  .route("/summarized-reason")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions,verifyUser, async (req, res, next) => {

  try {
    const { startDate, endDate, reason } = req.query;
    
    // Build match conditions
    const matchConditions = {};
    
    // Date range filter
    if (startDate || endDate) {
      matchConditions.transactionDate = {};
      if (startDate) {
        matchConditions.transactionDate.$gte = new Date(startDate);
      }
      if (endDate) {
        matchConditions.transactionDate.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }
    
    // Reason filter
    if (reason) {
      matchConditions.reason = reason;
    }
 

    // Aggregation pipeline
    const pipeline = [
      { $match: matchConditions },
      {
        $group: {
          _id: '$reason',
          totalDebit: { $sum: '$debit' },
          totalCredit: { $sum: '$credit' },
          transactionCount: { $sum: 1 },
          transactions: {
            $push: {
              _id: '$_id',
              description: '$description',
              debit: '$debit',
              credit: '$credit',
              transactionDate: '$transactionDate',
              entityName: '$entityName',
              entityType: '$entityType'
            }
          }
        }
      },
      {
        $project: {
          reason: '$_id',
          totalDebit: 1,
          totalCredit: 1,
          netAmount: { $subtract: ['$totalCredit', '$totalDebit'] },
          transactionCount: 1,
          transactions: 1,
          _id: 0
        }
      },
      { $sort: { reason: 1 } }
    ];

    const reasonSummary = await Transaction.aggregate(pipeline);

    // Calculate overall totals
    const overallTotals = await Transaction.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: null,
          totalCashIn: { $sum: '$credit' },
          totalCashOut: { $sum: '$debit' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    const totals = overallTotals[0] || {
      totalCashIn: 0,
      totalCashOut: 0,
      totalTransactions: 0
    };

    const profitLoss = totals.totalCashIn - totals.totalCashOut;

    // Response object
    const response = {
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      reasonFilter: reason || null,
      summary: {
        totalCashIn: totals.totalCashIn,
        totalCashOut: totals.totalCashOut,
        profitLoss: profitLoss,
        profitLossStatus: profitLoss >= 0 ? 'Profit' : 'Loss',
        totalTransactions: totals.totalTransactions
      },
      reasonBreakdown: reasonSummary,
      generatedAt: new Date()
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction summary',
      error: error.message
    });
  }
});

// Get unique reasons for dropdown
transactionRouter
  .route("/reasons")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions,verifyUser, async (req, res, next) => {
  try {
    const reasons = await Transaction.distinct('reason');
  
    res.json({
      success: true,
      data: reasons.filter(reason => reason) // Remove null/undefined values
    });
  } catch (error) {
    console.error('Error fetching reasons:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reasons',
      error: error.message
    });
  }
});
  //get transaction all
  transactionRouter
    .route('/customer-aging-report' )
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
// Alternative implementation using aggregation pipeline
.get(cors.corsWithOptions, async (req, res, next) => {   

 try {
        const { asOfDate, customerId } = req.query;
        
        // Set default date to today if not provided
        const reportDate = asOfDate ? new Date(asOfDate) : new Date();
        
        // Build match conditions
        let matchConditions = {
            entityType: 'Customer',
            transactionDate: { $lte: reportDate }
        };
        
        // If specific customer requested
        if (customerId) {
            matchConditions.entityId = customerId;
        }
        
        // Aggregate pipeline to calculate aging
        const agingReport = await Transaction.aggregate([
            {
                $match: matchConditions
            },
            {
                $addFields: {
                    // Calculate balance (debit - credit for customers)
                    balance: { $subtract: ['$debit', '$credit'] },
                    // Calculate days old
                    daysOld: {
                        $divide: [
                            { $subtract: [reportDate, '$transactionDate'] },
                            86400000 // milliseconds in a day
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        entityId: '$entityId',
                        entityName: '$entityName'
                    },
                    transactions: {
                        $push: {
                            transactionId: '$_id',
                            reason: '$reason',
                            reasonReadableNo: '$reasonReadableNo',
                            description: '$description',
                            debit: '$debit',
                            credit: '$credit',
                            balance: '$balance',
                            transactionDate: '$transactionDate',
                            daysOld: { $floor: '$daysOld' }
                        }
                    },
                    totalBalance: { $sum: '$balance' }
                }
            },
            {
                $addFields: {
                    // Categorize amounts by age
                    current: {
                        $sum: {
                            $map: {
                                input: '$transactions',
                                as: 'txn',
                                in: {
                                    $cond: [
                                        { $lte: ['$$txn.daysOld', 0] },
                                        '$$txn.balance',
                                        0
                                    ]
                                }
                            }
                        }
                    },
                    days1to30: {
                        $sum: {
                            $map: {
                                input: '$transactions',
                                as: 'txn',
                                in: {
                                    $cond: [
                                        { 
                                            $and: [
                                                { $gt: ['$$txn.daysOld', 0] },
                                                { $lte: ['$$txn.daysOld', 30] }
                                            ]
                                        },
                                        '$$txn.balance',
                                        0
                                    ]
                                }
                            }
                        }
                    },
                    days31to60: {
                        $sum: {
                            $map: {
                                input: '$transactions',
                                as: 'txn',
                                in: {
                                    $cond: [
                                        { 
                                            $and: [
                                                { $gt: ['$$txn.daysOld', 30] },
                                                { $lte: ['$$txn.daysOld', 60] }
                                            ]
                                        },
                                        '$$txn.balance',
                                        0
                                    ]
                                }
                            }
                        }
                    },
                    days61to90: {
                        $sum: {
                            $map: {
                                input: '$transactions',
                                as: 'txn',
                                in: {
                                    $cond: [
                                        { 
                                            $and: [
                                                { $gt: ['$$txn.daysOld', 60] },
                                                { $lte: ['$$txn.daysOld', 90] }
                                            ]
                                        },
                                        '$$txn.balance',
                                        0
                                    ]
                                }
                            }
                        }
                    },
                    over90Days: {
                        $sum: {
                            $map: {
                                input: '$transactions',
                                as: 'txn',
                                in: {
                                    $cond: [
                                        { $gt: ['$$txn.daysOld', 90] },
                                        '$$txn.balance',
                                        0
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            {
                $match: {
                    totalBalance: { $ne: 0 } // Only show customers with outstanding balances
                }
            },
            {
                $project: {
                    customerId: '$_id.entityId',
                    customerName: '$_id.entityName',
                    totalBalance: 1,
                    current: { $round: ['$current', 2] },
                    days1to30: { $round: ['$days1to30', 2] },
                    days31to60: { $round: ['$days31to60', 2] },
                    days61to90: { $round: ['$days61to90', 2] },
                    over90Days: { $round: ['$over90Days', 2] },
                    transactions: {
                        $filter: {
                            input: '$transactions',
                            as: 'txn',
                            cond: { $ne: ['$$txn.balance', 0] }
                        }
                    },
                    _id: 0
                }
            },
            {
                $sort: { totalBalance: -1 } // Sort by highest balance first
            }
        ]);
        
        // Calculate summary totals
        const summary = agingReport.reduce((acc, customer) => {
            acc.totalOutstanding += customer.totalBalance;
            acc.totalCurrent += customer.current;
            acc.totalDays1to30 += customer.days1to30;
            acc.totalDays31to60 += customer.days31to60;
            acc.totalDays61to90 += customer.days61to90;
            acc.totalOver90Days += customer.over90Days;
            return acc;
        }, {
            totalOutstanding: 0,
            totalCurrent: 0,
            totalDays1to30: 0,
            totalDays31to60: 0,
            totalDays61to90: 0,
            totalOver90Days: 0
        });
        
        // Round summary values
        Object.keys(summary).forEach(key => {
            summary[key] = Math.round(summary[key] * 100) / 100;
        });
        
        res.json({
            success: true,
            data: {
                reportDate: reportDate.toISOString().split('T')[0],
                summary,
                customers: agingReport,
                totalCustomers: agingReport.length
            }
        });
        
    } catch (error) {
        console.error('Error generating aging report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating customer aging report',
            error: error.message
        });
    }
})
   
  transactionRouter
    .route('/customer-aging-report/:customerId' )
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
// Alternative implementation using aggregation pipeline
.get(cors.corsWithOptions, async (req, res, next) => {   
try {
        const { customerId } = req.params;
        const { asOfDate } = req.query;
        
        const reportDate = asOfDate ? new Date(asOfDate) : new Date();
        
        const customerAging = await Transaction.aggregate([
            {
                $match: {
                    entityType: 'Customer',
                    entityId: customerId,
                    transactionDate: { $lte: reportDate }
                }
            },
            {
                $addFields: {
                    balance: { $subtract: ['$debit', '$credit'] },
                    daysOld: {
                        $floor: {
                            $divide: [
                                { $subtract: [reportDate, '$transactionDate'] },
                                86400000
                            ]
                        }
                    }
                }
            },
            {
                $match: {
                    balance: { $ne: 0 } // Only non-zero balances
                }
            },
            {
                $addFields: {
                    ageCategory: {
                        $switch: {
                            branches: [
                                { case: { $lte: ['$daysOld', 0] }, then: 'Current' },
                                { case: { $lte: ['$daysOld', 30] }, then: '1-30 Days' },
                                { case: { $lte: ['$daysOld', 60] }, then: '31-60 Days' },
                                { case: { $lte: ['$daysOld', 90] }, then: '61-90 Days' }
                            ],
                            default: 'Over 90 Days'
                        }
                    }
                }
            },
            {
                $sort: { transactionDate: 1 }
            },
            {
                $project: {
                    transactionId: '$_id',
                    reason: 1,
                    reasonReadableNo: 1,
                    description: 1,
                    debit: 1,
                    credit: 1,
                    balance: { $round: ['$balance', 2] },
                    transactionDate: 1,
                    daysOld: 1,
                    ageCategory: 1,
                    _id: 0
                }
            }
        ]);
        
        if (customerAging.length === 0) {
            return res.json({
                success: true,
                data: {
                    message: 'No outstanding balance for this customer',
                    customerId,
                    reportDate: reportDate.toISOString().split('T')[0],
                    transactions: [],
                    summary: {
                        totalBalance: 0,
                        current: 0,
                        days1to30: 0,
                        days31to60: 0,
                        days61to90: 0,
                        over90Days: 0
                    }
                }
            });
        }
        
        // Calculate summary for this customer
        const summary = customerAging.reduce((acc, txn) => {
            acc.totalBalance += txn.balance;
            switch (txn.ageCategory) {
                case 'Current':
                    acc.current += txn.balance;
                    break;
                case '1-30 Days':
                    acc.days1to30 += txn.balance;
                    break;
                case '31-60 Days':
                    acc.days31to60 += txn.balance;
                    break;
                case '61-90 Days':
                    acc.days61to90 += txn.balance;
                    break;
                case 'Over 90 Days':
                    acc.over90Days += txn.balance;
                    break;
            }
            return acc;
        }, {
            totalBalance: 0,
            current: 0,
            days1to30: 0,
            days31to60: 0,
            days61to90: 0,
            over90Days: 0
        });
        
        // Round summary values
        Object.keys(summary).forEach(key => {
            summary[key] = Math.round(summary[key] * 100) / 100;
        });
        
        res.json({
            success: true,
            data: {
                customerId,
                customerName: customerAging[0]?.entityName || 'Unknown',
                reportDate: reportDate.toISOString().split('T')[0],
                summary,
                transactions: customerAging
            }
        });
        
    } catch (error) {
        console.error('Error generating customer aging report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating customer aging report',
            error: error.message
        });
    }



})
    //get transaction all
  transactionRouter
    .route('/detail-ledger' )
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
// Alternative implementation using aggregation pipeline
.get(cors.corsWithOptions, async (req, res, next) => {   
  try {
    const find = queryBuilder(req);
   

    // Convert entityId to ObjectId if present
    if (find.entityId) {
      find.entityId = new mongoose.Types.ObjectId(req.query.entityId);
    }
      let transactionDate={
        transactionDate:{...find.saleDate}
      }

 

    // Find all transactions for the customer
    const transactions = await Transaction.find({
    ...transactionDate,
      entityId: find.entityId,
      entityType: 'Customer'
    })

    // Process transactions and attach invoice details where applicable
    const transactionsWithInvoices = await Promise.all(
      transactions.map(async (transaction) => {
        // Convert Mongoose document to plain object
        let transactionObj = transaction.toObject();

        // Check if transaction is related to an invoice
        if (['invoice', 'editInvoice'].includes(transaction.reason) && transaction.reasonId) {
          // Find the corresponding sale/invoice
          const invoice = await Sale.findOne({
            _id: transaction.reasonId,
            
          }).lean();

          if (invoice) {
            // Attach invoice details to the transaction
            transactionObj.invoiceDetails = {
              invoiceId: invoice._id,
              orderNo: invoice.orderNo,
              saleDate: invoice.saleDate,
              grandTotal: invoice.grandTotal, 
              totalAfterDiscount: invoice.totalAfterDiscount,
              deliveryCharges: invoice.deliveryCharges,
              receivedAmount: invoice.receivedAmount,
              remainingBalance: invoice.remainingAmount,
              paymentStatus: invoice.paymentStatus,
              customerName: invoice.customerRef.name,
              saleDetail: invoice.saleDetail // Include all sale details
              
              // Add more invoice fields as needed
            };
          }
        }

        return transactionObj;
      })
    );

    res.status(200).json({
      success: true,
      count: transactionsWithInvoices.length,
      data: transactionsWithInvoices
    });

  } catch (error) {
    console.error('Error fetching customer transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message
    });
  }
});




    //get transaction all
  transactionRouter
    .route('/openingBalance/:entityId/:beforeDate' )
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
// Alternative implementation using aggregation pipeline
.get(cors.corsWithOptions, async (req, res, next) => {   
 try {
    // const find = queryBuilder(req);
        const  entityId = req.params.entityId;
        const beforeDate  = req.params.beforeDate; // Expected format: YYYY-MM-DD
     
        if (!beforeDate) {  
            return res.status(400).json({ error: 'beforeDate query parameter is required' });
        }

        const openingBalance = await getOpeningBalanceWithEntityDetails(entityId, beforeDate);
        
        res.json({
            success: true,
            data: openingBalance
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

  transactionRouter
  .route("/datewise")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions, async (req, res, next) => {
  
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    try {
      const transaction = await Transaction.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { _id: 1 }
        }
    ]);

    res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  transactionRouter
  .route("/returnrecent")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .put(cors.corsWithOptions,async (req, res) => {

    
      try {
        const orderNumbers = req.body.orderNumbers;
        const updateData = { status: "upload", recent: true, technician: [] };
    
        // Update batch orders based on order numbers
        const result = await Transaction.updateMany(
          { order: { $in: orderNumbers } },
          { $set: updateData }
        );

        res.json({ updatedCount: result.nModified });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

//get transaction by entityId
    transactionRouter
    .route("/entityId/:entityId")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, (req, res, next) =>   {      

      Transaction.find({entityId:req.params.entityId})
        .then(
          (Transaction) => {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.json(Transaction);
          },
          (err) => next(err)
        )
        .catch((err) => next(err));
    })
 


//export
transactionRouter
  .route("/export/:pagesize?/:page?")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .post(cors.corsWithOptions, verifyUser, async (req, res, next) => {
    const page = parseInt(req.params.page) || 1;
    const pageSize = parseInt(req.params.pagesize) || 10;
  
    let find = queryBuilderWithBody(req)
  
try {
  const totalComplaints = await Transaction.countDocuments(find);
  const totalPages = Math.ceil(totalComplaints / pageSize);

  const complaints = await Transaction.find(find).populate({
    path: "technician",
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  res.json({
    complaints: complaints,
    page,
    pageSize,
    totalComplaints,
    totalPages,
  });
} catch (error) {
 
  res.status(500).json({ error: "Internal Server Error" });
}
   
  });

  transactionRouter
  .route("/exist")
  .options(cors.corsWithOptions, async (req, res) => {
    res.sendStatus(200);
  })

  .get(cors.corsWithOptions,async (req, res) => {

    
      try {
        
    
        const queryBuilder =   new newQueryBuilder(req.query, req)
        .buildStringFilters()
        .buildUniqueIdentifierFilters()
        const find = queryBuilder.build();

        
        // Update batch orders based on order numbers
        const result = await Transaction.findOne(
          find,
        );
        if(!result){
          return res.status(200).json({ exist: false, data:result});
        }else{
          return res.status(200).json({exist:true, data:result});
        }
       
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

transactionRouter
  .route("/:productId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    Transaction.findById(req.params.productId)

      .then(
        (Transaction) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Transaction);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .post(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /Transaction/" + req.params.productId
    );
  })
  .put(cors.corsWithOptions, (req, res, next) => {
  

    Transaction.findByIdAndUpdate(
      req.params.productId,
      {
        $set: req.body,
      },
      { new: true }
    )
      .then(
        (Transaction) => {
          ////////////////////////////emit total 
        
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(Transaction);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  })
  .delete(cors.corsWithOptions, (req, res, next) => {
    Transaction.findByIdAndRemove(req.params.productId)
      .then(
        (resp) => {
          ////////////////////////////emit total 

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(resp);
        },
        (err) => next(err)
      )
      .catch((err) => next(err));
  });

transactionRouter
  .route("/:pagesize/:page/:ordering?")
  .options(cors.corsWithOptions, verifyUser, async (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.corsWithOptions,verifyUser, async (req, res, next) => {
    //********** */ new pagination ************
    const page = parseInt(req.params.page) || 1;
const pageSize = parseInt(req.params.pagesize) || 10;
// let find = queryBuilder(req);

let order = 1;
if(req.params.ordering == "desc") order = -1;
const queryBuilder =   new newQueryBuilder(req.query, req)
.buildStringFilters()
.buildUniqueIdentifierFilters()
const find = queryBuilder.build();
if(find.entityType =='All'){
  delete find.entityType
}

// const nestedBuilder =   new newQueryBuilder(req.query, req)
//   .buildNestedFilters()
 
// const nestedFind = nestedBuilder.build();
try {
  const results = await Transaction.aggregate([
    // Match stage (your filter conditions)
    { $match: find },
    
    // Facet to perform multiple aggregations in parallel
    {
      $facet: {
        // Calculate totals
        totals: [
          {
            $group: {
              _id: null,
              totalCredit: { $sum: "$credit" },
              totalDebit: { $sum: "$debit" },
              count: { $sum: 1 }
            }
          }
        ],
        
        // Get paginated data
        paginatedData: [
          { $sort: { createdAt: order } },
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          
          // Lookup for entityId
          // {
          //   $lookup: {
          //     from: "entities", // Replace with your actual collection name
          //     let: { entityId: "$entityId", entityType: "$entityType" },
          //     pipeline: [
          //       {
          //         $match: {
          //           $expr: {
          //             $and: [
          //               { $eq: ["$_id", "$$entityId"] },
          //               { $eq: [{ $type: "$$entityType" }, "string"] }
          //             ]
          //           }
          //         }
          //       },
          //       { $project: { name: 1 } }
          //     ],
          //     as: "entityId"
          //   }
          // },
          // { $unwind: { path: "$entityId", preserveNullAndEmptyArrays: true } },
          
          // Lookup for paymentMethod
          // {
          //   $lookup: {
          //     from: "payments", // Replace with your actual collection name
          //     localField: "paymentMethod",
          //     foreignField: "_id",
          //     pipeline: [
          //       {
          //         $project: {
          //           accountTitle: 1,
          //           accountType: 1
          //         }
          //       }
          //     ],
          //     as: "paymentMethod"
          //   }
          // },
          // { $unwind: { path: "$paymentMethod", preserveNullAndEmptyArrays: true } }
        ]
      }
    }
  ]);

  // Extract the results
  const totals = results[0].totals[0] || { totalCredit: 0, totalDebit: 0, count: 0 };
  const transactions = results[0].paginatedData;
  const totalPages = Math.ceil(totals.count / pageSize);

  res.json({
    data: transactions,
    page,
    pageSize,
    totalItems: totals.count,
    totalPages,
    totalCredit: totals.totalCredit,
    totalDebit: totals.totalDebit,
    balance: totals.totalDebit - totals.totalCredit 
  });

} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ error: "Internal Server Error" });
}

  })












module.exports = transactionRouter;
