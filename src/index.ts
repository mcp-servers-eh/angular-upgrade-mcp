import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { analyzeTool, handleAnalyze } from "./tools/analyze.tool.js";
import { handleScaffoldProject, scaffoldTool } from "./tools/scaffold.tool.js";
import { handleMigrateAssets, migrateAssetsTool } from "./tools/migrate_assets.tool.js";


const server = new McpServer({ name: "angular-migrator", version: "0.1.0" });

// Register analyze tool using exported metadata/handler (keeps index.ts clean)
server.registerTool(
    analyzeTool.name,
    {
        title: analyzeTool.title,
        description: analyzeTool.description,
        inputSchema: analyzeTool.inputSchema as any
    },
    async (args: any) => await handleAnalyze(args as any) as any
);

server.registerTool(
    scaffoldTool.name,
    {
        title: scaffoldTool.title,
        description: scaffoldTool.description,
        inputSchema: scaffoldTool.inputSchema as any
    },
    async (args: any) => await handleScaffoldProject(args as any) as any
);

server.registerTool(
    migrateAssetsTool.name,
    {
        title: migrateAssetsTool.title,
        description: migrateAssetsTool.description,
        inputSchema: migrateAssetsTool.inputSchema as any
    },
    async (args: any) => await handleMigrateAssets(args as any) as any
);


async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[analyze] MCP server running (stdio)"); // stderr only for human logs
}


main().catch((e) => { console.error(e); process.exit(1); });