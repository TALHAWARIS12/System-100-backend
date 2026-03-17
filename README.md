# Gold Circle Community - Production-Ready SaaS

A professional, full-stack trading scanner and signal platform with multi-role authentication, subscription-based access control, and real-time market analysis.

![Platform Status](https://img.shields.io/badge/status-production--ready-success)
![License](https://img.shields.io/badge/license-proprietary-blue)

## 🎯 Overview

This is a **production-ready SaaS application** designed for trading education and signal distribution. Built with modern technologies and security best practices, it provides:

- **Real-time market scanner** with rule-based technical analysis
- **Professional trade signal distribution** from certified educators
- **Subscription management** with Stripe integration
- **Advanced trading calculators** for risk management
- **Multi-role authentication** with strict access control
- **Responsive, professional UI** optimized for traders

## ✨ Key Features

### For Clients (Subscribers)
- ✅ Real-time scanner signals across multiple currency pairs
- ✅ Professional trade ideas with entry, SL, and TP levels
- ✅ Advanced calculators (pip, risk, P/L)
- ✅ Clean, trader-focused dashboard
- ✅ Mobile-responsive interface

### For Educators
- ✅ Create and manage trade signals
- ✅ Control signal visibility
- ✅ Track performance metrics
- ✅ Dedicated educator dashboard

### For Administrators
- ✅ Full platform control
- ✅ User management (clients & educators)
- ✅ Scanner configuration and strategy management
- ✅ Subscription analytics
- ✅ System monitoring

## 🏗️ Tech Stack

**Backend:**
- Node.js + Express.js
- PostgreSQL with Sequelize ORM
- JWT authentication
- Stripe for payments
- Winston for logging
- Node-cron for scheduled tasks

**Frontend:**
- React 18 with Vite
- Tailwind CSS for styling
- Zustand for state management
- React Router for navigation
- Axios for API calls
- React Hot Toast for notifications

**Security:**
- Helmet.js for security headers
- Bcrypt for password hashing
- Rate limiting
- CORS protection
- SQL injection prevention
- Stripe webhook signature verification

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+
- **Stripe Account** (for subscriptions)
- **Domain name** (for production)
- **SSL certificate** (Let's Encrypt recommended)

## 🚀 Quick Start

### Development Setup

```bash
# 1. Install dependencies
npm install
cd client && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 3. Start development servers
npm run dev
```

**Access the application:**
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

**Default admin credentials:**
- Email: admin@test.com (configurable in .env)
- Password: Admin123! (configurable in .env)

📖 **Full setup guide:** See [SETUP.md](SETUP.md)

### Production Deployment

```bash
# 1. Build frontend
cd client && npm run build && cd ..

# 2. Start with PM2
pm2 start server/index.js --name trading-platform

# 3. Configure Nginx reverse proxy
# See DEPLOYMENT.md for complete guide
```

🚀 **Full deployment guide:** See [DEPLOYMENT.md](DEPLOYMENT.md)

## 📁 Project Structure

```
System-100/
├── server/                     # Backend API
│   ├── config/                # Database & config
│   ├── controllers/           # Request handlers
│   ├── middleware/            # Auth & validation
│   ├── models/                # Database models
│   ├── routes/                # API endpoints
│   ├── services/              # Business logic (scanner engine)
│   ├── utils/                 # Helpers & utilities
│   └── index.js               # Server entry point
│
├── client/                     # Frontend React app
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   │   └── layouts/       # Layout components
│   │   ├── pages/             # Page components
│   │   │   ├── auth/          # Login, Register
│   │   │   ├── admin/         # Admin pages
│   │   │   └── educator/      # Educator pages
│   │   ├── store/             # Zustand state
│   │   ├── utils/             # API & helpers
│   │   ├── App.jsx            # Main app
│   │   ├── main.jsx           # Entry point
│   │   └── index.css          # Global styles
│   └── package.json
│
├── logs/                       # Application logs
├── .env.example               # Environment template
├── package.json               # Root dependencies
├── README.md                  # This file
├── SETUP.md                   # Development setup
└── DEPLOYMENT.md              # Production deployment
```

## 🔐 User Roles & Permissions

### Master Admin
- **Full system access**
- Create educator accounts
- Manage all users
- Configure scanner strategies
- View all analytics
- System settings

### Educator
- **Trade signal management**
- Create/edit/delete own trades
- Control trade visibility
- View performance statistics
- No subscription required

### Client (Subscriber)
- **View-only access**
- Scanner results (with active subscription)
- Trade signals (with active subscription)
- Trading calculators (with active subscription)
- **Subscription required for access**

## 🔑 API Endpoints

### Authentication
```
POST   /api/auth/register      - Register new client
POST   /api/auth/login         - Login
GET    /api/auth/me            - Get current user
PUT    /api/auth/password      - Update password
```

### Scanner
```
GET    /api/scanner/results    - Get signals (requires subscription)
GET    /api/scanner/configs    - Get configurations (admin/educator)
POST   /api/scanner/configs    - Create config (admin)
PUT    /api/scanner/configs/:id - Update config (admin)
POST   /api/scanner/run        - Manual trigger (admin)
GET    /api/scanner/stats      - Get statistics
```

### Trades
```
GET    /api/trades             - Get all visible trades
GET    /api/trades/:id         - Get single trade
POST   /api/trades             - Create trade (educator/admin)
PUT    /api/trades/:id         - Update trade (educator/admin)
DELETE /api/trades/:id         - Delete trade (educator/admin)
POST   /api/trades/:id/close   - Close trade (educator/admin)
GET    /api/trades/educator/mine - Get educator's trades
GET    /api/trades/stats       - Get statistics
```

### Subscriptions
```
POST   /api/subscriptions/create-checkout - Create Stripe checkout
POST   /api/subscriptions/create-portal   - Billing portal
GET    /api/subscriptions/status          - Subscription status
```

### Calculators
```
POST   /api/calculators/pips          - Calculate pips
POST   /api/calculators/risk          - Risk/position size
POST   /api/calculators/profit-loss   - Profit/loss calculation
```

### Admin - Users
```
GET    /api/users              - Get all users (admin)
GET    /api/users/:id          - Get single user (admin)
PUT    /api/users/:id          - Update user (admin)
DELETE /api/users/:id          - Delete user (admin)
POST   /api/users/educator     - Create educator (admin)
GET    /api/users/stats        - User statistics (admin)
```

## 💳 Stripe Integration

The platform uses Stripe for subscription management with full webhook support:

**Supported Events:**
- `checkout.session.completed` - New subscription
- `customer.subscription.updated` - Subscription changes
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_succeeded` - Successful payment
- `invoice.payment_failed` - Failed payment

**Access Control:**
- Clients without active subscription are automatically blocked
- Real-time access updates via webhooks
- Secure webhook signature verification

## 🤖 Scanner Engine

The scanner engine runs rule-based strategies on a scheduled basis:

**Built-in Strategies:**
1. **RSI Oversold/Overbought** - Momentum indicator signals
2. **MACD Crossover** - Trend following signals
3. **Moving Average Cross** - Golden/Death cross detection
4. **Support/Resistance** - Price level bounce signals

**Configurable Parameters:**
- Timeframes (1h, 4h, 1d)
- Currency pairs (Forex, Crypto)
- Scan intervals
- Strategy rules (thresholds, indicators)

**Extensible Architecture:**
- Easy to add new strategies
- Clean strategy pattern implementation
- No hard-coded logic

## 🛡️ Security Features

- ✅ JWT-based authentication with secure tokens
- ✅ Bcrypt password hashing (10 rounds)
- ✅ Role-based access control (RBAC)
- ✅ Rate limiting (100 requests/15 minutes)
- ✅ Helmet.js security headers
- ✅ CORS protection
- ✅ SQL injection prevention via Sequelize
- ✅ XSS protection
- ✅ Stripe webhook signature verification
- ✅ Environment variable protection

## 📊 Database Schema

**Main Tables:**
- `Users` - All user accounts with roles
- `Trades` - Trade signals from educators
- `ScannerResults` - Generated scanner signals
- `ScannerConfigs` - Strategy configurations

**Key Relationships:**
- User → Trades (one-to-many)
- Educator → Trades (ownership)

## 🎨 UI/UX Features

- **Dark mode by default** - Trader-friendly interface
- **Responsive design** - Mobile, tablet, desktop
- **Real-time updates** - Live data without refresh
- **Professional charts** - Clean, modern design
- **Intuitive navigation** - Role-based menus
- **Toast notifications** - User feedback
- **Loading states** - Smooth UX

## 📈 Performance

- **Fast load times** - Optimized bundle size
- **Efficient queries** - Database indexing
- **Caching** - Strategic caching where needed
- **Lazy loading** - Code splitting
- **Gzip compression** - Reduced bandwidth
- **PM2 cluster mode** - Scalable for high traffic

## 🔧 Configuration

### Environment Variables

All configuration is done via `.env` file:

```env
# Server
NODE_ENV=production
PORT=5000
CLIENT_URL=https://yourdomain.com

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trading_platform
DB_USER=tradinguser
DB_PASSWORD=secure_password

# JWT
JWT_SECRET=your_secure_random_string
JWT_EXPIRE=7d

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Admin
MASTER_ADMIN_EMAIL=admin@yourdomain.com
MASTER_ADMIN_PASSWORD=SecurePassword123!
```

## 📝 Logging

Application uses Winston for comprehensive logging:

- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console output in development
- Log rotation (5MB max, 5 files)

## 🧪 Testing Checklist

Before going live:

- [ ] Test all user registration flows
- [ ] Verify authentication & authorization
- [ ] Test Stripe subscription flow
- [ ] Confirm webhook events work
- [ ] Test scanner signal generation
- [ ] Verify trade creation/editing
- [ ] Test all calculators
- [ ] Verify role-based access
- [ ] Test on mobile devices
- [ ] Load test for performance
- [ ] Security audit
- [ ] Backup and restore test

## 🚨 Troubleshooting

**Common Issues:**

1. **Database connection failed**
   - Verify PostgreSQL is running
   - Check credentials in `.env`
   - Ensure database exists

2. **Stripe webhook not working**
   - Use Stripe CLI for local testing
   - Verify webhook secret
   - Check server logs

3. **Frontend not loading**
   - Check if backend is running
   - Verify API URL in client config
   - Clear browser cache

See [SETUP.md](SETUP.md) for detailed troubleshooting.

## 📞 Support & Maintenance

### Regular Maintenance Tasks

- **Daily:** Monitor logs for errors
- **Weekly:** Check database performance
- **Monthly:** Review user analytics
- **Quarterly:** Security updates

### Backup Strategy

- **Database:** Daily automated backups
- **Files:** Version control with Git
- **Retention:** 7 days minimum

## 🎯 Production Checklist

Before launching:

- [ ] SSL certificate installed
- [ ] Domain configured
- [ ] Environment variables set
- [ ] Database optimized
- [ ] Backups configured
- [ ] Monitoring setup (PM2)
- [ ] Stripe live keys configured
- [ ] Webhook endpoints verified
- [ ] Admin credentials changed
- [ ] Security headers enabled
- [ ] Error tracking configured
- [ ] Performance tested
- [ ] Mobile tested
- [ ] Documentation reviewed

## 📄 License

This is proprietary software. All rights reserved.

## 🙏 Credits

Built with modern web technologies and best practices for production deployment.

---

**⚠️ Important Security Notes:**

1. **Always use HTTPS in production**
2. **Change default admin password immediately**
3. **Use strong, unique passwords**
4. **Keep dependencies updated**
5. **Monitor logs regularly**
6. **Enable 2FA for critical accounts**
7. **Regular security audits recommended**

For detailed setup instructions, see [SETUP.md](SETUP.md)
For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md)
