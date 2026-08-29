const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Product = require("../product/productModel");
const Sale = require("../sale/saleModel");
const Inventory = require("../inventory/inventoryModel");
const ReturnProduct = require("../sale/saleReturnModel");
const authenticate = require("../../middlewares/authenticate");
const cors = require("../cors");


const getCalculatedData = async (pIds, start, end, userId) => {
    const objectPids = pIds.map(id => new mongoose.Types.ObjectId(id));

    const results = await Promise.all([

        // ── 1. Inventory ──────────────────────────────────────────────────────
        Inventory.aggregate([
            {
                $match: {
                    productRef: { $in: objectPids },
                    isDeleted: { $ne: true },
                    purchaseReturn: { $ne: true },
                    ...(userId ? { user: userId } : {})
                }
            },
            {
                $group: {
                    _id: "$productRef",
                    currentStock: { $sum: "$totalInventory" },
                    unitPrice: { $last: "$salePrice" }, // <--- Unit Price fetch ki
                    addedInPeriod: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ["$createdAt", start] },
                                        { $lte: ["$createdAt", end] }
                                    ]
                                },
                                "$totalUnits", 0
                            ]
                        }
                    },
                    addedAfterEnd: {
                        $sum: {
                            $cond: [
                                { $gt: ["$createdAt", end] },
                                "$totalUnits", 0
                            ]
                        }
                    }
                }
            }
        ]),

        // ── 2. Sales ──────────────────────────────────────────────────────────
        Sale.aggregate([
            {
                $match: {
                    isDeleted: { $ne: true },
                    ...(userId ? { user: userId } : {})
                }
            },
            { $unwind: "$saleDetail" },
            {
                $match: {
                    $expr: {
                        $in: [{ $toObjectId: "$saleDetail.productRef" }, objectPids]
                    }
                }
            },
            {
                $group: {
                    _id: { $toObjectId: "$saleDetail.productRef" },
                    soldInPeriod: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: [{ $toDate: "$saleDate" }, start] },
                                        { $lte: [{ $toDate: "$saleDate" }, end] }
                                    ]
                                },
                                "$saleDetail.saleQuantity", 0
                            ]
                        }
                    },
                    soldAmt: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: [{ $toDate: "$saleDate" }, start] },
                                        { $lte: [{ $toDate: "$saleDate" }, end] }
                                    ]
                                },
                                "$saleDetail.totalPrice", 0
                            ]
                        }
                    },
                    soldAfterEnd: {
                        $sum: {
                            $cond: [
                                { $gt: [{ $toDate: "$saleDate" }, end] },
                                "$saleDetail.saleQuantity", 0
                            ]
                        }
                    }
                }
            }
        ]),

        // ── 3. Sale Returns ───────────────────────────────────────────────────
        ReturnProduct.aggregate([
            ...(userId ? [{ $match: { user: userId } }] : []),
            { $unwind: "$returnProducts" },
            {
                $match: {
                    $expr: {
                        $in: [{ $toObjectId: "$returnProducts.productRef" }, objectPids]
                    }
                }
            },
            {
                $group: {
                    _id: { $toObjectId: "$returnProducts.productRef" },
                    retInPeriod: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ["$createdAt", start] },
                                        { $lte: ["$createdAt", end] }
                                    ]
                                },
                                "$returnProducts.returnQuantity", 0
                            ]
                        }
                    },
                    retAmt: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ["$createdAt", start] },
                                        { $lte: ["$createdAt", end] }
                                    ]
                                },
                                "$returnProducts.returnPrice", 0
                            ]
                        }
                    },
                    retAfterEnd: {
                        $sum: {
                            $cond: [
                                { $gt: ["$createdAt", end] },
                                "$returnProducts.returnQuantity", 0
                            ]
                        }
                    }
                }
            }
        ])
    ]);

    return results;
};


