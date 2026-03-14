const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('client', 'educator', 'admin'),
    defaultValue: 'client',
    allowNull: false
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  subscriptionStatus: {
    type: DataTypes.ENUM('active', 'inactive', 'cancelled', 'past_due'),
    defaultValue: 'inactive'
  },
  subscriptionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  subscriptionEndDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  subscriptionTier: {
    type: DataTypes.ENUM('none', 'bronze', 'silver', 'gold', 'platinum'),
    defaultValue: 'none'
  },
  referralCode: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  referredBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  referralBalance: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  fcmToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pushSubscription: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  notificationPreferences: {
    type: DataTypes.JSONB,
    defaultValue: { email: true, push: true, inApp: true, signals: true, news: true, chat: true }
  },
  isBanned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

User.prototype.hasActiveSubscription = function() {
  // Admin and educator always have access
  if (this.role === 'admin' || this.role === 'educator') {
    return true;
  }
  
  // Check if subscription is active
  if (this.subscriptionStatus === 'active') {
    // If endDate exists, check it's in the future
    if (this.subscriptionEndDate) {
      return new Date(this.subscriptionEndDate) > new Date();
    }
    // If no endDate but status is active, allow access
    return true;
  }
  
  return false;
};

User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values;
};

module.exports = User;
