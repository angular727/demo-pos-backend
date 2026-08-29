const express = require("express");
const bodyParser = require("body-parser");
const Theme = require("./themeModel");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const ThemeRouter = express.Router();
const cors = require("../cors");
const { verify } = require("jsonwebtoken");

ThemeRouter.use(bodyParser.json());

ThemeRouter
    .route("/")
    .options(cors.corsWithOptions, (req, res) => {
        res.sendStatus(200);
    })
    .get(cors.corsWithOptions, verifyUser, (req, res, next) => {
        console.log("Theme req: ", req.query);
        Theme.find(req.query)
            .then(
                theme => {
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.json(theme);

                },
                err => next(err)
            )
            .catch(err => next(err));
    })
    .post(cors.corsWithOptions,verifyUser, async (req, res, next) => {
        console.log("calling post body", req.baseUrl)
        const themeFound = await Theme.findOne({ "user": req.body.user});
        if(themeFound){
                Theme.findByIdAndUpdate(
                        themeFound._id, {
                            $set: req.body
                        }, { new: true }
                    )
                    .then(
                        product => {
                            res.statusCode = 200;
                            res.setHeader("Content-Type", "application/json");
                            res.json("updated " +product);
                        },
                        err => next(err)
                    )
                    .catch(err => next(err));
           
        }else {
            Theme.create(req.body)
            .then(
                product => {
                  
                            res.statusCode = 200;
                            res.setHeader("Content-Type", "application/json");
                            res.json("created: "  + product);

                },
                err => next(err)
            )
            .catch(err => next(err));
        }
       
    })
    .put(cors.corsWithOptions,verifyUser,verifyAdmin, (req, res, next) => {
        res.statusCode = 403;
        res.end("PUT operation not supported on /Theme");
    })
    .delete(
        cors.corsWithOptions,
        verifyUser,verifyAdmin,

        (req, res, next) => {
            Theme.remove({})
                .then(
                    resp => {
                        res.statusCode = 200;
                        res.setHeader("Content-Type", "application/json");
                        res.json(resp);
                    },
                    err => next(err)
                )
                .catch(err => next(err));
        }
    );


      
    ThemeRouter
        .route("/checkNum")
        .options(cors.corsWithOptions, (req, res) => {
            res.sendStatus(200);
        })
        .post(cors.corsWithOptions,verifyUser,verifyAdmin, async(req, res, next) => {
            const encodedString = Buffer.from(req.body.num, 'utf-8').toString('base64');
            
            //   // Decoding a string
        //         const decodedString = Buffer.from(req.body.num, 'base64').toString('utf-8');
        //         console.log("decodedString ", decodedString);

            if (encodedString!='ODU0MjU0') {
                res.status(500).json({ success: false })
            }else if(encodedString==='ODU0MjU0'){
                res.status(200).json({ success: true })
            }
           
        })
    
    ThemeRouter
        .route("/datewise")
        .options(cors.corsWithOptions, (req, res) => {
            res.sendStatus(200);
        })
        .post(cors.corsWithOptions,verifyUser,verifyAdmin, async(req, res, next) => {
            let startDate = req.body.startDate
            let endDate = req.body.endDate

            const complaints = await Theme.find({
                createdAt: {
                    $gte: startDate,
                    $lt: endDate
                }
            }).populate({
                path: 'complaint technician',
            }).sort({ 'dateOrdered': -1 });

            if (!complaints) {
                res.status(500).json({ success: false })
            }
            res.send(complaints);
        })
   
    

ThemeRouter
    .route("/:productId")
    .options(cors.corsWithOptions, (req, res) => {
        res.sendStatus(200);
    })
    .get(cors.corsWithOptions,verifyUser, (req, res, next) => {
        Theme.findById(req.params.productId)
           
            .then(
                product => {
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.json(product);
                },
                err => next(err)
            )
            .catch(err => next(err));
    })
    .post(cors.corsWithOptions,verifyUser,verifyAdmin, (req, res, next) => {
        res.statusCode = 403;
        res.end("POST operation not supported on /Theme/" + req.params.productId);
    })
    .put(cors.corsWithOptions, (req, res, next) => {
        Theme.findByIdAndUpdate(
                req.params.productId, {
                    $set: req.body
                }, { new: true }
            )
            .then(
                product => {
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.json(product);
                },
                err => next(err)
            )
            .catch(err => next(err));
    })
    .delete(cors.corsWithOptions, verifyUser,verifyAdmin,(req, res, next) => {
        console.log("del pro: ");
        Theme.findByIdAndRemove(req.params.productId)
            .then(
                resp => {
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.json(resp);
                },
                err => next(err)
            )
            .catch(err => next(err));
    });



ThemeRouter
    .route("/:pagesize/:id")
    .options(cors.corsWithOptions,verifyUser,verifyAdmin, async(req, res) => {
        res.sendStatus(200);
    })
    .get(cors.corsWithOptions,verifyUser,verifyAdmin, async(req, res, next) => {
        //  console.log("req req.params.pagesize", req.params.pagesize, req.params.id)
        let pageSize = +req.params.pagesize;
        let lastId = req.params.id;
        let pro;
        if (lastId === '0') {
            pro = await Theme.find().populate('complaint technician').limit(pageSize);
            console.log("updateProducts", pro)
        } else {
            pro = await Theme.find({ '_id': { '$gt': lastId } }).populate('complaint techniciant').limit(pageSize)
            console.log("else orderList", pro)
        }

        if (!pro) {
            res.status(500).json({ success: false })
        }
        res.send(pro);
    })



module.exports = ThemeRouter;