const mongoose = require("mongoose");

const salesmanSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    cnic: { type: String, default: "" },
    supplierCompany: { type: String, default: "" },
    productsName: [String],
    visitDays: [String],
    openingBalance: { type: Number, default: 0 }, 
    totalBalance: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Salesman", salesmanSchema);