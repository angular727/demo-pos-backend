const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const Salesman = require("./salesmanModel");
const Ledger = require("./ledgerModel");
const { verifyUser } = require("../../middlewares/authenticate");

// ============================================================
// HELPER: Format number to PKR
// ============================================================
const pkr = (n) => Number(n || 0).toLocaleString("en-PK");

// ============================================================
// 1. SALESMAN LIST  —  GET /list/:pagesize/:page/:sort
//    Returns each salesman WITH their total debit/credit/netBalance
// ============================================================
router.get("/list/:pagesize/:page/:sort", verifyUser, async (req, res) => {
    try {
        const pageSize  = Math.max(1, parseInt(req.params.pagesize) || 10);
        const page      = Math.max(1, parseInt(req.params.page)     || 1);
        const sortOrder = req.params.sort === "asc" ? 1 : -1;

        // Build match filter (only this user's data)
        const matchFilter = { user: req.user._id };
        if (req.query.day?.trim())    matchFilter.visitDays        = req.query.day.trim();
        if (req.query.name?.trim())    matchFilter.name             = { $regex: req.query.name.trim(),    $options: "i" };
        if (req.query.phone?.trim())   matchFilter.phone            = { $regex: req.query.phone.trim(),   $options: "i" };
        if (req.query.company?.trim()) matchFilter.supplierCompany  = { $regex: req.query.company.trim(), $options: "i" };

        // Count without aggregation (fast)
        const totalItems = await Salesman.countDocuments(matchFilter);

        // Aggregate: join ledger totals per salesman
        const data = await Salesman.aggregate([
            { $match: matchFilter },
            { $sort: { createdAt: sortOrder } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
            {
                $lookup: {
                    from: "salesmanledgers",          // MongoDB collection name
                    let:  { sid: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$salesmanId", "$$sid"] } } },
                        {
                            $group: {
                                _id:         null,
                                totalDebit:  { $sum: "$debit"  },
                                totalCredit: { $sum: "$credit" }
                            }
                        }
                    ],
                    as: "ledgerStats"
                }
            },
            {
                $addFields: {
                    totalDebit:  { $ifNull: [{ $arrayElemAt: ["$ledgerStats.totalDebit",  0] }, 0] },
                    totalCredit: { $ifNull: [{ $arrayElemAt: ["$ledgerStats.totalCredit", 0] }, 0] },
                    netBalance: {
                        $subtract: [
                            { $ifNull: [{ $arrayElemAt: ["$ledgerStats.totalDebit",  0] }, 0] },
                            { $ifNull: [{ $arrayElemAt: ["$ledgerStats.totalCredit", 0] }, 0] }
                        ]
                    }
                }
            },
            { $project: { ledgerStats: 0 } }
        ]);

        res.json({
            data,
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize)
        });

    } catch (err) {
        console.error("Salesman List Error:", err);
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});











// Dropdown ke liye simple list (Ledger component ke liye)
router.get("/all", verifyUser, async (req, res) => {
    try {
        // Sirf wahi salesmen jo is user ke hain
        const salesmen = await Salesman.find({ user: req.user._id })
                                       .select("name supplierCompany")
                                       .sort({ name: 1 });
        res.json(salesmen); // Ye direct array bhejay ga
    } catch (err) {
        res.status(500).json({ message: "Error", error: err.message });
    }
});

// ============================================================
// 2. ADD SALESMAN  —  POST /add
// ============================================================
router.post("/add", verifyUser, async (req, res) => {
    try {
        const salesman = await Salesman.create({ ...req.body, user: req.user._id });
        res.status(201).json(salesman);
    } catch (err) {
        res.status(500).json({ message: "Error", error: err.message });
    }
});

// ============================================================
// 3. UPDATE SALESMAN  —  PUT /update/:id
// ============================================================
router.put("/update/:id", verifyUser, async (req, res) => {
    try {
        const salesman = await Salesman.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            req.body,
            { new: true }
        );
        if (!salesman) return res.status(404).json({ message: "Salesman not found" });
        res.json(salesman);
    } catch (err) {
        res.status(500).json({ message: "Error", error: err.message });
    }
});

