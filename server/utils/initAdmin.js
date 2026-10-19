const { User } = require('../models');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

exports.initializeMasterAdmin = async () => {
  try {
    const adminEmail = process.env.MASTER_ADMIN_EMAIL || 'admin@tradingplatform.com';
    const adminPassword = process.env.MASTER_ADMIN_PASSWORD || 'SecureAdminPass2026!@#$';

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
      // Ensure admin account is active and role is admin
      let needsSave = false;
      if (!existingAdmin.isActive) {
        existingAdmin.isActive = true;
        needsSave = true;
      }
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        needsSave = true;
      }
      if (process.env.MASTER_ADMIN_PASSWORD) {
        existingAdmin.password = adminPassword;
        needsSave = true;
      }
      if (needsSave) {
        await existingAdmin.save();
        logger.info('Master admin account updated successfully');
      } else {
        logger.info('Master admin account already exists');
      }
    }
  } catch (error) {
    logger.error('Error initializing master admin:', error);
  }
};
