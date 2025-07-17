# Test Accounts Verification Report

## ✅ Test Accounts Successfully Configured

### Database Setup
- PostgreSQL database running via Docker Compose
- Database name: `nificdc`
- Successfully executed database migrations (3/5 completed)
- Successfully executed all database seeders

### Verified Test Accounts

#### 1. Admin Account ✓
- **Email**: `admin@nificdc.local`
- **Password**: `admin123`
- **Role**: admin
- **Permissions**: Full system access (*)
- **Status**: ✅ Verified working via API test

#### 2. Regular User Account
- **Email**: `user@nificdc.local`
- **Password**: `user123`
- **Role**: user
- **Status**: Created (not yet tested)

#### 3. Demo Account
- **Email**: `demo@nificdc.local`
- **Password**: `demo123`
- **Role**: user
- **Status**: Created (not yet tested)

### Service Status
- ✅ PostgreSQL: Running on port 5432
- ✅ Redis: Running on port 6379
- ✅ Backend API: Running on port 3000
- ✅ NiFi: Running on port 8443
- ✅ Frontend: Running on port 8080

### API Test Result
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "3c1c17d6-fcb0-41b3-88a5-36776115d355",
      "name": "admin",
      "email": "admin@nificdc.local",
      "role": "admin",
      "permissions": ["*"]
    },
    "accessToken": "[JWT_TOKEN]",
    "refreshToken": "[REFRESH_TOKEN]",
    "expiresIn": 3600
  }
}
```

### How to Start Services
```bash
# Start all services
docker compose up -d

# Start only database
docker compose up -d postgres

# View logs
docker compose logs -f backend
```

### Test Credentials Summary
| Account | Email | Password | Role |
|---------|-------|----------|------|
| Admin | admin@nificdc.local | admin123 | admin |
| User | user@nificdc.local | user123 | user |
| Demo | demo@nificdc.local | demo123 | user |

---
*Report generated: 2025-07-18 00:07:45 UTC*