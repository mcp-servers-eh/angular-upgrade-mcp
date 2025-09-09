import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadHandlers } from "./utils/load-handlers.js";

export async function createServer() {

  //#region Server
  const server = new Server(
    {
      name: "angular-upgrade-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  //#endregion

  //#region Handlers
  const handlers = await loadHandlers();
  //#endregion

  //#region List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: handlers.map((h) => h.META_DATA) };
  });
  //#endregion

  //#region Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const handler = handlers.find((h) => h.META_DATA.name === toolName);

    if (!handler) throw new Error(`Unknown tool: ${toolName}`);
    return handler.handle(request);
  });
  //#endregion

  return server;
}
