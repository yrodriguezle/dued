# Environment Configuration Guide

## Quick Start

### Development (with auto-detected IP)

```bash
npm run env:development
```

This automatically:
1. 🔍 Detects your local network IP (e.g., 192.168.1.185)
2. 📝 Updates `public/config.json` with your IP
3. ✅ Makes your app accessible from other devices on the same network

### Staging

```bash
npm run env:staging
```

Uses the configuration from `.env.staging`.

---

## How It Works

The `env.js` script:

1. **Reads** the environment file (`.env.development` or `.env.staging`)
2. **Detects** your local IP address automatically
3. **Replaces** `localhost` with your IP in all endpoints
4. **Writes** the result to `public/config.json`

### Example Output

```
✅ Configuration updated successfully!
📍 Local IP: 192.168.1.185
📁 Config written to: ./public/config.json

Endpoints configured:
  API:       https://192.168.1.185:4000
  GraphQL:   https://192.168.1.185:4000/graphql
  WebSocket: wss://192.168.1.185:4000/graphql

📱 You can now access the app from other devices at:
   https://192.168.1.185:4001

⚠️  Make sure the backend is also listening on 192.168.1.185:4000
```

---

## Environment Files

### `.env.development`

Default configuration for local development:

```json
{
  "API_ENDPOINT": "https://localhost:4000",
  "GRAPHQL_ENDPOINT": "https://localhost:4000/graphql",
  "GRAPHQL_WEBSOCKET": "wss://localhost:4000/graphql",
  "COPYRIGHT": "Copyright © 2025 Powered by iansoft"
}
```

**Note**: Keep `localhost` in this file. The script will automatically replace it with your IP.

### `.env.staging`

Configuration for staging environment. Create this file if you need a different staging setup.

---

## Testing on Mobile/Tablet

### Prerequisites

1. **Same Network**: Your device must be on the same Wi-Fi network as your computer
2. **Backend Running**: Make sure the backend is accessible on your network IP

### Steps

1. Run the environment setup:
   ```bash
   npm run env:development
   ```

2. Note the IP address shown (e.g., `192.168.1.185`)

3. Start the frontend:
   ```bash
   npm run dev
   ```

4. On your mobile device, navigate to:
   ```
   https://192.168.1.185:4001
   ```

5. **Accept the self-signed certificate warning** (development only)

### Backend Configuration

Make sure your backend is configured to listen on all interfaces or your specific IP:

**Option 1: Listen on all interfaces**
```json
// backend appsettings.json or launchSettings.json
{
  "urls": "https://0.0.0.0:4000"
}
```

**Option 2: Listen on specific IP**
```json
{
  "urls": "https://192.168.1.185:4000"
}
```

---

## Troubleshooting

### Issue: "Cannot detect IP" or shows "localhost"

**Solution**: Your computer might not be connected to a network, or the network interface is not standard.

Manually set your IP in `.env.development`:
```json
{
  "API_ENDPOINT": "https://192.168.1.185:4000",
  ...
}
```

Then run:
```bash
npm run env:development
```

---

### Issue: "Connection refused" from mobile device

**Causes**:
1. Backend not listening on network IP
2. Firewall blocking connections
3. Wrong IP address

**Solutions**:

1. **Check backend is accessible**:
   ```bash
   curl -k https://192.168.1.185:4000/api/auth
   ```

2. **Check firewall** (macOS):
   ```bash
   # Allow incoming connections on port 4000
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /path/to/backend
   ```

3. **Verify IP address**:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

---

### Issue: "Certificate not trusted" on mobile

This is normal for development with self-signed certificates.

**Solutions**:

1. **Accept the warning**: Most browsers allow you to proceed anyway
2. **Install development certificate** on your mobile device (advanced)
3. **Use HTTP instead of HTTPS** for development (less secure):
   - Change `.env.development` to use `http://` instead of `https://`
   - Change backend to use HTTP

---

### Issue: CORS error from network IP

**Good news**: The backend CORS is already configured to accept any local network IP in development mode!

It automatically allows:
- `localhost` on any port
- `192.168.x.x` (home networks)
- `10.x.x.x` (corporate networks)

If you still see CORS errors:

1. **Check the backend is running in Development mode**:
   ```bash
   # Make sure ASPNETCORE_ENVIRONMENT=Development (default for dotnet run)
   dotnet run
   ```

2. **Verify the error is actually CORS** (check browser console)

3. **Try HTTP instead of HTTPS** for testing (change `.env.development` to use `http://`)

---

## Network IP Detection Logic

The script detects your IP by:

1. Getting all network interfaces
2. Filtering for IPv4 addresses
3. Excluding loopback (127.0.0.1)
4. Preferring private network ranges:
   - `192.168.x.x` (most common home networks)
   - `10.x.x.x` (corporate networks)

If no network IP is found, it falls back to `localhost`.

---

## Manual Configuration

If automatic IP detection doesn't work or you need custom configuration:

1. **Copy the example file**:
   ```bash
   cp .env.example .env.custom
   ```

2. **Edit with your settings**:
   ```json
   {
     "API_ENDPOINT": "https://your-ip-here:4000",
     "GRAPHQL_ENDPOINT": "https://your-ip-here:4000/graphql",
     "GRAPHQL_WEBSOCKET": "wss://your-ip-here:4000/graphql",
     "COPYRIGHT": "Copyright © 2025 Powered by iansoft"
   }
   ```

3. **Run with your custom file**:
   ```bash
   node env .env.custom
   ```

---

## Production Deployment

For production, create a `.env.production` file with your production domain:

```json
{
  "API_ENDPOINT": "https://api.duedgusto.com",
  "GRAPHQL_ENDPOINT": "https://api.duedgusto.com/graphql",
  "GRAPHQL_WEBSOCKET": "wss://api.duedgusto.com/graphql",
  "COPYRIGHT": "Copyright © 2025 Powered by iansoft"
}
```

Then build:
```bash
npm run env:production  # Add this script to package.json if needed
npm run build
```

---

## Tips

- 💡 **Run the env script before `npm run dev`** to ensure latest IP is used
- 💡 **Restart the dev server** after running the env script
- 💡 **Check your IP hasn't changed** if connection fails (DHCP networks)
- 💡 **Use static IP** on your development machine for consistency

---

## See Also

- [CLAUDE.md](./CLAUDE.md) - Project architecture and conventions
- [package.json](./package.json) - Available npm scripts
