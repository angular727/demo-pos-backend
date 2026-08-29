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

// ---------- MongoDB ----------
mongoose
  .connect(config.mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log("MongoDB connected -> db:", mongoose.connection.name);
  })
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
  });

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

// ---------- View engine (error pages) ----------
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// ---------- Parsers ----------
app.use(logger('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());

// ---------- Health check ----------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.name || null,
    dbState: mongoose.connection.readyState // 1 = connected
  });
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
