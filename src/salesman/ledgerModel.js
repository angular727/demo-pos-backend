const mongoose = require("mongoose");

const ledgerSchema = new mongoose.Schema({
    salesmanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesman', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    invoiceNo: { type: String, default: "" },
    description: { type: String, default: "" },
    debit: { type: Number, default: 0 },  // Saman / Udhaar
    credit: { type: Number, default: 0 }, // Vasuli / Cash
    type: { type: String, enum: ['debit', 'credit'] } 
}, { timestamps: true });

module.exports = mongoose.model("SalesmanLedger", ledgerSchema);