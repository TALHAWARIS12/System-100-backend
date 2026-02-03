# Quick Start Guide - System-100

## ✅ Current Status

**Frontend:** ✅ Running on http://localhost:3000  
**Backend:** ❌ Waiting for PostgreSQL database

## 🎯 What You Need to Do

### Option 1: Install PostgreSQL (Recommended for Full Functionality)

#### Windows Installation:

1. **Download PostgreSQL:**
   ```
   https://www.postgresql.org/download/windows/
   ```
   Download and install PostgreSQL 14 or higher

2. **During installation:**
   - Remember your postgres user password
   - Keep default port (5432)
   - Install pgAdmin (optional GUI tool)

3. **Create the database:**
   ```powershell
   # Open Command Prompt or PowerShell
   psql -U postgres
   
   # At the postgres prompt:
   CREATE DATABASE trading_platform;
   \q
   ```

4. **Update your `.env` file:**
   ```env
   DB_PASSWORD=your_actual_postgres_password
   ```

5. **Restart the server:**
   The backend will automatically restart and connect to the database!

### Option 2: Use Free Cloud PostgreSQL (No Local Install)

#### ElephantSQL (Free Tier):

1. Go to https://www.elephantsql.com/
2. Sign up for free account
3. Create new instance (Tiny Turtle - Free)
4. Copy the connection URL

5. **Update `.env` file:**
   ```env
   # Replace with your ElephantSQL details
   DB_HOST=your-instance.db.elephantsql.com
   DB_PORT=5432
   DB_NAME=your_db_name
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   ```

#### Supabase (Free Tier):

1. Go to https://supabase.com/
2. Create new project
3. Get PostgreSQL connection details from Settings > Database

4. **Update `.env` file with Supabase details**

### Option 3: Test Frontend Only (No Backend Required)

The frontend is already running! You can:
- View the UI at http://localhost:3000
- See the login page
- Explore the interface
- Note: Features requiring backend won't work yet

## 🚀 After Database Setup

Once PostgreSQL is configured:

1. **Backend will auto-start** (nodemon watches for changes)
2. **Database tables created automatically**
3. **Master admin account created:**
   - Email: `admin@tradingplatform.com`
   - Password: `ChangeThisPassword123!`
4. **Default scanner strategies loaded**

## 🔍 Verify Everything Works

### Test Backend:
```powershell
# Should return 404 (server is running)
curl http://localhost:5000
```

### Test Database:
```powershell
# Check logs for "Database connection established"
# Look in terminal output or logs/combined.log
```

### Test Frontend:
1. Go to http://localhost:3000
2. Click "Sign In"
3. Should see login form

### Full Test:
1. Login with admin credentials
2. Dashboard should load
3. Check Scanner, Trades, Calculators

## 📋 Current Configuration

Your `.env` file is set to:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trading_platform
DB_USER=postgres
DB_PASSWORD=postgres  # ⚠️ UPDATE THIS
```

## 🐛 Troubleshooting

### Backend Not Starting?
- Check PostgreSQL is running: `pg_isready` (Windows: check Services)
- Verify password in `.env` matches your PostgreSQL password
- Check logs in `logs/error.log`

### Frontend Not Loading?
- Clear browser cache
- Check http://localhost:3000 (not https)
- Verify port 3000 is not in use

### Port Already in Use?
```powershell
# Stop the process using port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Or change port in .env:
PORT=5001
```

## 📞 Need Help?

See full documentation:
- [SETUP.md](SETUP.md) - Complete development setup
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
- [README.md](README.md) - Project overview

## 🎉 Quick Commands

```powershell
# Start both servers
npm run dev

# Start backend only
npm run server:dev

# Start frontend only
npm run client:dev

# Install dependencies
npm install

# Check backend logs
Get-Content logs/combined.log -Tail 50
```

## ✨ What's Next?

Once backend is running:
1. Login as admin
2. Create educator accounts
3. Create test trades
4. Test scanner functionality
5. Try the calculators
6. Set up Stripe for subscriptions (see SETUP.md)

---

**Current Status:** Frontend ✅ | Backend waiting for PostgreSQL ⏳
