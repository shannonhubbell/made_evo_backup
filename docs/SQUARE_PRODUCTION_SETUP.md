# Square Production Setup Guide

## Overview

Square's production environment requires proper OAuth authentication and application setup. The sandbox uses simple access tokens, but production requires a more secure OAuth flow.

## Production Authentication Requirements

### 1. Create a Square Application

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Click "New Application"
3. Fill in application details:
   - Application name
   - Description
   - Website URL
4. **Important**: Note your **Application ID** and **Application Secret**

### 2. OAuth Setup

Square production requires OAuth 2.0 authentication. You have two options:

#### Option A: OAuth Flow (Recommended for Production)

1. **Set up OAuth Redirect URL**:
   - In your Square application settings, add your redirect URL:
     - `https://yourdomain.com/api/square/oauth/callback`
   - Or for local testing: `http://localhost:4321/api/square/oauth/callback`

2. **Get Authorization URL**:
   ```
   https://connect.squareup.com/oauth2/authorize?
     client_id=YOUR_APPLICATION_ID&
     scope=PAYMENTS_WRITE+ORDERS_WRITE+PAYMENTS_READ+ORDERS_READ&
     session=false
   ```

3. **User Authorization**:
   - User clicks the authorization URL
   - User authorizes your application
   - Square redirects to your callback URL with an authorization code

4. **Exchange Code for Access Token**:
   - Your callback endpoint exchanges the code for an access token
   - Store the access token securely (encrypted, environment variable, or secure storage)

#### Option B: Personal Access Token (Development/Testing Only)

For testing in production, you can use a Personal Access Token:

1. Go to Square Developer Dashboard
2. Navigate to your application
3. Go to "Credentials" → "Personal Access Tokens"
4. Create a new token
5. **⚠️ WARNING**: Personal Access Tokens are tied to your personal Square account and should NOT be used in production applications

### 3. Required Scopes

Your Square application needs these OAuth scopes:
- `PAYMENTS_WRITE` - Create payments
- `PAYMENTS_READ` - Read payment information
- `ORDERS_WRITE` - Create orders
- `ORDERS_READ` - Read order information
- `ITEMS_READ` - Read catalog items (for catalog API)

### 4. Environment Variables for Production

Update your `.env` file or hosting platform environment variables:

```bash
# Production Square Credentials
SQUARE_APPLICATION_ID=your_production_app_id
SQUARE_ACCESS_TOKEN=your_production_access_token  # From OAuth flow
SQUARE_LOCATION_ID=your_production_location_id
SQUARE_ENVIRONMENT=production
```

### 5. Location ID

To get your production Location ID:

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Navigate to your application
3. Go to "Locations"
4. Copy the Location ID for your business location

Or use the Locations API:
```bash
curl https://connect.squareup.com/v2/locations \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Current Implementation Status

### What Works Now

✅ **Sandbox Environment**: Fully functional with simple access tokens
✅ **Catalog API**: Works in sandbox
✅ **Checkout API**: Works in sandbox
✅ **Payment Links**: Works in sandbox

### What Needs Updates for Production

⚠️ **OAuth Flow**: Need to implement OAuth callback endpoint
⚠️ **Token Storage**: Need secure token storage mechanism
⚠️ **Token Refresh**: Need to handle token expiration/refresh

## Quick Test Setup (Personal Access Token)

If you just want to test the production API quickly:

1. **Get Personal Access Token**:
   - Square Dashboard → Your App → Credentials → Personal Access Tokens
   - Create new token
   - Copy the token

2. **Get Location ID**:
   - Use the Locations API or Square Dashboard

3. **Update Environment Variables**:
   ```bash
   SQUARE_APPLICATION_ID=your_app_id
   SQUARE_ACCESS_TOKEN=your_personal_access_token
   SQUARE_LOCATION_ID=your_location_id
   SQUARE_ENVIRONMENT=production
   ```

4. **Test**:
   - The catalog and checkout APIs should work
   - ⚠️ Remember: This is for testing only, not production use

## Production Deployment Checklist

- [ ] Create Square Application in production
- [ ] Set up OAuth redirect URLs
- [ ] Implement OAuth callback endpoint (`/api/square/oauth/callback`)
- [ ] Set up secure token storage (encrypted database, secure env vars, etc.)
- [ ] Implement token refresh logic
- [ ] Update environment variables on hosting platform
- [ ] Test payment flow with small amounts
- [ ] Set up webhooks for payment notifications (optional but recommended)
- [ ] Configure error monitoring and logging

## Error: UNAUTHORIZED

If you're getting `UNAUTHORIZED` errors in production:

1. **Check Access Token**:
   - Is it a production token (not sandbox)?
   - Is it still valid (not expired)?
   - Does it have the right scopes?

2. **Check Application ID**:
   - Is it the production application ID?
   - Does it match the access token's application?

3. **Check Location ID**:
   - Is it a production location ID?
   - Does your access token have access to this location?

4. **Check API Version**:
   - Ensure you're using a supported API version
   - Current: `2024-01-18`

## Next Steps

1. **For Testing**: Use Personal Access Token (quick but not for production)
2. **For Production**: Implement full OAuth flow with secure token storage
3. **For Webhooks**: Set up webhook endpoints to receive payment notifications

## Resources

- [Square OAuth Documentation](https://developer.squareup.com/docs/oauth-api/overview)
- [Square API Reference](https://developer.squareup.com/reference/square)
- [Square Developer Dashboard](https://developer.squareup.com/apps)

