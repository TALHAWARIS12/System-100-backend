# TWELVE_DATA API Key - Permanent System Data Source Setup

## Problem Fixed
- API key applied in settings page was disappearing when site closed
- Data sources were not persistent in database
- No way to set permanent data sources for all accounts

## Solution Implemented

### 1. **Database Model Update** - `server/models/DataSource.js`
Added `isSystem` boolean field to mark data sources as permanent system-level resources:
- `isSystem: true` = Cannot be deleted by users or admins
- Default: `false` (normal user-created data sources)

### 2. **Backend Protection** - `server/controllers/dataSourceController.js`
Updated `deleteDataSource` controller to prevent deletion of system data sources:
- Returns 403 Forbidden if user tries to delete a system data source
- Error message: "System data sources cannot be deleted"

### 3. **System Data Source Initialization** - `server/utils/initDatabase.js`
Created new `initializeSystemDataSources()` function that:
- Creates/updates the TWELVE_DATA system data source on every server startup
- API Key: `442090d2ledd439e8600blf0dcfbab9a`
- Priority: 0 (highest priority for queries)
- Rate Limit: 800 calls/day
- Status: Always active
- Marked as: `isSystem: true` (non-removeable)

The function is called during database initialization, ensuring the data source always exists even if someone tries to delete it.

### 4. **Frontend UI Updates** - `client/src/pages/admin/DataSources.jsx`
- Added "System" badge to system data sources
- Hide delete button for system data sources
- Show message: "System data source (cannot delete)"
- Updated error handling to display backend error messages

## How It Works Now

### For New Users
When a new user registers:
1. Server starts and runs `initDatabase()`
2. `initializeSystemDataSources()` creates TWELVE_DATA entry
3. User immediately has access to the API on their first login

### For Existing Users
On server restart:
1. Function checks if TWELVE_DATA exists with `isSystem: true`
2. If not found, creates it
3. If found, updates the API key (ensures latest key is always in use)
4. Data is persisted in database - won't disappear on page close

### Permanent & Protected
- ✅ Persisted in database (won't disappear on close)
- ✅ Visible to all users (global data source)
- ✅ Cannot be deleted by admins
- ✅ Cannot be removed by users
- ✅ Automatically recreated on server startup if deleted
- ✅ Auto-updated API key on each startup

## Files Modified

1. **server/models/DataSource.js** - Added `isSystem` field
2. **server/controllers/dataSourceController.js** - Added system data source protection
3. **server/utils/initDatabase.js** - Added initialization function
4. **client/src/pages/admin/DataSources.jsx** - Updated UI to show/hide system badges

## Optional: Run Initialization Script

If you want to manually run the initialization script:
```bash
node scripts/init-system-datasources.js
```

This will:
- Create TWELVE_DATA if it doesn't exist
- Update the API key if needed
- Log the results

## Testing the Setup

1. **Verify Data Source Created:**
   - Go to Admin > Data Sources
   - Look for "TWELVE_DATA" with "System" badge
   - Should show active status and 800 call/day limit

2. **Verify Persistence:**
   - Close the browser/site
   - Log back in
   - Data source should still be there

3. **Verify Protection:**
   - Try to delete TWELVE_DATA
   - Should show error: "System data sources cannot be deleted"

4. **Test API Connection:**
   - Click "Test Connection" on TWELVE_DATA
   - Should succeed with latency info

## Result

✅ TWELVE_DATA API is now:
- Permanently stored in database
- Automatically created for all accounts
- Protected from accidental/intentional deletion
- Available to all users who authenticate
- Auto-initialized on every server startup
