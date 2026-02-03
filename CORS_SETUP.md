# CORS Configuration Guide

## Overview
This document outlines the CORS (Cross-Origin Resource Sharing) configuration for the System-100 trading platform. All frontend-to-backend communication is secured with production-grade CORS policies.

## Current Configuration

### Backend (server/index.js)
- **Supported Methods**: GET, POST, PUT, DELETE, PATCH, OPTIONS
- **Allowed Headers**: Content-Type, Authorization, X-Requested-With
- **Credentials**: Enabled
- **Max Age**: 86400 seconds (24 hours)

### Allowed Origins

#### Development
- http://localhost:3000
- http://localhost:5173
- http://127.0.0.1:3000
- http://127.0.0.1:5173
- https://localhost:3000
- https://localhost:5173

#### Production
- https://trading-system-bx14.onrender.com
- https://system-100-frontend.onrender.com
- Any URL set in `FRONTEND_URL` environment variable

## Environment Variables Required

### Backend (.env)
```bash
# For production, set the exact frontend URL
FRONTEND_URL=https://your-frontend-url.onrender.com
CLIENT_URL=http://localhost:3000
NODE_ENV=production
```

### Frontend (.env)
```bash
# For development
VITE_API_URL=http://localhost:5000/api

# For production
VITE_API_URL=https://system-100-backend.onrender.com/api
```

## Render Deployment Setup

### Backend Environment Variables (Render Dashboard)
1. Go to Backend Service → Environment
2. Set these variables:
```
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.onrender.com
CLIENT_URL=https://your-frontend-url.onrender.com
```

### Frontend Environment Variables (Render Dashboard)
1. Go to Static Site → Environment
2. Set these variables:
```
VITE_API_URL=https://system-100-backend.onrender.com/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
```

## Troubleshooting CORS Errors

### Error: "No 'Access-Control-Allow-Origin' header"
**Cause**: Frontend origin not in allowed list
**Solution**:
1. Check your frontend URL
2. Add it to backend `FRONTEND_URL` environment variable
3. Restart backend service

### Error: "OPTIONS request returns 404"
**Cause**: CORS preflight failing
**Solution**:
1. Ensure backend is running
2. Verify origin matches exactly (including protocol and port)
3. Check browser console for actual origin being sent

### Error: "401 Unauthorized"
**Cause**: Token not being sent
**Solution**:
1. Verify token is in localStorage
2. Check Authorization header in request
3. Verify JWT_SECRET matches

## Testing CORS Locally

```bash
# Test preflight request
curl -X OPTIONS http://localhost:5000/api/auth/login \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Test actual request
curl -X POST http://localhost:5000/api/auth/login \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -v
```

## Security Notes

1. **Production Only**: Never use NODE_ENV=development in production
2. **Specific Origins**: List specific frontend URLs, don't use wildcards
3. **HTTPS**: Always use HTTPS in production
4. **Credentials**: Enabled to support authentication cookies
5. **Logging**: All CORS rejections are logged for security monitoring

## Adding New Frontend URLs

When deploying to new domains:

1. Update backend environment variable:
   ```
   FRONTEND_URL=https://new-frontend.com
   ```

2. Or hardcode in server/index.js origins array if needed

3. Restart backend service

## Support
For CORS issues, check:
1. Browser console for exact error message
2. Backend logs: `Render Dashboard → Logs`
3. Network tab in browser DevTools
4. Exact origin being sent (case-sensitive, includes protocol and port)