// ─── SINGLE GET Route ─────────────────────────────────────────────────────────
router.get("/", cors.corsWithOptions, authenticate.verifyUser, async (req, res) => {
    try {
        const { startDate, endDate, search = '', page = 1, limit = 20, user, filterType } = req.query;

        const start = new Date(`${startDate}T00:00:00.000+05:00`);
        const end   = new Date(`${endDate || startDate}T23:59:59.999+05:00`);

        const userId = user && user !== 'undefined' ? new mongoose.Types.ObjectId(user) : null;

        let productQuery = { isDeleted: { $ne: true } };
        if (search) {
            productQuery.$or = [
                { name:    { $regex: search, $options: 'i' } },
                { barcode: { $regex: search, $options: 'i' } }
            ];
        }

        const allProducts = await Product.find(productQuery, 'name productId barcode').lean();
        const allPids = allProducts.map(p => p._id);

        if (allPids.length === 0) {
            return res.json({
                summary: { opening: 0, added: 0, sold: 0, amount: 0, closing: 0 },
                data: [],
                hasMore: false
            });
        }

        const [gInv, gSal, gRet] = await getCalculatedData(allPids, start, end, userId);

        let gCl = 0, gAd = 0, gSo = 0, gAm = 0;

        const fullReport = allProducts.map(prod => {
            const inv = gInv.find(x => x._id.toString() === prod._id.toString())
                || { currentStock: 0, addedInPeriod: 0, addedAfterEnd: 0, unitPrice: 0 };
            const s = gSal.find(x => x._id.toString() === prod._id.toString())
                || { soldInPeriod: 0, soldAmt: 0, soldAfterEnd: 0 };
            const r = gRet.find(x => x._id.toString() === prod._id.toString())
                || { retInPeriod: 0, retAmt: 0, retAfterEnd: 0 };

            const closing = inv.currentStock + s.soldAfterEnd - r.retAfterEnd - inv.addedAfterEnd;
            const added   = inv.addedInPeriod;
            const netSold = s.soldInPeriod - r.retInPeriod;
            const opening = closing + netSold - added;
            const amount  = s.soldAmt - r.retAmt;

            gCl += closing;
            gAd += added;
            gSo += netSold;
            gAm += amount;

            return {
                productId:   prod.productId,
                productName: prod.name,
                barcode:     prod.barcode,
                unitPrice:   inv.unitPrice || 0, // <--- Add ki gayi line
                opening,
                added,
                sold: netSold,
                amount,
                closing
            };
        });

        let filteredReport = fullReport;
        if (filterType === 'onlyPurchased') {
            filteredReport = fullReport.filter(p => p.added > 0);
        } else if (filterType === 'onlySold') {
            filteredReport = fullReport.filter(p => p.sold > 0);
        }

        const startIndex   = (parseInt(page) - 1) * parseInt(limit);
        const paginatedData = filteredReport.slice(startIndex, startIndex + parseInt(limit));
        const gOp          = gCl + gSo - gAd;

        res.status(200).json({
            summary: { opening: gOp, added: gAd, sold: gSo, amount: gAm, closing: gCl },
            data: paginatedData,
            hasMore: startIndex + parseInt(limit) < filteredReport.length
        });

    } catch (err) {
        console.error("STOCK SUMMARY ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});


// ─── EXCEL DOWNLOAD Route ─────────────────────────────────────────────────────
router.get("/excel", cors.corsWithOptions, authenticate.verifyUser, async (req, res) => {
    try {
        const { startDate, endDate, search = '', user, filterType } = req.query;

        const start = new Date(`${startDate}T00:00:00.000+05:00`);
        const end   = new Date(`${endDate || startDate}T23:59:59.999+05:00`);
        const userId = user && user !== 'undefined' ? new mongoose.Types.ObjectId(user) : null;

        let productQuery = { isDeleted: { $ne: true } };
        if (search) {
            productQuery.$or = [
                { name:    { $regex: search, $options: 'i' } },
                { barcode: { $regex: search, $options: 'i' } }
            ];
        }

        const allProducts = await Product.find(productQuery, 'name productId barcode').lean();
        const allPids = allProducts.map(p => p._id);

        if (allPids.length === 0) {
            return res.json({ data: [] });
        }

        const [gInv, gSal, gRet] = await getCalculatedData(allPids, start, end, userId);

        const fullReport = allProducts.map(prod => {
            const inv = gInv.find(x => x._id.toString() === prod._id.toString())
                || { currentStock: 0, addedInPeriod: 0, addedAfterEnd: 0, unitPrice: 0 };
            const s = gSal.find(x => x._id.toString() === prod._id.toString())
                || { soldInPeriod: 0, soldAmt: 0, soldAfterEnd: 0 };
            const r = gRet.find(x => x._id.toString() === prod._id.toString())
                || { retInPeriod: 0, retAmt: 0, retAfterEnd: 0 };

            const closing = inv.currentStock + s.soldAfterEnd - r.retAfterEnd - inv.addedAfterEnd;
            const added   = inv.addedInPeriod;
            const netSold = s.soldInPeriod - r.retInPeriod;
            const opening = closing + netSold - added;
            const amount  = s.soldAmt - r.retAmt;

            return {
                productId:   prod.productId,
                productName: prod.name,
                barcode:     prod.barcode,
                unitPrice:   inv.unitPrice || 0, // <--- Excel ke liye add ki gayi line
                opening,
                added,
                sold: netSold,
                amount,
                closing
            };
        });

        let filteredReport = fullReport;
        if (filterType === 'onlyPurchased') {
            filteredReport = fullReport.filter(p => p.added > 0);
        } else if (filterType === 'onlySold') {
            filteredReport = fullReport.filter(p => p.sold > 0);
        }

        res.status(200).json({ data: filteredReport });

    } catch (err) {
        console.error("EXCEL DOWNLOAD ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;