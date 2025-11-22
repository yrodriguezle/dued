#!/usr/bin/env node
import { writeFileSync } from "fs";
import { networkInterfaces } from "os";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Gets the local IP address (192.168.x.x or 10.x.x.x)
 * Useful for testing on other devices in the same network
 */
function getLocalIpAddress() {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      const isIPv4 = net.family === "IPv4";
      const isInternal = net.internal;

      if (isIPv4 && !isInternal) {
        // Prefer private network addresses (192.168.x.x or 10.x.x.x)
        if (net.address.startsWith("192.168.") || net.address.startsWith("10.")) {
          return net.address;
        }
      }
    }
  }

  // Fallback to localhost if no network IP found
  return "localhost";
}

const localIp = getLocalIpAddress();
const backendPort = 4000;
const frontendPort = 4001;

console.log("🔧 Setting up development environment...\n");
console.log(`📍 Local IP detected: ${localIp}`);

// Update frontend config.json
const frontendConfig = {
  API_ENDPOINT: `https://${localIp}:${backendPort}`,
  GRAPHQL_ENDPOINT: `https://${localIp}:${backendPort}/graphql`,
  GRAPHQL_WEBSOCKET: `wss://${localIp}:${backendPort}/graphql`,
  COPYRIGHT: "Copyright © 2025 Powered by iansoft"
};

const frontendConfigPath = join(__dirname, "duedgusto", "public", "config.json");
writeFileSync(frontendConfigPath, JSON.stringify(frontendConfig, null, 2), "utf8");

console.log("\n✅ Frontend configuration updated!");
console.log(`📁 File: ${frontendConfigPath}`);
console.log(`   API Endpoint:  ${frontendConfig.API_ENDPOINT}`);
console.log(`   GraphQL:       ${frontendConfig.GRAPHQL_ENDPOINT}`);
console.log(`   WebSocket:     ${frontendConfig.GRAPHQL_WEBSOCKET}`);

// Backend launchSettings.json already uses 0.0.0.0 which listens on all interfaces
// We just need to inform the user
console.log("\n✅ Backend configuration:");
console.log(`   Backend is already configured to listen on all interfaces (0.0.0.0:${backendPort})`);
console.log(`   No changes needed to launchSettings.json`);

if (localIp !== "localhost") {
  console.log(`\n📱 Access your application from any device on the network:`);
  console.log(`   Frontend: http://${localIp}:${frontendPort}`);
  console.log(`   Backend:  https://${localIp}:${backendPort}`);
  console.log(`\n🚀 Next steps:`);
  console.log(`   1. Start backend:  cd backend && dotnet run`);
  console.log(`   2. Start frontend: cd duedgusto && npm run dev`);
  console.log(`   3. Open browser:   http://${localIp}:${frontendPort}`);
} else {
  console.log(`\n⚠️  No network IP found, using localhost`);
  console.log(`   You can only access the app from this machine`);
}

console.log("\n✨ Setup complete!\n");
