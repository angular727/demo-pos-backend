require('dotenv').config();

module.exports = {
    // JWT signing secret — .env se aata hai
    secretKey: process.env.JWT_SECRET || "12345-67890-09876-54321",

    // MongoDB connection — .env se aata hai (MONGO_URI)
    mongoUrl: process.env.MONGO_URI,

    facebook: {
        clientId: process.env.FB_CLIENT_ID || "1234567890123456",
        clientSecret: process.env.FB_CLIENT_SECRET || "12345678901234561234567890123456"
    }
};
