const { User } = require('../models');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

exports.initializeMasterAdmin = async () => {
  try {
    const adminEmail = process.env.MASTER_ADMIN_EMAIL;
    const adminPassword = process.env.MASTER_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      logger.warn('Master admin credentials not set in environment variables');
      return;
    }

    // Check if admin exists
    const existingAdmin = await User.findOne({ where: { email: adminEmail } });
    
    if (!existingAdmin) {
      await User.create({
        email: adminEmail,
        password: adminPassword,
        firstName: 'Master',
        lastName: 'Admin',
        role: 'admin',
        subscriptionStatus: 'active',
        isActive: true
      });
      logger.info('Master admin account created successfully');
    } else {
      logger.info('Master admin account already exists');
    }
  } catch (error) {
    logger.error('Error initializing master admin:', error);
  }
};
