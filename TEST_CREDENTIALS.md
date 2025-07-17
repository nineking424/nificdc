# Test Credentials for NiFiCDC Application

## Available Test Accounts

The following test accounts are available for testing the NiFiCDC application:

### 1. Administrator Account
- **Email**: `admin@nificdc.local`
- **Password**: `admin123`
- **Role**: Admin
- **Permissions**: Full system access

### 2. Regular User Account
- **Email**: `user@nificdc.local`
- **Password**: `user123`
- **Role**: User
- **Permissions**: Standard user access

### 3. Demo Account
- **Email**: `demo@nificdc.local`
- **Password**: `demo123`
- **Role**: User
- **Permissions**: Standard user access

## Testing Instructions

1. **Start the application servers**:
   ```bash
   # Frontend (runs on port 8080)
   cd frontend && npm run serve
   
   # Backend (runs on port 3000)
   cd backend && NODE_ENV=development node src/index.js
   ```

2. **Access the application**:
   - Open browser to: `http://localhost:8080`
   - Click "탐색하기" (Explore) to go to login page
   - Use any of the test credentials above

3. **Test Features**:
   - Login/logout functionality
   - Navigation between pages
   - Mapping management
   - Schema discovery
   - User interface responsiveness

## Notes

- If login fails with CORS errors, ensure the backend is running with `NODE_ENV=development`
- The backend must be started from `src/index.js` (not `server.js`) for proper CORS configuration
- Test accounts are automatically created when the database is properly initialized