// ============================================================
// 4. DELETE SALESMAN + all ledger entries  —  DELETE /delete/:id
// ============================================================
router.delete("/delete/:id", verifyUser, async (req, res) => {
    try {
        await Salesman.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        await Ledger.deleteMany({ salesmanId: req.params.id, user: req.user._id });
        res.json({ message: "Salesman aur uska ledger delete ho gaya" });
    } catch (err) {
        res.status(500).json({ message: "Error", error: err.message });
    }
});

// ============================================================
// 5. LEDGER  —  GET /ledger/:salesmanId/:pagesize/:page/:sort
//    Query params: ?startDate=2024-01-01&endDate=2024-12-31
// ============================================================
router.get("/ledger/:salesmanId/:pagesize/:page/:sort", verifyUser, async (req, res) => {
    try {
        const pageSize    = Math.max(1, parseInt(req.params.pagesize) || 20);
        const page        = Math.max(1, parseInt(req.params.page)     || 1);
        const sortOrder   = req.params.sort === "asc" ? 1 : -1;
        const salesmanId  = new mongoose.Types.ObjectId(req.params.salesmanId);
        
        // 1. Base Query (Salesman isolation)
        const baseQuery = { salesmanId, user: req.user._id };

        // 2. Date Filter Logic
        const { startDate, endDate } = req.query;
        let filteredQuery = { ...baseQuery };
        let openingBalanceQuery = { ...baseQuery };

        if (startDate && endDate && startDate !== 'undefined' && endDate !== 'undefined') {
            const start = new Date(startDate);
            const end   = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Din ka aakhir tak

            // Table mein sirf in dates ka data aayega
            filteredQuery.date = { $gte: start, $lte: end };
            
            // Opening Balance: startDate se PEHLE ka saara hisaab
            openingBalanceQuery.date = { $lt: start };
        }

        const skipCount = (page - 1) * pageSize;

        // 3. Opening Balance calculation (Date range se pehle ka total)
        const openingStats = await Ledger.aggregate([
            { $match: openingBalanceQuery },
            { $group: { _id: null, totalDebit: { $sum: "$debit" }, totalCredit: { $sum: "$credit" } } }
        ]);
        const openingBalance = openingStats[0] ? (openingStats[0].totalDebit - openingStats[0].totalCredit) : 0;

        // 4. Current Page Transactions (Filtered by Date)
        const transactions = await Ledger.find(filteredQuery)
            .sort({ date: 1, createdAt: 1 })
            .skip(skipCount)
            .limit(pageSize);

        // 5. All Time Stats (Cards ke liye - filter nahi hoga)
        const allTimeStats = await Ledger.aggregate([
            { $match: baseQuery },
            { $group: { _id: null, totalDebit: { $sum: "$debit" }, totalCredit: { $sum: "$credit" } } }
        ]);
        const allTime = allTimeStats[0] || { totalDebit: 0, totalCredit: 0 };

        res.json({
            salesman: await Salesman.findById(salesmanId),
            openingBalance, 
            allTimeTotalDebit:  allTime.totalDebit,
            allTimeTotalCredit: allTime.totalCredit,
            allTimeNetBalance:  allTime.totalDebit - allTime.totalCredit,
            transactions,
            totalItems: await Ledger.countDocuments(filteredQuery)
        });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});
// ============================================================
// 6. ADD LEDGER ENTRY  —  POST /ledger/add
// ============================================================
router.post("/ledger/add", verifyUser, async (req, res) => {
    try {
        const { salesmanId, date, invoiceNo, description, debit, credit, type } = req.body;

        if (!salesmanId)
            return res.status(400).json({ message: "salesmanId zaroori hai" });

        if (!mongoose.Types.ObjectId.isValid(salesmanId))
            return res.status(400).json({ message: "salesmanId invalid hai" });

        // Salesman is usi user ka hona chahiye
        const salesman = await Salesman.findOne({ _id: salesmanId, user: req.user._id });
        if (!salesman)
            return res.status(404).json({ message: "Salesman nahi mila" });

        const debitAmt  = parseFloat(debit)  || 0;
        const creditAmt = parseFloat(credit) || 0;

        if (debitAmt === 0 && creditAmt === 0)
            return res.status(400).json({ message: "Debit ya Credit koi ek zaroori hai" });

        const entry = await Ledger.create({
            salesmanId,
            user:        req.user._id,
            date:        date ? new Date(date) : new Date(),
            invoiceNo:   invoiceNo   || "",
            description: description || "",
            debit:       debitAmt,
            credit:      creditAmt,
            type:        type || (debitAmt > 0 ? "debit" : "credit")
        });

        res.status(201).json({ message: "Entry add ho gayi", entry });

    } catch (err) {
        console.error("Ledger Add Error:", err);
        res.status(500).json({ message: "Error", error: err.message });
    }
});

// ============================================================
// 7. UPDATE LEDGER ENTRY  —  PUT /ledger/update/:id
// ============================================================
router.put("/ledger/update/:id", verifyUser, async (req, res) => {
    try {
        const { date, invoiceNo, description, debit, credit, type } = req.body;

        const entry = await Ledger.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            {
                date:        date ? new Date(date) : undefined,
                invoiceNo,
                description,
                debit:       parseFloat(debit)  || 0,
                credit:      parseFloat(credit) || 0,
                type
            },
            { new: true, runValidators: true }
        );

        if (!entry) return res.status(404).json({ message: "Entry nahi mili" });
        res.json({ message: "Entry update ho gayi", entry });

    } catch (err) {
        res.status(500).json({ message: "Error", error: err.message });
    }
});

