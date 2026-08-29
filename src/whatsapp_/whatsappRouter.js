
const express = require("express");
const bodyParser = require("body-parser");
const verifyUser = require("../../middlewares/authenticate").verifyUser;
const verifyAdmin = require("../../middlewares/authenticate").verifyAdmin;
const whatsappRouter = express.Router();
const cors = require("../cors");
const Token = require('./whatsAppModel');

const axios = require('axios');
// WhatsApp API configuration
const WHATSAPP_API_VERSION = 'v21.0'; // Updated to v21.0 as per your example
const PHONE_NUMBER_ID = '510745258778886'; // Your phone number ID
const ACCESS_TOKEN = 'EAAWEdExZA8SoBO2PC9dch5KFFmVTQH5WIkjHCv62LXkGIyrwAFOqa7suy4ir4CI40p0r8tm1ZANAsZBreePCHgZAxYebYepjZBtAYsxWwZAewcKZBAm2KvKyum0sHMEfvavwgmXCBJ12dC0LHuZCWXBhQXuGaeU2Ljkve6lk2jKDj0DdKU4l6MBEX4JGC6GjcqZAHvSgNZBrmi6tpXD1b0cgdb9I3g9HzeI9QrtKzkXQxnbscZD';
const BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}`;
async function generateToken(req, res) {
    try {
      // Step 1: Get temporary access token
      const tempTokenResponse = await axios.get(
        'https://graph.facebook.com/oauth/access_token',
        {
          params: {
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            grant_type: 'client_credentials'
          }
        }
      );
  
      const tempToken = tempTokenResponse.data.access_token;
  
      // Step 2: Create system user
      const systemUserResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/system_users`,
        {
          name: `WhatsApp API User ${new Date().toISOString()}`,
          role: 'ADMIN',
          scope: ['whatsapp_business_messaging', 'whatsapp_business_management']
        },
        {
          headers: {
            Authorization: `Bearer ${tempToken}`
          }
        }
      );
  
      const systemUserId = systemUserResponse.data.id;
  
      // Step 3: Generate permanent token
      const permanentTokenResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${systemUserId}/access_tokens`,
        {
          app_id: process.env.META_APP_ID,
          scope: ['whatsapp_business_messaging', 'whatsapp_business_management'],
          expires_in: 0 // Never expire
        },
        {
          headers: {
            Authorization: `Bearer ${tempToken}`
          }
        }
      );
  
      // Step 4: Store in MongoDB
      const newToken = await Token.create({
        token: permanentTokenResponse.data.access_token,
        systemUserId,
        status: 'valid'
      });
  
      // Step 5: Deactivate previous tokens
      await Token.updateMany(
        { 
          _id: { $ne: newToken._id },
          isActive: true 
        },
        { 
          isActive: false,
          status: 'revoked'
        }
      );
  
      res.json({
        success: true,
        token: permanentTokenResponse.data.access_token,
        systemUserId: systemUserId
      });
  
    } catch (error) {
      throw error;
    }
  }

whatsappRouter.use(bodyParser.json());

whatsappRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors,  (req, res, next) => {
 
     try {
    console.log("find inside get whatsapp: ",);
    
    }
    catch(err){
        res.json(err);
    }
  })
 //post call for to create
 .post(cors.corsWithOptions,  async(req, res, next) => {

    try {
        const { phoneNumber, message } = req.body;
    
        const response = await axios.post(
          `${BASE_URL}/messages`,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phoneNumber,
            type: 'text',
            text: { 
              preview_url: false,
              body: message
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
    
        res.json({ 
          success: true, 
          data: response.data 
        });
      } catch (error) {
        console.error('WhatsApp API Error:', error.response?.data || error.message);
        res.status(500).json({
          success: false,
          message: error.response?.data?.error?.message || 'Failed to send message',
          error: error.response?.data || error.message
        });
      }
    
 })


  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /Product");
  });


  whatsappRouter
  .route("/token")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res, next) => {
 
    try {
        generateToken(req, res);
    
      } catch (error) {
        console.error('Token generation error:', error.response?.data || error);
        res.status(500).json({
          success: false,
          error: error.response?.data || error.message
        });
      }
  })
  // POST - Validate and store existing token
  .post(cors.corsWithOptions, async(req, res, next) => {
    try {
      const { token, systemUserId } = req.body;

      if (!token || !systemUserId) {
        return res.status(400).json({
          success: false,
          error: 'Token and systemUserId are required'
        });
      }

      // Validate token with Meta API
      const validationResponse = await axios.get(
        'https://graph.facebook.com/debug_token',
        {
          params: {
            input_token: token,
            access_token: token
          }
        }
      );

      if (!validationResponse.data.data.is_valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid token provided'
        });
      }

      // Store token in MongoDB
      const newToken = await Token.create({
        token,
        systemUserId,
        status: 'valid'
      });

      // Deactivate previous tokens
      await Token.updateMany(
        { 
          _id: { $ne: newToken._id },
          isActive: true 
        },
        { 
          isActive: false,
          status: 'revoked'
        }
      );

      res.json({
        success: true,
        token: newToken
      });

    } catch (error) {
      console.error('Token storage error:', error.response?.data || error);
      res.status(500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
  })


  .put(cors.corsWithOptions, verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end("PUT operation not supported on /Product");
  });




// Additional routes for token management
whatsappRouter.route("/token/validate")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res) => {
    try {
      const activeToken = await Token.findOne({ 
        isActive: true,
        status: 'valid'
      });

      if (!activeToken) {
        return res.status(404).json({
          success: false,
          message: 'No active token found'
        });
      }

      // Validate with Meta API
      const response = await axios.get(
        'https://graph.facebook.com/debug_token',
        {
          params: {
            input_token: activeToken.token,
            access_token: activeToken.token
          }
        }
      );

      if (!response.data.data.is_valid) {
        activeToken.status = 'expired';
        activeToken.isActive = false;
        await activeToken.save();
      } else {
        activeToken.lastUsed = new Date();
        await activeToken.save();
      }

      res.json({
        success: true,
        isValid: response.data.data.is_valid,
        tokenData: activeToken
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
  });



  whatsappRouter
  .route("/revoke-token")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, async (req, res, next) => {
    try {
        const { systemUserId } = req.body;
        const token = process.env.WHATSAPP_ACCESS_TOKEN;
    
        await axios.delete(
          `https://graph.facebook.com/v21.0/${systemUserId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
    
        res.json({
          success: true,
          message: 'Token revoked successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.response?.data || error.message
        });
      }
  })
 //post call for to create
 .post(cors.corsWithOptions,  async(req, res, next) => {

    
 });



 whatsappRouter.route("/token/active")
        .options(cors.corsWithOptions, (req, res) => {
        res.sendStatus(200);
        })
        .get(cors.cors, async (req, res) => {
        try {
            const activeToken = await Token.findOne({ 
            isActive: true,
            status: 'valid' 
            }).sort({ createdAt: -1 });

            if (!activeToken) {
            return res.status(404).json({
                success: false,
                message: 'No active token found'
            });
            }

            res.json({
            success: true,
            token: activeToken
            });
        } catch (error) {
            res.status(500).json({
            success: false,
            error: error.message
            });
        }
 });





