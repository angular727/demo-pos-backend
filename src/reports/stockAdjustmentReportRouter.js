const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const stockAdjustmentReportRouter = express.Router();
const cors = require("../cors");
const Inventory = require("../inventory/inventoryModel");
const newQueryBuilder = require('../shared/newQueryBuilder');

stockAdjustmentReportRouter.use(bodyParser.json());

/**
 * Pipeline function
 */
const buildAdjustmentPipeline = (find, startDate, endDate, skip = null, limit = null, order = -1) => {
    let pipeline = [
        { $match: find },
        { $unwind: "$inventoryAdjust" },
        {
            $lookup: {
                from: "products",
                localField: "productRef",
                foreignField: "_id",
                as: "p"
            }
        },
        { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1,
                date: {
                    $convert: { input: "$inventoryAdjust.date", to: "date", onError: null, onNull: null }
                },
                adjustmentType: "$inventoryAdjust.adjustmentType",
                // quantity: { $toDouble: "$inventoryAdjust.quantity" },
                quantity: { $multiply: [{ $toDouble: "$inventoryAdjust.quantity" }, -1] },
                unitPrice: { $toDouble: { $ifNull: ["$unitPrice", 0] } },
                productName: { $ifNull: ["$productName", "$p.name"] },
                batchNumber: 1,
                reason: "$inventoryAdjust.reason",
                totalCost: {
                    $multiply: [
                        // { $toDouble: "$inventoryAdjust.quantity" },
                        { $multiply: [{ $toDouble: "$inventoryAdjust.quantity" }, -1] },
                        { $toDouble: { $ifNull: ["$unitPrice", 0] } }
                    ]
                }
            }
        }
    ];

    if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        pipeline.push({
            $match: { date: { $gte: start, $lte: end } }
        });
    }

    if (skip !== null && limit !== null) {
        pipeline.push({
            $facet: {
                paginatedResults: [{ $sort: { date: order } }, { $skip: skip }, { $limit: limit }],
                footerTotals: [
                    {
                        $group: {
                            _id: null,
                            totalQty: { $sum: "$quantity" },
                            totalCost: { $sum: "$totalCost" },
                            plusQty: { $sum: { $cond: [{ $gt: ["$quantity", 0] }, "$quantity", 0] } },
                            plusCost: { $sum: { $cond: [{ $gt: ["$totalCost", 0] }, "$totalCost", 0] } },
                            minusQty: { $sum: { $cond: [{ $lt: ["$quantity", 0] }, "$quantity", 0] } },
                            minusCost: { $sum: { $cond: [{ $lt: ["$totalCost", 0] }, "$totalCost", 0] } }
                        }
                    }
                ]
            }
        });
    } else {
        pipeline.push({ $sort: { date: order } });
    }

    return pipeline;
};

// 1. REPORT API
stockAdjustmentReportRouter.route("/:pagesize/:page/:ordering?")
    .options(cors.corsWithOptions, (req, res) => { res.sendStatus(200); })
    .get(cors.corsWithOptions, verifyUser, async (req, res) => {
        const page = parseInt(req.params.page) || 1;
        const pageSize = parseInt(req.params.pagesize) || 10;
        const skip = (page - 1) * pageSize;
        let order = req.params.ordering === "desc" ? -1 : 1;

        if (!req.query.user) req.query.user = req.user._id;

        const queryBuilder = new newQueryBuilder(req.query, req)
            .buildStringFilters()
            .buildUniqueIdentifierFilters();

        const find = queryBuilder.build();
        delete find.createdAt; // wrong field - date range is applied separately on inventoryAdjust.date below
        if (req.query.productName) {
            find.productName = { $regex: req.query.productName, $options: 'i' };
        }

        try {
            const pipeline = buildAdjustmentPipeline(find, req.query.startDate, req.query.endDate, skip, pageSize, order);
            const result = await Inventory.aggregate(pipeline);

            res.status(200).json({
                success: true,
                data: result[0].paginatedResults,
                totals: result[0].footerTotals[0] || { totalQty: 0, totalCost: 0, plusQty: 0, plusCost: 0, minusQty: 0, minusCost: 0 },
                page,
                pageSize
            });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

// EXCEL EXPORT API - Matches the generic service call
stockAdjustmentReportRouter.route("/export/download/:ordering?")
    .options(cors.corsWithOptions, (req, res) => { res.sendStatus(200); })
    .post(cors.corsWithOptions, verifyUser, async (req, res) => {
        if (!req.body.user) req.body.user = req.user._id;
        let order = req.params.ordering === "desc" ? -1 : 1;

        const queryBuilder = new newQueryBuilder(req.body, req)
            .buildStringFilters()
            .buildUniqueIdentifierFilters();

        const find = queryBuilder.build();
        delete find.createdAt; // wrong field - date range is applied separately on inventoryAdjust.date below
        if (req.body.productName) {
            find.productName = { $regex: req.body.productName, $options: 'i' };
        }

        try {
            const pipeline = buildAdjustmentPipeline(find, req.body.startDate, req.body.endDate, null, null, order);
            const data = await Inventory.aggregate(pipeline);

            const exportData = data.map(item => ({
                'Date': item.date,
                'Product Name': item.productName,
                'Batch No': item.batchNumber,
                'Type': item.adjustmentType,
                'Quantity': item.quantity,
                'Unit Price': item.unitPrice,
                'Total Cost': item.totalCost,
                'Reason': item.reason
            }));

            res.status(200).json(exportData);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

module.exports = stockAdjustmentReportRouter;