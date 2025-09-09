import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ProjectAnalysisHandler } from "./handlers/project-analysis.handler";

export async function createServer() {

  const server = new Server(
    {
      name: "angular-upgrade-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const projectAnalysis = new ProjectAnalysisHandler();

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        projectAnalysis.META_DATA
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    if (name === "angular-project-analysis") {
      return projectAnalysis.handleProjectAnalysis(request);
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  return server;
}
