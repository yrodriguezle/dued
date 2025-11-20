# 🚀 Quick Start - Environment Setup

## Test on your phone/tablet

```bash
# 1. Run environment setup (auto-detects your IP)
npm run env:development

# 2. Start frontend
npm run dev

# 3. Open on your device
# The script will show you the URL, e.g.:
# https://192.168.1.185:4001
```

## Example Output

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

## Full Documentation

See [ENV_SETUP.md](./ENV_SETUP.md) for:
- Troubleshooting
- Backend configuration
- Manual IP configuration
- Production setup
- CORS configuration

---

**Note**: Your device must be on the same Wi-Fi network!
