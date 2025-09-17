import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { analyzeTool } from "./tools/analyze.tool.js";
import { handleAnalyze } from "./tools/analyze.tool.js";

export async function createServer() {

    const server = new McpServer(
        {
            name: "mcp-angular-migrator",
            version: "0.1.0"
        },
        {
            capabilities: {
                tools: {}
            }
        }
    );

    server.registerTool(
        analyzeTool.name,
        {
            title: analyzeTool.title,
            description: analyzeTool.description,
            inputSchema: analyzeTool.inputSchema as any
        },
        async (args: any) => await handleAnalyze(args as any) as any
    );

    return server;
}