var express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
var User = require("./userModel");
var passport = require("passport");
const authenticate=require("../../middlewares/authenticate")
const cors = require("../cors");
const SideUsers = require("../sideUser/sideUserModel");

router.use(bodyParser.json());
const { queryBuilder, queryBuilderWithBody } = require("../shared/querryBuilder");

router.options("*", cors.corsWithOptions, (req, res) => {
  res.sendStatus(200);
});
// Get User
router.get("/",cors.corsWithOptions,authenticate.verifyUser, (req, res, next) => {
  
  const find = queryBuilder(req);
  console.log( "find in get users: ", find);;
  User.find(find)
  
    .then(
      users => {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.json(users);
      },
      err => next(err)
    )
    .catch(err => next(err));
});
// User sign up
router.post("/signup", cors.corsWithOptions, (req, res, next) => {
  User.register(new User({ username: req.body.username }), req.body.password, (err, user) => {
    if (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.json({ err: err });
    } else {
      console.log("req.body ", req.body);
      if (req.body.name) user.name = req.body.name;
      if (req.body.lastname) user.lastname = req.body.lastname;
      if (req.body.email) user.email = req.body.email;
      if (req.body.role) user.role = req.body.role;
      if (req.body.dp) user.dp = req.body.dp;
      if (req.body.phone) user.phone = req.body.phone;
      if (req.body.easyPaisa) user.easyPaisa = req.body.easyPaisa;
      if (req.body.jazzCash) user.jazzCash = req.body.jazzCash;
      if (req.body.bankNo) user.bank_no = req.body.bankNo;
      if (req.body.customerRef) user.customerRef = req.body.customerRef;
      if (req.body.bankCode) user.bankCode = req.body.bankCode;
      if (req.body.idCard) user.idCard = req.body.idCard;
      if (req.body.city) user.city = req.body.city;
      if (req.body.area) user.area = req.body.area;
      if (req.body.DOB) user.DOB = req.body.DOB;
      if (req.body.designation) user.designation = req.body.designation;
      if (req.body.status) user.status = req.body.status;
      if (req.body.active) user.active = req.body.active;
      if (req.body.territory) user.territory = req.body.territory;
      if (req.body.shopName) user.shopName = req.body.shopName;
      // if (req.body.distributors) user.distributors = req.body.distributors;
      if (req.body.distributors) user.distributors = req.body.distributors;
      if (req.body.createdBy) user.createdBy = req.body.createdBy;
      if (req.body.cws) user.cws = req.body.cws;

      user.save((err, user) => {
        if (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.json({ err: err });
          return;
        }
        
        SideUsers.create({ user: user._id, pass:req.body.password })
            .then(
                product => {
                            },
                err => next(err)
            )
            .catch(err => next(err));
        passport.authenticate("local")(req, res, () => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.json(user);
        });
      });
    }
  });
});
// user login
router.post("/login", cors.corsWithOptions, (req, res, next) => {
  passport.authenticate("local", {
   
    keepSessionInfo: false
  },(err, user, info) => {
    if (err) return next(err);

    if (!user) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
       res.json({ success: false, status: "Login Unsuccessful!", err: info });
       return
    }
    req.logIn(user, err => {
      if (err) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.json({ success: false, status: "Login Unsuccessful|||!", err: user });
        return
      }
    
      var token = authenticate.getToken({ _id: req.user._id });
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.json({ success: true, status: "Login Successful!", token: token });
    });
  })(req, res, next);
});
// user logout
router.get("/logout",cors.corsWithOptions, (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
  if (req.session) {
    req.session.destroy();
    res.clearCookie("session-id");
    res.redirect("/");
  } else {
    var err = new Error("You are not logged in!");
    err.status = 403;
    next(err);
  } 
});
// facebook/token
router.get("/facebook/token",passport.authenticate("facebook-token"), (req, res) => {
  if (req.user) {
    var token = authenticate.getToken({ _id: req.user._id });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.json({ success: true, token: token, status: "You are successfully logged in!" });
  }
});
// get checkJWTtoken
router.get("/checkJWTtoken", cors.corsWithOptions, (req, res) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      return res.json({ status: "JWT invalid!", success: false, err: info });
    } else {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.json({ status: "JWT valid!", success: true, user: user });
    }
  })(req, res);
});


// get user by Id
router.get("/:userId",cors.corsWithOptions, authenticate.verifyUser,   (req, res, next) => {
  console.log("del user: ",req.params.userId);
  User.findById(req.params.userId)
    .then(
      (resp) => {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.json(resp);
      },
      err => next(err)
    )
    .catch(err => next(err));
});
// update user by Id
router.put("/:userId",cors.corsWithOptions,  (req, res, next) => {
  console.log("update user: ",req.params.userId);
  User.findByIdAndUpdate(
    req.params.userId, {
            $set: req.body
        }, { new: true }
    )
    .then(
        product => {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.json(product);
        },
        err => next(err)
    )
    .catch(err => next(err));
    });
// delete user by Id
router.delete("/:userId",cors.corsWithOptions, authenticate.verifyUser, authenticate.verifyAdmin,  (req, res, next) => {
  console.log("del user: ",req.params.userId);
  User.findByIdAndRemove(req.params.userId)
    .then(
      (resp) => {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.json(resp);
      },
      err => next(err)
    )
    .catch(err => next(err));
});

router.get("/count", (req, res, next) => {
  console.log(req.query)
  User.find(req.query)
  .count()
  
    .then(
      users => {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.json(users);
      },
      err => next(err)
    )
    .catch(err => next(err));
});
module.exports=router;
