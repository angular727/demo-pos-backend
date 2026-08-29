const cors = require("cors");

// Local development origins
const whitelist = [
  "http://localhost:4200",
  "https://localhost:4200",
  "http://localhost:5000",
  "http://localhost:4300",
  "https://localhost:4300",
  "http://localhost:3000",
  "http://127.0.0.1:4200",
];

// Vercel (ya koi bhi production) URL .env ke CLIENT_URL me daalein.
// Multiple URLs comma se separate karein.
if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(",")
    .map(u => u.trim().replace(/\/$/, ""))
    .filter(Boolean)
    .forEach(u => whitelist.push(u));
}

const corsOptionsDelegate = (req, callback) => {
  const origin = req.header("Origin");
  let corsOptions;

  if (!origin) {
    // Postman / curl / server-to-server
    corsOptions = { origin: true, credentials: true };
  } else if (whitelist.includes(origin.replace(/\/$/, ""))) {
    corsOptions = { origin: true, credentials: true };
  } else if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
    // Vercel preview + production deployments
    corsOptions = { origin: true, credentials: true };
  } else {
    console.log("CORS blocked origin:", origin);
    corsOptions = { origin: false };
  }

  callback(null, corsOptions);
};

exports.cors = cors();
exports.corsWithOptions = cors(corsOptionsDelegate);
