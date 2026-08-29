// Vercel serverless entry point.
// Vercel har request ke liye ye module chalata hai — yahan server.listen()
// nahi hota, sirf Express app export hoti hai.
module.exports = require('../app');
