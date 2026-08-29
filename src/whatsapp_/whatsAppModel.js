const mongoose = require("mongoose");


const whatsappSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
      },
      isActive: {
        type: Boolean,
        default: true
      },
      systemUserId: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      expiresAt: {
        type: Date
      },
      lastUsed: {
        type: Date,
        default: Date.now
      },
      scope: [{
        type: String
      }],
      status: {
        type: String,
        enum: ['valid', 'expired', 'revoked'],
        default: 'valid'
      },
    },

 { timestamps: true });

 

 const Whatsapp = mongoose.model("Whatsapp", whatsappSchema);
 

module.exports = Whatsapp