// ============================================================
// 8. DELETE LEDGER ENTRY  —  DELETE /ledger/delete/:id
// ============================================================
router.delete("/ledger/delete/:id", verifyUser, async (req, res) => {
    try {
        const entry = await Ledger.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!entry) return res.status(404).json({ message: "Entry nahi mili" });
        res.json({ message: "Entry delete ho gayi" });
    } catch (err) {
        res.status(500).json({ message: "Error", error: err.message });
    }
});

// ============================================================
// 9. PDF DOWNLOAD  —  GET /ledger/pdf/:salesmanId
//    Query params: ?startDate=&endDate=
// ============================================================

router.get("/overall/summary", verifyUser, async (req, res) => {
    try {
        // 1. Total Salesmen kitne hain
        const totalSalesmen = await Salesman.countDocuments({ user: req.user._id });

        // 2. Poori market ka Total Debit aur Credit aggregation se
        const stats = await Ledger.aggregate([
            { $match: { user: req.user._id } }, // Sirf is user ka data
            {
                $group: {
                    _id: null,
                    totalMarketDebit:  { $sum: "$debit" },
                    totalMarketCredit: { $sum: "$credit" }
                }
            }
        ]);

        // Agar data nahi hai to 0 show karein
        const summary = stats[0] || { totalMarketDebit: 0, totalMarketCredit: 0 };

        res.json({
            totalSalesmen,
            totalMarketDebit:  summary.totalMarketDebit,
            totalMarketCredit: summary.totalMarketCredit,
            netMarketBalance:  summary.totalMarketDebit - summary.totalMarketCredit
        });

    } catch (err) {
        console.error("Summary Route Error:", err);
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});



// ============================================================
router.get("/reports/master-ledger/:pagesize/:page/:sort", verifyUser, async (req, res) => {
    try {
        const pageSize = parseInt(req.params.pagesize) || 20;
        const page = parseInt(req.params.page) || 1;
        const sortOrder = req.params.sort === "asc" ? 1 : -1;
        const { startDate, endDate } = req.query;

        let matchQuery = { user: req.user._id };

        // Sirf wahi date use hogi jo user ne input field mein di hai
        if (startDate && endDate && startDate !== 'undefined' && endDate !== 'undefined') {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0); // Din ka bilkul shuru (00:00:00)

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Din ka bilkul aakhir (23:59:59)

            matchQuery.date = { 
                $gte: start, 
                $lte: end 
            };
        }

        const result = await Ledger.aggregate([
            { $match: matchQuery }, // Ye match query ab 'date' field par filter karegi
            {
                $facet: {
                    "summary": [
                        { $group: { 
                            _id: null, 
                            totalDebit: { $sum: "$debit" }, 
                            totalCredit: { $sum: "$credit" }, 
                            count: { $sum: 1 } 
                        }}
                    ],
                    "data": [
                        // Yahan hum transaction date ke mutabiq sort kar rahay hain
                        { $sort: { date: sortOrder, createdAt: -1 } }, 
                        { $skip: (page - 1) * pageSize },
                        { $limit: pageSize },
                        {
                            $lookup: {
                                from: "salesmen", 
                                localField: "salesmanId",
                                foreignField: "_id",
                                as: "salesman"
                            }
                        },
                        { $unwind: { path: "$salesman", preserveNullAndEmptyArrays: true } }
                    ]
                }
            }
        ]);

        const summaryData = result[0].summary[0] || { totalDebit: 0, totalCredit: 0, count: 0 };
        
        res.json({
            totalItems: summaryData.count,
            summary: {
                totalDebit: summaryData.totalDebit,
                totalCredit: summaryData.totalCredit,
                netBalance: summaryData.totalDebit - summaryData.totalCredit
            },
            data: result[0].data 
        });

    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});


// ....................................................














router.get("/ledger/pdf/:salesmanId", verifyUser, async (req, res) => {
    try {
        const salesmanId = new mongoose.Types.ObjectId(req.params.salesmanId);
        const salesman = await Salesman.findOne({ _id: salesmanId, user: req.user._id });
        if (!salesman) return res.status(404).json({ message: "Salesman nahi mila" });

        const { startDate, endDate } = req.query;
        let query = { salesmanId, user: req.user._id };
        let openingBalance = 0;

// --- IS KO PASTE KAREIN ---
if (startDate && endDate && startDate !== 'undefined' && startDate !== '') {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0); // Din ka shuruat fix karein

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Din ka ikhtitam fix karein

    query.date = { $gte: start, $lte: end };

    // Opening Balance: Start date se pehle ka sara record
    const preStats = await Ledger.aggregate([
        { 
            $match: { 
                salesmanId: salesmanId, 
                user: req.user._id, 
                date: { $lt: start } 
            } 
        },
        { 
            $group: { 
                _id: null, 
                totalDebit: { $sum: "$debit" }, 
                totalCredit: { $sum: "$credit" } 
            } 
        }
    ]);

    if (preStats.length > 0) {
        openingBalance = (preStats[0].totalDebit || 0) - (preStats[0].totalCredit || 0);
    }
}

        const transactions = await Ledger.find(query).sort({ date: 1, createdAt: 1 });

        const doc = new PDFDocument({ margin: 40, size: "A4" });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=Ledger-${salesman.name}.pdf`);
        doc.pipe(res);

        const NAVY = "#1a237e"; const TEXT = "#333333"; const BORDER = "#e0e0e0";
        const COL = { sr: 40, date: 70, inv: 140, desc: 210, dr: 340, cr: 410, bal: 480 };

        const drawTableHeader = (yPos) => {
            doc.rect(40, yPos, 515, 20).fill(NAVY);
            doc.fillColor("white").font("Helvetica-Bold").fontSize(8.5);
            doc.text("#", COL.sr + 5, yPos + 6);
            doc.text("Date", COL.date, yPos + 6);
            doc.text("Invoice #", COL.inv, yPos + 6);
            doc.text("Description", COL.desc, yPos + 6);
            doc.text("Debit", COL.dr, yPos + 6, { width: 70, align: "right" });
            doc.text("Credit", COL.cr, yPos + 6, { width: 70, align: "right" });
            doc.text("Balance", COL.bal, yPos + 6, { width: 75, align: "right" });
            return yPos + 20;
        };

        // --- SHOP INFO ---
        doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(15).text((process.env.STORE_NAME || "Demo POS Store").toUpperCase(), 40, 40, { align: "center", width: 515 });
        doc.fontSize(9).font("Helvetica").text(process.env.STORE_PHONE || "", 40, 58, { align: "center", width: 515 });

        // --- LEDGER STATEMENT TITLE (With Spacing) ---
        // Y=88 par title hai taake box (Y=110) se gap rahe
        doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("LEDGER STATEMENT", 40, 88);

        // --- SALESMAN DETAILS BOX ---
        let y = 105; 
        doc.rect(40, y, 515, 45).stroke(BORDER);
        doc.fillColor(TEXT).fontSize(8.5).font("Helvetica-Bold");
        
        doc.text("Salesman:", 50, y + 10).font("Helvetica").text(`${salesman.name} | ${salesman.phone || "-"}`, 105, y + 10);
        doc.font("Helvetica-Bold").text("Company:", 50, y + 25).font("Helvetica").text(salesman.supplierCompany || "-", 105, y + 25);
        
        doc.font("Helvetica-Bold").text("Period:", 330, y + 10).font("Helvetica").text((startDate && endDate) ? `${startDate} to ${endDate}` : "All Time", 390, y + 10);
        doc.font("Helvetica-Bold").text("Print Date:", 330, y + 25).font("Helvetica").text(new Date().toLocaleDateString("en-PK"), 390, y + 25);

        // Gap after box before table
        y = 170; 
        y = drawTableHeader(y);

        // --- OPENING BALANCE ---
        let runningBalance = openingBalance;
        doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(8.5).rect(40, y, 515, 18).fill("#f5f5f5").stroke(BORDER);
        doc.fillColor(TEXT).text("OPENING BALANCE", COL.date, y + 5);
        doc.text(Math.abs(runningBalance).toLocaleString(), COL.bal, y + 5, { width: 75, align: "right" });
        y += 18;

        // --- TRANSACTIONS ---
        let totalDebit = 0; let totalCredit = 0;
        transactions.forEach((t, i) => {
            if (y > 750) { doc.addPage(); y = 50; y = drawTableHeader(y); }

            runningBalance += (t.debit || 0) - (t.credit || 0);
            totalDebit += (t.debit || 0);
            totalCredit += (t.credit || 0);

            doc.fillColor(TEXT).font("Helvetica").fontSize(8);
            doc.text(i + 1, COL.sr + 5, y + 5);
            doc.text(new Date(t.date).toLocaleDateString("en-PK"), COL.date, y + 5);
            doc.text(t.invoiceNo || "-", COL.inv, y + 5);
            doc.text(t.description || "-", COL.desc, y + 5, { width: 125, ellipsis: true });
            doc.text(t.debit > 0 ? t.debit.toLocaleString() : "-", COL.dr, y + 5, { width: 70, align: "right" });
            doc.text(t.credit > 0 ? t.credit.toLocaleString() : "-", COL.cr, y + 5, { width: 70, align: "right" });
            
            // Balance logic: Debit is positive, Credit is negative. 
            // Math.abs se waisa hi dikhega jaisa screenshot mein hai
            doc.font("Helvetica-Bold").text(Math.abs(runningBalance).toLocaleString(), COL.bal, y + 5, { width: 75, align: "right" });

            doc.moveTo(40, y + 15).lineTo(555, y + 15).lineWidth(0.5).stroke(BORDER);
            y += 18;
        });

        // --- FINAL SUMMARY ---
        if (y > 700) { doc.addPage(); y = 50; }
        y += 20;
        const sumX = 350;
        doc.rect(sumX, y, 205, 60).stroke(NAVY);
        doc.font("Helvetica-Bold").fontSize(9).text("SUMMARY", sumX, y + 8, { align: "center", width: 205 });
        doc.font("Helvetica").text(`Total Debit: ${totalDebit.toLocaleString()}`, sumX + 10, y + 22);
        doc.text(`Total Credit: ${totalCredit.toLocaleString()}`, sumX + 10, y + 34);
        doc.fillColor(NAVY).font("Helvetica-Bold").text(`NET BALANCE: ${Math.abs(runningBalance).toLocaleString()}`, sumX + 10, y + 46);

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).send("PDF Error");
    }
});
module.exports = router;