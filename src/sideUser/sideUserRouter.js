const express = require("express");
const bodyParser = require("body-parser");
const SideUsers = require("./sideUserModel");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const SideUsersRouter = express.Router();
const cors = require("../cors");
const { verify } = require("jsonwebtoken");

SideUsersRouter.use(bodyParser.json());

SideUsersRouter
    .route("/")
    .options(cors.corsWithOptions, (req, res) => {
        res.sendStatus(200);
    })
    .get(cors.corsWithOptions, verifyUser, (req, res, next) => {
        console.log("SideUsers req: ", req.query);
        SideUsers.find(req.query)
           
            .then(
                SideUsers => {
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.json(SideUsers);

                },
                err => next(err)
            )
            .catch(err => next(err));
    })
    .post(cors.corsWithOptions,verifyUser, (req, res, next) => {
        console.log("calling post body", req.baseUrl)
        const bodyData = { ...req.body, user: req.user._id, vendorId: req.user.vendorId };
        SideUsers.create(bodyData)
            .then(
                product => {
                  
                            console.log("Product Created ", product);
                            res.statusCode = 200;
                            res.setHeader("Content-Type", "application/json");
                            res.json("saved also "+product.user);

                },
                err => next(err)
            )
            .catch(err => next(err));
    })
    .put(cors.corsWithOptions,verifyUser, (req, res, next) => {
        res.statusCode = 403;
        res.end("PUT operation not supported on /SideUsers");
    })
    .delete(
        cors.corsWithOptions,
        verifyUser,verifyAdmin,

        (req, res, next) => {
            SideUsers.remove({})
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


    


SideUsersRouter
    .route("/:productId")
    .options(cors.corsWithOptions, (req, res) => {
        res.sendStatus(200);
    })
    .get(cors.corsWithOptions,verifyUser, (req, res, next) => {
        SideUsers.findById(req.params.productId)
           
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
    .post(cors.corsWithOptions,verifyUser, (req, res, next) => {
        res.statusCode = 403;
        res.end("POST operation not supported on /SideUsers/" + req.params.productId);
    })
    .put(cors.corsWithOptions, (req, res, next) => {
        SideUsers.findByIdAndUpdate(
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
        SideUsers.findByIdAndRemove(req.params.productId)
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



SideUsersRouter
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
            pro = await SideUsers.find().populate('complaint technician').limit(pageSize);
            console.log("updateProducts", pro)
        } else {
            pro = await SideUsers.find({ '_id': { '$gt': lastId } }).populate('complaint techniciant').limit(pageSize)
            console.log("else orderList", pro)
        }

        if (!pro) {
            res.status(500).json({ success: false })
        }
        res.send(pro);
    })



module.exports = SideUsersRouter;