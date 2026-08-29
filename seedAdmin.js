/**
 * Admin user seed script
 *   npm run seed:admin
 * Default: username "admin", password "admin"
 */
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./config');
const User = require('./src/users/userModel');

const USERNAME = process.argv[2] || 'admin';
const PASSWORD = process.argv[3] || 'admin';

(async () => {
  try {
    await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to db:', mongoose.connection.name);

    const existing = await User.findOne({ username: USERNAME });
    if (existing) {
      await existing.setPassword(PASSWORD);
      existing.role = 'admin';
      existing.admin = true;
      existing.active = true;
      existing.name = existing.name || 'Administrator';
      await existing.save();
      console.log(`Existing user "${USERNAME}" updated (password reset, role=admin)`);
    } else {
      const user = await User.register(
        new User({
          username: USERNAME,
          name: 'Administrator',
          role: 'admin',
          admin: true,
          active: true,
          vendor: 'pos'
        }),
        PASSWORD
      );
      console.log(`Admin created -> _id: ${user._id}`);
    }

    console.log('---------------------------------');
    console.log('  username:', USERNAME);
    console.log('  password:', PASSWORD);
    console.log('  role    : admin');
    console.log('---------------------------------');
    process.exit(0);
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exit(1);
  }
})();
