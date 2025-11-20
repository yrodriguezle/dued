import { existsSync, readFile, writeFile } from "fs";
import { networkInterfaces } from "os";

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

const envFile = process.argv[2];

if (!existsSync(envFile)) {
  console.error(`❌ Environment file not found: ${envFile}`);
  process.exit(1);
}

readFile(envFile, "utf8", (err, data) => {
  if (err) {
    console.error("❌ Error reading environment file:", err);
    process.exit(1);
  }

  try {
    // Parse the JSON config
    const config = JSON.parse(data);

    // Get local IP address
    const localIp = getLocalIpAddress();

    // Replace localhost with local IP in all endpoints
    const updatedConfig = {
      ...config,
      API_ENDPOINT: config.API_ENDPOINT.replace("localhost", localIp),
      GRAPHQL_ENDPOINT: config.GRAPHQL_ENDPOINT.replace("localhost", localIp),
      GRAPHQL_WEBSOCKET: config.GRAPHQL_WEBSOCKET.replace("localhost", localIp),
    };

    // Write to public/config.json
    const outputPath = "./public/config.json";
    const jsonOutput = JSON.stringify(updatedConfig, null, 2);

    writeFile(outputPath, jsonOutput, "utf8", (writeErr) => {
      if (writeErr) {
        console.error("❌ Error writing config file:", writeErr);
        process.exit(1);
      }

      console.log("✅ Configuration updated successfully!");
      console.log(`📍 Local IP: ${localIp}`);
      console.log(`📁 Config written to: ${outputPath}`);
      console.log("\nEndpoints configured:");
      console.log(`  API:       ${updatedConfig.API_ENDPOINT}`);
      console.log(`  GraphQL:   ${updatedConfig.GRAPHQL_ENDPOINT}`);
      console.log(`  WebSocket: ${updatedConfig.GRAPHQL_WEBSOCKET}`);

      if (localIp !== "localhost") {
        console.log(`\n📱 You can now access the app from other devices at:`);
        console.log(`   https://${localIp}:4001`);
        console.log(`\n⚠️  Make sure the backend is also listening on ${localIp}:4000`);
      }
    });
  } catch (parseErr) {
    console.error("❌ Error parsing JSON:", parseErr);
    process.exit(1);
  }
});
