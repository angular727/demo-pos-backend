const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const themeSchema = new Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',

    },
    vendorId: {
           type: mongoose.Schema.Types.ObjectId,
           ref: 'Vendor',
           required: true
           
         },
    backgroundColor: {
        type: String,
        default: ""
    },
    color: {
        type: String,
        default: ""
    },
    hoverColor: {
        type: String,
        default: ""
    },

}, {
    timestamps: true
});

const Theme = mongoose.model("theme", themeSchema);

module.exports = Theme;