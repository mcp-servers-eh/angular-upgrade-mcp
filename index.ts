import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./src/server.js";

async function main() {
    const server = await createServer();
    
    // Start the server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.log("🚀 Angular Upgrade MCP server running (waiting for Cursor to connect)...");
}

main().catch((err) => {
    console.error("Failed to start MCP server:", err);
    process.exit(1);
});
