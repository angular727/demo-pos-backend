// const express = require("express");
// const bodyParser = require("body-parser");
// const HistoryLog = require("./saleHistoryModel");
// const verifyUser = require("../../middlewares/authenticate").verifyUser;
// const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
// const historyLogRouter = express.Router();
// const cors = require("../cors");
// const { verify } = require("jsonwebtoken");

// historyLogRouter.use(bodyParser.json());

// historyLogRouter
//     .route("/")
//     .options(cors.corsWithOptions, (req, res) => {
//         res.sendStatus(200);
//     })
//     .get(cors.cors,verifyUser, (req, res, next) => {
//         let find=queryBuilder(req);
      
//         HistoryLog.find(find)
//             .populate({
       
//                 path:  ' complaint returned',
//                 populate : {
//                     path : 'technician',
                    
//                   }
//             })
//             .then(
//                 HistoryLog => {
//                     res.statusCode = 200;
//                     res.setHeader("Content-Type", "application/json");
//                     res.json(HistoryLog);

//                 },
//                 err => next(err)
//             )
//             .catch(err => next(err));
//     })
//     //post call for to create 
//     .post(cors.corsWithOptions,verifyUser, (req, res, next) => {
       
          
//                 HistoryLog.create(req.body)
//                 .then(data=>{

//                         console.log("doc Created ", data);
//                         res.statusCode = 200;
//                         res.setHeader("Content-Type", "application/json");
//                         res.json(data);
//                 }, err => next(err))
//                 .catch(err => next(err));
             


// })

//     // .post(cors.corsWithOptions, (req, res, next) => {
//     //     console.log("calling post body", req.body)

//     //     HistoryLog.findOneAndUpdate({"Order Number": req.body["Order Number"]}, /* query */
//     //     req.body, /* update */
//     //     { upsert: true}, (error, doc) => {
            
//     //         if(error) next(err)// error: any errors that occurred
//     //         if(doc) {
//     //             console.log("doc Created ", doc);
//     //             res.statusCode = 200;
//     //             res.setHeader("Content-Type", "application/json");
//     //             res.json(doc);
//     //         }
//     //         // doc: the document before updates are applied if `new: false`, or after updates if `new = true`
//     //       })
//     //         // .then(
//     //         //     product => {
    
                           

//     //         //     },
//     //         //     err => next(err)
//     //         // )
//     //         // .catch(err => next(err));
//     // })
//     .put(cors.corsWithOptions, (req, res, next) => {
//         res.statusCode = 403;
//         res.end("PUT operation not supported on /HistoryLog");
//     })
//     // .delete(
//     //     cors.corsWithOptions,
//     //     verifyUser,
//     //     verifyAdmin,

//     //     (req, res, next) => {
//     //         HistoryLog.remove({})
//     //             .then(
//     //                 resp => {
//     //                     res.statusCode = 200;
//     //                     res.setHeader("Content-Type", "application/json");
//     //                     res.json(resp);
//     //                 },
//     //                 err => next(err)
//     //             )
//     //             .catch(err => next(err));
//     //     }
//     // );

// //checkDuplicate
// //     historyLogRouter
// //     .route("/checkDuplicate")
// //     .options(cors.corsWithOptions, async(req, res) => {
// //         res.sendStatus(200);
// //     })
// //     .post(cors.cors, async(req, res) => {
// //         HistoryLog.findOne({ "Order Number": req.body["Order Number"] }, (err, doc) => {
// //             if (err) {
// //                 err => next(err)
// //             } else if (doc) {
// //                 console.log("doc ", doc)
// //                 res.statusCode = 500;
// //                 res.setHeader("Content-Type", "application/json");
// //                 res.json("duplicate found "+  doc["Order Number"]);
// //             } else {

// //             }
// //     })

// // })


// historyLogRouter
//     .route("/itemsalecount")
//     .options(cors.corsWithOptions,verifyUser, async(req, res) => {
//         res.sendStatus(200);
//     })
//     .get(cors.cors, async(req, res) => {
//         const itemsalecount = await HistoryLog.countDocuments((count) => count)

//         if (!itemsalecount && itemsalecount!=0) {
//             res.status(500).json({ success: false })
//         }
//         res.json({
//             itemsalecount: itemsalecount
//         });
//     })

    
// historyLogRouter
//     .route("/datewise")
//     .options(cors.corsWithOptions,verifyUser, (req, res) => {
//         res.sendStatus(200);
//     })
//     .post(cors.corsWithOptions, async(req, res, next) => {
//         let startDate = req.body.startDate
//         let endDate = req.body.endDate
// console.log("post call ", req.body)
//         const complaints = await HistoryLog.find({
//             createdAt: {
//                 $gte: startDate,
//                 $lt: endDate
//             }
//         }).populate({
//             path:  'resolved',
//         }).sort({ 'dateOrdered': -1 });

