const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
require('dotenv').config();

const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");
const cors = require('./src/cors');

const app = express();
const config = require("./config");

app.use(cors.corsWithOptions);

// ---------- MongoDB (serverless-safe cached connection) ----------
// Vercel har invocation pe module reuse karta hai, isliye connection ko
// global pe cache karte hain — warna har request nayi connection banati.
let cached = global.__mongooseCache;
if (!cached) cached = global.__mongooseCache = { conn: null, promise: null, error: null };

function connectDB() {
  if (cached.conn) return Promise.resolve(cached.conn);
  if (!config.mongoUrl) return Promise.reject(new Error('MONGO_URI environment variable set nahi hai'));

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(config.mongoUrl, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 8000,
        bufferCommands: false
      })
      .then(m => {
        cached.conn = m;
        cached.error = null;
        console.log('MongoDB connected -> db:', mongoose.connection.name);
        return m;
      })
      .catch(err => {
        cached.promise = null;          // agli request dobara try kare
        cached.error = err;
        console.error('MongoDB connection error:', err.message);
        throw err;
      });
  }
  return cached.promise;
}

app.set('trust proxy', 1);

// ---------- Session / Passport ----------
app.use(
  session({
    name: "session-id",
    secret: process.env.SESSION_SECRET || config.secretKey,
    saveUninitialized: false,
    resave: false
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ---------- Parsers ----------
app.use(logger('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());

// ---------- Har request se pehle DB connected ho ----------
app.use(async (req, res, next) => {
  if (req.path === '/health') return next();   // health check DB ke baghair bhi jawab de
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
      error: err.message
    });
  }
});

// ---------- Health check ----------
app.get('/health', (req, res) => {
  connectDB().then(
    () => res.json({
      status: 'ok',
      db: mongoose.connection.name || null,
      dbState: mongoose.connection.readyState // 1 = connected
    }),
    err => res.status(503).json({
      status: 'db_error',
      db: null,
      dbState: mongoose.connection.readyState,
      error: err.message
    })
  );
});

// ---------- API routes (/pos/...) ----------
require('./mainRoutes')(app);

// ---------- 404 ----------
app.use(function (req, res, next) {
  next(createError(404));
});

// ---------- Error handler ----------
app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({
    success: false,
    message: err.message,
    error: req.app.get('env') === 'development' ? err.stack : undefined
  });
});

module.exports = app;
