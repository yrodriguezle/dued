# Security Configuration Guide

## Environment Variables

This application requires the following environment variables for secure operation:

### Required Variables

#### JWT_SECRET_KEY
- **Purpose**: Secret key for signing JWT tokens
- **Format**: Base64 string, minimum 256 bits (32 bytes)
- **Generate**:
  ```bash
  openssl rand -base64 32
  ```
- **Set**:
  ```bash
  export JWT_SECRET_KEY='your-generated-key-here'
  ```

#### SUPERADMIN_PASSWORD
- **Purpose**: Initial password for the superadmin account
- **Requirements**:
  - Minimum 8 characters
  - Include uppercase, lowercase, numbers, and special characters
  - Do NOT use the default password from git history
- **Set**:
  ```bash
  export SUPERADMIN_PASSWORD='YourSecurePassword123!'
  ```

### Optional Variables

#### DB_CONNECTION_STRING
- **Purpose**: Database connection string (defaults to appsettings.json)
- **Format**: `server=host;database=name;user=username;password=password`

---

## Security Improvements Applied

### 1. SQL Injection Prevention
- Removed raw SQL queries in GraphQL pagination
- All database queries now use LINQ (parameterized)

### 2. Rate Limiting
- **Login endpoint**: Max 5 attempts per 15 minutes per IP
- **Refresh endpoint**: Max 10 attempts per 1 minute per IP
- Automatic 429 response with Retry-After header

### 3. Account Enumeration Prevention
- Constant-time password verification (dummy hash for non-existent users)
- Random delay (50-200ms) on all login attempts
- Generic error messages

### 4. Account Management
- Disabled accounts cannot authenticate
- Disabled check on both login and token refresh

### 5. Refresh Token Security
- Server-side expiration (7 days)
- Automatic cleanup on refresh
- Validation on every use
- Stored in httpOnly cookies

### 6. CORS Configuration
- Whitelisted origins only (no wildcard)
- Development: localhost:4001, 192.168.1.185:4001
- Production: Update with your actual domain

### 7. Credentials Management
- No hardcoded passwords in source code
- JWT key from environment variable
- Superadmin password from environment variable

---

## First-Time Setup

1. **Copy environment template**:
   ```bash
   cp .env.example .env
   ```

2. **Generate JWT secret**:
   ```bash
   openssl rand -base64 32
   ```
   Add result to `.env` file as `JWT_SECRET_KEY`

3. **Set superadmin password**:
   Edit `.env` and set `SUPERADMIN_PASSWORD` to a strong password

4. **Load environment variables**:
   ```bash
   source .env
   # OR on Windows:
   # set JWT_SECRET_KEY=...
   # set SUPERADMIN_PASSWORD=...
   ```

5. **Run application**:
   ```bash
   dotnet run
   ```

---

## Production Deployment

### Azure App Service
Set environment variables in Configuration > Application settings:
- `JWT_SECRET_KEY`
- `SUPERADMIN_PASSWORD`

### Docker
Pass environment variables in docker-compose.yml:
```yaml
services:
  api:
    environment:
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - SUPERADMIN_PASSWORD=${SUPERADMIN_PASSWORD}
```

### Kubernetes
Create a Secret:
```bash
kubectl create secret generic duedgusto-secrets \
  --from-literal=JWT_SECRET_KEY='your-key' \
  --from-literal=SUPERADMIN_PASSWORD='your-password'
```

---

## .gitignore

Ensure these files are in `.gitignore`:
```
.env
appsettings.Production.json
*.user
```

---

## Security Checklist

- [ ] JWT_SECRET_KEY is set and unique (not the default)
- [ ] SUPERADMIN_PASSWORD is strong and changed from default
- [ ] Database credentials are not in git
- [ ] HTTPS is enforced in production
- [ ] CORS origins are whitelisted (no wildcard)
- [ ] Rate limiting is enabled
- [ ] .env file is in .gitignore
- [ ] Production secrets are in secure vault (Azure Key Vault, AWS Secrets Manager, etc.)

---

## Testing Security

### Rate Limiting Test
```bash
# Should block after 5 attempts in 15 minutes
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
done
```

### CORS Test
```bash
# Should fail from unauthorized origin
curl -X POST http://localhost:4000/api/auth/signin \
  -H "Origin: http://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"test"}'
```

### Account Enumeration Test
```bash
# Response times should be similar for valid and invalid users
time curl -X POST http://localhost:4000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"wrong"}'

time curl -X POST http://localhost:4000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"username":"nonexistent","password":"wrong"}'
```

---

## Contact

For security issues, please report to: security@duedgusto.com (update with actual contact)
