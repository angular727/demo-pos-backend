const mongoose = require("mongoose");

const khataCustomerSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    cnic: { type: String, default: "" },      // ID Card
    address: { type: String, default: "" },   // Address
    openingBalance: { type: Number, default: 0 }, 
    active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("KhataCustomer", khataCustomerSchema);