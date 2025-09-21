import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { analyzeTool, handleAnalyzeProject } from "./tools/analyze.tool.js";
import { handleScaffoldProject, scaffoldTool } from "./tools/scaffold.tool.js";
import { handleMigrateAssets, migrateAssetsTool } from "./tools/migrate_assets.tool.js";
import { handleMigrateComponent, migrateComponentTool } from "./tools/migrate_component.tool.js";

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

    const MigrateAssetsInput = z.object(migrateAssetsTool.inputSchema).strict();
    server.registerTool(migrateAssetsTool.name,
        {
            title: migrateAssetsTool.title,
            description: migrateAssetsTool.description,
            inputSchema: migrateAssetsTool.inputSchema,
        },
        async (args: z.infer<typeof MigrateAssetsInput>, _extra: unknown) =>
            await handleMigrateAssets(args as any) as any
    );

    const MigrateComponentInput = z.object(migrateComponentTool.inputSchema).strict();
    server.registerTool(migrateComponentTool.name,
        {
            title: migrateComponentTool.title,
            description: migrateComponentTool.description,
            inputSchema: migrateComponentTool.inputSchema,
        },
        async (args: z.infer<typeof MigrateComponentInput>, _extra: unknown) =>
            await handleMigrateComponent(args as any) as any
    );

    return server;
}
