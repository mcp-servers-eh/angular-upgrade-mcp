import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { analyzeTool, handleAnalyzeProject } from "./tools/analyze.tool.js";
import { handleScaffoldProject, scaffoldTool } from "./tools/scaffold.tool.js";

export async function createServer() {

    const server = new McpServer(
        { name: "mcp-angular-migrator", version: "0.1.0" },
        { capabilities: { tools: {} } }
    );

    const AnalyzeInput = z.object(analyzeTool.inputSchema).strict();
    server.registerTool(analyzeTool.name,
        {
            title: analyzeTool.title,
            description: analyzeTool.description,
            inputSchema: analyzeTool.inputSchema,
        },
        async (args: z.infer<typeof AnalyzeInput>, _extra: unknown) =>
            await handleAnalyzeProject(args as any) as any
    );

    const ScaffoldInput = z.object(scaffoldTool.inputSchema).strict();
    server.registerTool(scaffoldTool.name,
        {
            title: scaffoldTool.title,
            description: scaffoldTool.description,
            inputSchema: scaffoldTool.inputSchema,
        },
        async (args: z.infer<typeof ScaffoldInput>, _extra: unknown) =>
            await handleScaffoldProject(args as any) as any
    );

    return server;
}
