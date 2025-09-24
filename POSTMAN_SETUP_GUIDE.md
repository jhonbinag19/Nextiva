# 🚀 Postman Setup Guide - Nextiva Thrio API Vercel

## ✅ Quick Start (30 seconds)

1. **Import the FIXED collection**:
   - Download: `Nextiva-Thrio-API-Vercel-FIXED.postman_collection.json`
   - In Postman: **Import** → **Upload Files** → Select the file

2. **Import the environment**:
   - Download: `Nextiva-Thrio-API-Vercel-Environment.postman_environment.json`
   - In Postman: **Import** → **Upload Files** → Select the file

3. **Select the environment**:
   - In Postman top-right dropdown, select "Nextiva-Thrio-API-Vercel-Environment"

4. **Test immediately**:
   - Click on "✅ Demo Credentials (Working)"
   - Hit **Send**
   - You should see: ✅ Status 200, authMode: demo_hardcoded, isDemo: true

## 🔍 Why "Missing Credentials" Error Happened

The original collection expected this response structure:
```json
{
  "authMode": "demo_hardcoded",
  "isDemoToken": true,
  "data": {
    "user": {
      "thrioToken": "demo-access-token-..."
    }
  }
}
```

But the actual API returns:
```json
{
  "success": true,
  "message": "Authentication successful",
  "authMode": "demo_hardcoded",
  "isDemo": true,
  "user": {
    "thrioToken": "demo-access-token-..."
  }
}
```

## 🎯 FIXED Collection Features

- ✅ **Matches actual API response structure**
- ✅ **Proper test assertions** for the real response format
- ✅ **Working demo credentials** (demo@thrio.com / demo123)
- ✅ **Environment variables** for easy configuration
- ✅ **Clear success/failure indicators** in test names

## 📋 Available Tests

1. **✅ Demo Credentials (Working)** - Start here!
   - Uses: `demo@thrio.com` / `demo123`
   - Expected: ✅ 200 status, demo_hardcoded mode

2. **🔑 Alternative Demo Credentials** 
   - Uses: `nextiva+wisechoiceremodeling@wisechoiceremodel.com` / `GHLwiseChoiceAPI2025!!`
   - Expected: ✅ 200 status, demo_hardcoded mode

3. **🌟 Real Credentials Test**
   - Uses your real credentials (set in environment)
   - Expected: ✅ 200 status, real_api mode

4. **🔍 Test Token Usage**
   - Tests if the generated token works
   - Uses token from successful authentication

5. **⚡ Quick Health Check**
   - Verifies Vercel deployment is accessible
   - No authentication required

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `baseUrl` | `https://nextivaapp.vercel.app` | API base URL |
| `demo_username` | `demo@thrio.com` | Demo username |
| `demo_password` | `demo123` | Demo password |
| `real_username` | `your_real_username_here` | Your real username |
| `real_password` | `your_real_password_here` | Your real password |

## 🚨 Troubleshooting

### Still getting errors?

1. **Check environment is selected**:
   - Look at top-right of Postman
   - Should show "Nextiva-Thrio-API-Vercel-Environment"

2. **Verify the collection**:
   - Check you imported the **FIXED** collection (not the original)
   - Look for "✅" symbols in test names

3. **Test with curl first**:
   ```bash
   curl -X POST https://nextivaapp.vercel.app/api/auth/validate \
     -H "Content-Type: application/json" \
     -d '{"username":"demo@thrio.com","password":"demo123"}'
   ```

4. **Check Postman console**:
   - View → Show Postman Console
   - Look for detailed error messages

## 🎉 Success Indicators

When working correctly, you'll see:
- ✅ Status: 200 OK
- ✅ Response time: ~200-500ms
- ✅ Body contains: `authMode: "demo_hardcoded"`
- ✅ Body contains: `isDemo: true`
- ✅ Body contains: `user.thrioToken: "demo-access-token-..."`

## 📞 Need Help?

1. Run the test script: `node postman-final-test.js`
2. Check the debug script: `node postman-debug.js`
3. Verify Vercel deployment: Visit `https://nextivaapp.vercel.app`

---

**✨ Ready to test? Import the files above and start with "✅ Demo Credentials (Working)"!**