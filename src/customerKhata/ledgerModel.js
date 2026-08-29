const mongoose = require("mongoose");

const khataLedgerSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'KhataCustomer', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    invoiceNo: { type: String, default: "" },
    description: { type: String, default: "" },
    debit: { type: Number, default: 0 },  // Udhaar / Sale
    credit: { type: Number, default: 0 }, // Vasuli / Cash
    type: { type: String, enum: ['debit', 'credit'] } 
}, { timestamps: true });

module.exports = mongoose.model("KhataLedger", khataLedgerSchema);