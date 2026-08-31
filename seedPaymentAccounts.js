/**
 * 3 payment accounts add karta hai (Sale/Purchase ke Payment Method dropdown ke liye).
 *
 * Note: Payment schema me vendorId required hai, aur POST /pos/paymentaccount
 * usay req.user.vendorId se leta hai — jo admin ke paas nahi. Isliye yahan ek
 * Vendor document bana kar usi ka _id use karte hain, models ke through, taake
 * schema validation poori tarah chale. Koi application code nahi badla.
 *
 *   npm run seed:payments
 */
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./config');
const Payment = require('./src/paymentAccount/paymentAccountModel');
const Vendor = require('./src/vendor/vendorModel');
const User = require('./src/users/userModel');

const accounts = [
  { accountType: 'Cash',   accountTitle: 'Cash in Hand',   accountNo: '',                       accountOwner: 'Administrator', description: 'Counter cash',        openingBalance: '0' },
  { accountType: 'Bank',   accountTitle: 'Meezan Bank',    accountNo: 'PK36MEZN0001234567890123', accountOwner: 'Administrator', description: 'Main bank account',  openingBalance: '0', branchAddress: 'Main Branch' },
  { accountType: 'Mobile', accountTitle: 'Easypaisa',      accountNo: '030012334567',            accountOwner: 'Administrator', description: 'Mobile wallet',      openingBalance: '0' }
];

(async () => {
  await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to db:', mongoose.connection.name, '\n');

  const admin = await User.findOne({ username: 'admin' });
  if (!admin) { console.error('admin user nahi mila'); process.exit(1); }

  let vendor = await Vendor.findOne({ username: 'demo-pos' });
  if (!vendor) {
    vendor = await Vendor.create({
      username: 'demo-pos',
      name: 'Demo POS Store',
      role: 'admin',
      vendorCode: 'DEMO',
      userRef: admin._id
    });
    console.log('Vendor banaya ->', vendor.name, vendor._id);
  } else {
    console.log('Vendor pehle se hai ->', vendor.name, vendor._id);
  }
  console.log();

  for (const a of accounts) {
    const existing = await Payment.findOne({ accountTitle: a.accountTitle });
    if (existing) { console.log(`SKIP  ${a.accountTitle} (pehle se hai)`); continue; }
    const created = await Payment.create({ ...a, user: admin._id, vendorId: vendor._id });
    console.log(`OK    ${created.accountType.padEnd(7)} ${created.accountTitle.padEnd(16)} ${created.accountNo || '-'}`);
  }

  process.exit(0);
})().catch(e => { console.error('Failed:', e.message); process.exit(1); });
