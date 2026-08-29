const express = require("express");
const bodyParser = require("body-parser");

const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const totalCount = express.Router();

const Product = require("../product/productModel");
const Sale = require("../sale/saleModel");
const Stock = require("../stock/stockModel");
const Return = require("../sale/saleReturnModel");
const Purchase = require("../purchaseInvoice/puchaseModel");
const Expense = require("../expense/expenseModel");

const cors = require("../cors");

const { verify } = require("jsonwebtoken");
const ROLES = require("../shared/rolesConstant");
const User = require("../users/userModel");

const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");
const Inventory = require("../inventory/inventoryModel");

totalCount.use(bodyParser.json());



//calculate total pending, complaints etc

totalCount
  .route("/totalcounts")
      .options(cors.corsWithOptions, (req, res) => {
          res.sendStatus(200);
      })
  .get(cors.corsWithOptions, async (req, res) => {
    let find= queryBuilder(req);
    console.log("TOTAL COUINTS ", find);
    try {
    const totalProduct = await Product.countDocuments(find);
    const totalStock= await Inventory.countDocuments(find);
    const totalSale = await Sale.countDocuments(find);
    const totalReturn = await Return.countDocuments(find);
    const totalPurchase = await Purchase.countDocuments(find);
    const totalExpense = await Expense.countDocuments(find);
    res.json({ totalProduct, totalStock, totalSale, totalReturn,totalPurchase, totalExpense });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
   

  })


  totalCount
  .route("/salebydate")
      .options(cors.corsWithOptions, (req, res) => {
          res.sendStatus(200);
      })
  .get(cors.corsWithOptions, async (req, res) => {
    let find= queryBuilder(req);
   console.log("fid inside salebydate ", find)
    try {
      const sales = await Sale.aggregate([
        {
          $match: {
          ...find
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" }
            },
            totalAmount: { $sum: "$totalAfterDiscount" },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            date: {
              $dateFromParts: {
                year: "$_id.year",
                month: "$_id.month",
                day: "$_id.day"
              }
            },
            totalAmount: 1,
            count: 1
          }
        },
        {
          $sort: { date: 1 }
        }
      ]);
  
      console.log(sales);
    res.json(sales);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
   

  })















totalCount
  .route("/totalComplaints")
      .options(cors.corsWithOptions, (req, res) => {
          res.sendStatus(200);
      })
  .get(cors.corsWithOptions, verifyUser, async (req, res) => {
    let find= req.query;
    // queryBuilder(req);
   
    try {
      
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
            totalNotMatched: {
              $sum: {
                $cond: [{ $eq: ["$status", "unMatched"] }, 1, 0]
              }
            },
            totalJHENotApproved: {
              $sum: {
                $cond: [{ $eq: ["$status", "resolved"] }, 1, 0]
              }
            },
            totalNCCNotApproved: {
              $sum: {
                $cond: [{ $eq: ["$status", "jheAppr"] }, 1, 0]
              }
            },
            totalApproved: {
              $sum: {
                $cond: [{ $in:['$status',  ['nccAppr','nccBypass']] }, 1, 0]
              }
            },
          
            totalDissatisfied: {
              $sum: {
                $cond: [{ $eq: ["$returnDissatisfied", true] }, 1, 0]
              }
            },
            
            totalNotApproved: {
              $sum: {
                $cond: [{ $in:['$status',  ['resolved','jheAppr']] }, 1, 0]
              }
            },
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
           
            totalRecent: {
              $sum: {
                $cond: [{ $eq: ["$recent", true] }, 1, 0]
              }
            },
            totalComplaints: {
              $sum: {
                $cond: ["$orderNo", 1, 0]
              }
            },
          }
        },
        // Stage to unwind the array of resolved dates
        //     {
        //     $addFields: {
        //         resolvedDate: { $toDate: "$resolvedDates" } // Convert resolvedDate to date type
        //     }
        // },
        //     // Stage to group complaints by resolved date
        //     {
        //         $group: {
        //             _id: { $dateToString: { format: "%Y-%m-%d", date: "$resolvedDate" } }, // Format resolved date
        //             count: { $sum: 1 }
        //         }
        //     }

      ]);

      res.json(result);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });



  totalCount
  .route("/breakdown")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
  .get(cors.corsWithOptions, verifyUser,async (req, res, next) => {
    let find=queryBuilder(req);
       // Calculate the date range based on the provided range parameter
        // let startDate, endDate;

        // if (range === 'week') {
        //   const today = moment();
        //   const startOfWeek = today.clone().startOf('isoWeek');
        //   startDate = startOfWeek.format('YYYY-MM-DD');  // Monday of the current week
        //   endDate = startOfWeek.clone().endOf('week').format('YYYY-MM-DD');  // Saturday of the current week
        // }else{
        //     throw new Error('Invalid range. Use "week" or "month".');
        // }

        // Pipeline to aggregate complaints by day within the specified range
        const pipeline = [
          {
              $match: {
                ...find
              }
          },
          {
            $addFields: {
                resolvedDate: { $toDate: "$resolvedDate" } // Convert resolvedDate to date type
            }
        },
          {
              $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$resolvedDate" } },
                  count: { $sum: 1 }
              }
          },
          {
              $sort: { "_id": 1 }
          }
      ];
      try {

      // Execute aggregation pipeline
      const result = await Complaint.aggregate(pipeline);
      // Function to convert date strings to days of the week
      // convertDatesToDays(result)
      res.json( result );
      }
      catch (error) {
        res.status(500).json({ error: error.message });
      }
      function convertDatesToDays(complaints) {
        complaints.forEach(complaint => {
          const dayOfWeek = moment(complaint._id).format('dddd');
          complaint._id = dayOfWeek;
        });
      }
  })





  totalCount
  .route("/timebreakdown")
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
  .get(cors.corsWithOptions, verifyUser,async (req, res, next) => {
    let find=queryBuilder(req);
     
 console.log("find: inside breakdown", find);
        // Pipeline to aggregate complaints by day within the specified range
        const pipeline = [
          {
              $match: {
                ...find
              }
          },
          {
            $addFields: {
                // Calculate resolution duration in days
                resolutionDuration: {
                    $divide: [
                        { $subtract: ["$resolvedDate", "$createdDate"] }, // Get the difference in milliseconds
                        1000 * 60 * 60 * 24 // Convert milliseconds to days
                    ]
                }
            }
        },
        {
          $group: {
              _id: {
                  $switch: {
                      branches: [
                          // Group complaints by resolution duration
                          { case: { $lt: ["$resolutionDuration", 1] }, then: "Resolved in 1 Day" },
                          { case: { $lt: ["$resolutionDuration", 2] }, then: "Resolved in 2 Days" },
                          { case: { $lt: ["$resolutionDuration", 3] }, then: "Resolved in 3 Days" },
                          { case: { $gte: ["$resolutionDuration", 3] }, then: "Resolved in More than 3 Days" }
                      ],
                      default: "Unknown" // Handle any other cases (if any)
                  }
              },
              count: { $sum: 1 } // Count complaints in each group
          }
      },
          {
              $sort: { "_id": 1 }
          }
      ];
      try {

      // Execute aggregation pipeline
      const result = await Complaint.aggregate(pipeline);
      // Function to convert date strings to days of the week
      // convertDatesToDays(result)
      res.json( result );
      }
      catch (error) {
        res.status(500).json({ error: error.message });
      }
      function convertDatesToDays(complaints) {
        complaints.forEach(complaint => {
          const dayOfWeek = moment(complaint._id).format('dddd');
          complaint._id = dayOfWeek;
        });
      }
  })


//calculate total users
totalCount
  .route("/totalusers")
      .options(cors.corsWithOptions, (req, res) => {
          res.sendStatus(200);
      })
  .get(cors.corsWithOptions, verifyUser, async (req, res) => {
    let find=queryBuilder(req);

    try {
      
      const result = await User.aggregate([
        {
          $match: find,  
        },
        {
          $group: {
            _id: null,
            totalActiveTechnician: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$role',  ROLES.technician] },
                      { $eq: ['$active', true] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalJheAccounts: {
              $sum: {
                $cond: [
                  {
                    $and: [
                   
                      { $eq: ['$role', ROLES.jh] },
                      { $eq: ['$active', true] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalCCIAccounts: {
              $sum: {
                $cond: [
                  {
                    $and: [
                   
                      { $eq: ['$role',  ROLES.cci] },
                      { $eq: ['$active', true] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalFreezAccounts: {
              $sum: {
                $cond: [{ $eq: ['$active', false] }, 1, 0]
              }
            },
            totalAccounts: {
              $sum: {
                $cond: ["$username", 1, 0]
              }
            },
          }
        }
      ]);

      res.json(result);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });






module.exports = totalCount;