//         if (!complaints) {
//             res.status(500).json({ success: false })
//         }
//         res.send(complaints);
//     })

    
//     historyLogRouter
//     .route("/others")
//     .options(cors.corsWithOptions,verifyUser, async(req, res) => {
//         res.sendStatus(200);
//     })
//     .get(cors.cors, (req, res, next) => {
//         let find={}
//         if( req.query.territory && req.query.territory.length>0){
//             find.territory = { $in:  req.query.territory }; 
//             delete req.query.territory
//         }
//         find= {...find,...req.query}
//         HistoryLog.find(find)
//             .populate({
//                 path:  'resolved',
//             })
//             .then(
//                 HistoryLog => {
//                     res.statusCode = 200;
//                     res.setHeader("Content-Type", "application/json");
//                     res.json(HistoryLog);

//                 },
//                 err => next(err)
//             )
//             .catch(err => next(err));
//     })
    
//     historyLogRouter
//     .route("/others/:pagesize/:id")
//         .options(cors.corsWithOptions, async(req, res) => {
//             res.sendStatus(200);
//         })
//         .get(cors.corsWithOptions,verifyUser, async(req, res, next) => {
//             //  console.log("req rverifyUser,eq.params.pagesize", req.params.pagesize, req.params.id)
//             let pageSize = +req.params.pagesize;
//             let lastId = req.params.id;
//             let pro;
//             let find={}
        
//             if( req.query.territory && typeof req.query.territory === 'string' ){
//                 find.territory = { $in:  [req.query.territory] };
//                 delete req.query.territory
//             }else if(req.query.territory  && Array.isArray(req.query.territory)){
//                 find.territory = { $in:  req.query.territory }; 
//                 delete req.query.territory
//             }
//             find= {...find,...req.query}
//             if (lastId === '0') {
//                 pro = await HistoryLog.find(find).limit(pageSize);
//                 console.log("updateComplaint", pro)
//             } else {
//                 pro = await HistoryLog.find({ '_id': { '$gt': lastId }, city_name: { $ne:"KHI" } }).limit(pageSize)
//                 console.log("else complaints", pro)
//             }

//             if (!pro) {
//                 res.status(500).json({ success: false })
//             }
//             res.send(pro);
//     })

//     historyLogRouter
//     .route("/:productId")
//     .options(cors.corsWithOptions, (req, res) => {
//         res.sendStatus(200);
//     })
//     .get(cors.cors,verifyUser, (req, res, next) => {
        
//         HistoryLog.findById(req.params.productId)
//             .populate({
//                 path:  'resolved',
//             })
//             .then(
//                 product => {
//                     res.statusCode = 200;
//                     res.setHeader("Content-Type", "application/json");
//                     res.json(product);
//                 },
//                 err => next(err)
//             )
//             .catch(err => next(err));
//     })
//     .post(cors.corsWithOptions, (req, res, next) => {
//         res.statusCode = 403;
//         res.end("POST operation not supported on /HistoryLog/" + req.params.productId);
//     })
//     .put(cors.corsWithOptions,verifyUser, (req, res, next) => {
//         HistoryLog.findByIdAndUpdate(
//                 req.params.productId, {
//                     $set: req.body
//                 }, { new: true }
//             )
//             .then(
//                 product => {
//                     res.statusCode = 200;
//                     res.setHeader("Content-Type", "application/json");
//                     res.json(product);
//                 },
//                 err => next(err)
//             )
//             .catch(err => next(err));
//     })
//     .delete(cors.corsWithOptions,verifyUser, (req, res, next) => {
  
//         HistoryLog.findByIdAndRemove(req.params.productId)
//             .then(
//                 resp => {
//                     res.statusCode = 200;
//                     res.setHeader("Content-Type", "application/json");
//                     res.json(resp);
//                 },
//                 err => next(err)
//             )
//             .catch(err => next(err));
//     });







// historyLogRouter
//     .route("/:pagesize/:id")
//     .options(cors.corsWithOptions, async(req, res) => {
//         res.sendStatus(200);
//     })
//     .get(cors.corsWithOptions, verifyUser,async(req, res, next) => {
//         //  console.log("req req.params.pagesize", req.params.pagesize, req.params.id)
//         console.log("req.query ", req.query)
//         let pageSize = +req.params.pagesize;
//         let lastId = req.params.id;
//         let pro;
//         let find={}

//         if( req.query.territory && typeof req.query.territory === 'string' ){
//             find.territory = { $in:  [req.query.territory] };
//             delete req.query.territory
//         }else if(req.query.territory  && Array.isArray(req.query.territory)){
//             find.territory = { $in:  req.query.territory }; 
//             delete req.query.territory
//         }
//         find= {...find,...req.query}
//         if (lastId === '0') {
//             pro = await HistoryLog.find(find).limit(pageSize)
//             .populate({
       
//                 path:  ' complaint returned',
//                 populate : {
//                     path : 'technician',
                    
//                   }
//             });
//             console.log("updateComplaint", pro)
//         } else {
//             pro = await HistoryLog.find({ '_id': { '$gt': lastId },...find}).limit(pageSize)
//             .populate({
       
//                 path:  ' complaint returned',
//                 populate : {
//                     path : 'technician',
                    
//                   }
//             })
//             console.log("else complaints", pro)
//         }

//         if (!pro) {
//             res.status(500).json({ success: false })
//         }
//         res.send(pro);
//     })




// module.exports = historyLogRouter;