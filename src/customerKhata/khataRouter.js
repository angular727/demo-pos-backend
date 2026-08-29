const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Customer = require("./khataModel");
const Ledger = require("./ledgerModel");
const { verifyUser } = require("../../middlewares/authenticate");

// 1. LIST WITH SEARCH (Customer List Screen)
router.get("/list/:pagesize/:page/:sort", verifyUser, async (req, res) => {
    try {
        const pageSize = Math.max(1, parseInt(req.params.pagesize) || 10);
        const page = Math.max(1, parseInt(req.params.page) || 1);
        const sortOrder = req.params.sort === "asc" ? 1 : -1;
        const matchFilter = { user: req.user._id };
        if (req.query.search?.trim()) {
            const searchRegex = { $regex: req.query.search.trim(), $options: "i" };
            matchFilter.$or = [{ name: searchRegex }, { phone: searchRegex }, { cnic: searchRegex }];
        }
        const totalItems = await Customer.countDocuments(matchFilter);
        const data = await Customer.aggregate([
            { $match: matchFilter },
            { $sort: { createdAt: sortOrder } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
            {
                $lookup: {
                    from: "khataledgers",
                    let: { cid: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$customerId", "$$cid"] } } },
                        { $group: { _id: null, totalDebit: { $sum: "$debit" }, totalCredit: { $sum: "$credit" } } }
                    ],
                    as: "ledgerStats"
                }
            },
            {
                $addFields: {
                    totalDebit: { $ifNull: [{ $arrayElemAt: ["$ledgerStats.totalDebit", 0] }, 0] },
                    totalCredit: { $ifNull: [{ $arrayElemAt: ["$ledgerStats.totalCredit", 0] }, 0] },
                    netBalance: { $subtract: [{ $ifNull: [{ $arrayElemAt: ["$ledgerStats.totalDebit", 0] }, 0] }, { $ifNull: [{ $arrayElemAt: ["$ledgerStats.totalCredit", 0] }, 0] }] }
                }
            },
            { $project: { ledgerStats: 0 } }
        ]);
        res.json({ data, totalItems, totalPages: Math.ceil(totalItems / pageSize) });
    } catch (err) { res.status(500).json({ message: "Error", error: err.message }); }
});

// 2. MASTER REPORT (Market Summary Screen) - FIXED 404
router.get("/reports/master-ledger/:pagesize/:page/:sort", verifyUser, async (req, res) => {
    try {
        const pageSize = parseInt(req.params.pagesize) || 20;
        const page = parseInt(req.params.page) || 1;
        const sortOrder = req.params.sort === "asc" ? 1 : -1;
        const { startDate, endDate } = req.query;

        let matchQuery = { user: req.user._id };
        if (startDate && endDate && startDate !== 'undefined') {
            const start = new Date(startDate); start.setHours(0,0,0,0);
            const end = new Date(endDate); end.setHours(23,59,59,999);
            matchQuery.date = { $gte: start, $lte: end };
        }

        const result = await Ledger.aggregate([
            { $match: matchQuery },
            {
                $facet: {
                    "summary": [{ $group: { _id: null, totalDebit: { $sum: "$debit" }, totalCredit: { $sum: "$credit" }, count: { $sum: 1 } } }],
                    "data": [
                        { $sort: { date: sortOrder, createdAt: -1 } },
                        { $skip: (page - 1) * pageSize },
                        { $limit: pageSize },
                        { $lookup: { from: "khatacustomers", localField: "customerId", foreignField: "_id", as: "customer" } },
                        { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } }
                    ]
                }
            }
        ]);
        const summaryData = result[0].summary[0] || { totalDebit: 0, totalCredit: 0, count: 0 };
        res.json({ totalItems: summaryData.count, summary: { totalDebit: summaryData.totalDebit, totalCredit: summaryData.totalCredit, netBalance: summaryData.totalDebit - summaryData.totalCredit }, data: result[0].data });
    } catch (err) { res.status(500).json({ message: "Server Error", error: err.message }); }
});

// 3. SINGLE CUSTOMER LEDGER
router.get("/ledger/:customerId/:pagesize/:page/:sort", verifyUser, async (req, res) => {
    try {
        const cid = new mongoose.Types.ObjectId(req.params.customerId);
        const { startDate, endDate } = req.query;
        let query = { customerId: cid, user: req.user._id };
        let openingQuery = { customerId: cid, user: req.user._id };

        if (startDate && endDate && startDate !== 'undefined') {
            const start = new Date(startDate);
            query.date = { $gte: start, $lte: new Date(new Date(endDate).setHours(23,59,59)) };
            openingQuery.date = { $lt: start };
        }

        const openingStats = await Ledger.aggregate([{ $match: openingQuery }, { $group: { _id: null, totalDebit: { $sum: "$debit" }, totalCredit: { $sum: "$credit" } } }]);
        const openingBalance = openingStats[0] ? (openingStats[0].totalDebit - openingStats[0].totalCredit) : 0;
        const transactions = await Ledger.find(query).sort({ date: 1, createdAt: 1 }).skip((parseInt(req.params.page)-1)*parseInt(req.params.pagesize)).limit(parseInt(req.params.pagesize));
        const allTime = await Ledger.aggregate([{ $match: { customerId: cid, user: req.user._id } }, { $group: { _id: null, totalDebit: { $sum: "$debit" }, totalCredit: { $sum: "$credit" } } }]);
        const stats = allTime[0] || { totalDebit: 0, totalCredit: 0 };

        res.json({ customer: await Customer.findById(cid), openingBalance, allTimeTotalDebit: stats.totalDebit, allTimeTotalCredit: stats.totalCredit, allTimeNetBalance: stats.totalDebit - stats.totalCredit, transactions, totalItems: await Ledger.countDocuments(query) });
    } catch (err) { res.status(500).json({ message: "Error", error: err.message }); }
});

// 4. ADD / UPDATE / DELETE ROUTES (Ensuring method call works)
router.post("/add", verifyUser, async (req, res) => { try { res.status(201).json(await Customer.create({ ...req.body, user: req.user._id })); } catch (err) { res.status(500).json({ error: err.message }); } });
router.put("/update/:id", verifyUser, async (req, res) => { try { res.json(await Customer.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true })); } catch (err) { res.status(500).json({ error: err.message }); } });
router.delete("/delete/:id", verifyUser, async (req, res) => { try { await Customer.findOneAndDelete({ _id: req.params.id, user: req.user._id }); await Ledger.deleteMany({ customerId: req.params.id, user: req.user._id }); res.json({ message: "Deleted" }); } catch (err) { res.status(500).json({ error: err.message }); } });

router.post("/ledger/add", verifyUser, async (req, res) => { try { res.status(201).json(await Ledger.create({ ...req.body, user: req.user._id })); } catch (err) { res.status(500).json({ error: err.message }); } });
router.put("/ledger/update/:id", verifyUser, async (req, res) => { try { res.json(await Ledger.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true })); } catch (err) { res.status(500).json({ error: err.message }); } });
router.delete("/ledger/delete/:id", verifyUser, async (req, res) => { try { await Ledger.findOneAndDelete({ _id: req.params.id, user: req.user._id }); res.json({ message: "Deleted" }); } catch (err) { res.status(500).json({ error: err.message }); } });

module.exports = router;