// Token storage function (implement secure storage method)
async function generateToken (req, res) {
    try {
      // Step 1: Generate token using Meta API (as before)
      const tempTokenResponse = await axios.get(
        'https://graph.facebook.com/oauth/access_token',
        {
          params: {
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            grant_type: 'client_credentials'
          }
        }
      );

      const tempToken = tempTokenResponse.data.access_token;

      // Step 2: Create system user
      const systemUserResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/system_users`,
        {
          name: `WhatsApp API User ${new Date().toISOString()}`,
          role: 'ADMIN',
          scope: ['whatsapp_business_messaging', 'whatsapp_business_management']
        },
        {
          headers: {
            Authorization: `Bearer ${tempToken}`
          }
        }
      );

      const systemUserId = systemUserResponse.data.id;

      // Step 3: Generate permanent token
      const permanentTokenResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${systemUserId}/access_tokens`,
        {
          app_id: process.env.META_APP_ID,
          scope: ['whatsapp_business_messaging', 'whatsapp_business_management'],
          expires_in: 0
        },
        {
          headers: {
            Authorization: `Bearer ${tempToken}`
          }
        }
      );

      // Step 4: Store token in MongoDB
      const newToken = await Token.create({
        token: permanentTokenResponse.data.access_token,
        systemUserId,
        scope: ['whatsapp_business_messaging', 'whatsapp_business_management'],
        status: 'valid'
      });

      // Step 5: Deactivate previous tokens
      await Token.updateMany(
        { 
          _id: { $ne: newToken._id },
          isActive: true 
        },
        { 
          isActive: false,
          status: 'revoked'
        }
      );

      res.json({
        success: true,
        token: newToken
      });

    } catch (error) {
      console.error('Token generation error:', error);
      res.status(500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
  }




module.exports = whatsappRouter;
