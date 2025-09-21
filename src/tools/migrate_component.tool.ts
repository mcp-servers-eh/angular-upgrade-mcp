import { z } from "zod";
import { migrateComponent, MigrateComponentArgs } from "./migrate_component.js";

export const migrateComponentTool = {
  name: "migrate_component",
  title: "Migrate a single Angular component",
  description: "Migrate a single Angular component from an old project to a new project, with optional copying of co-located assets and linking to a Route.",
  inputSchema: {
    componentTsPath: z.string().describe("Path to the component .ts file to migrate"),
    targetAppRoot: z.string().optional().describe("Target app root (optional, default is src/app)"),
    copyCoLocatedAssets: z.boolean().optional().default(false).describe("If true, copies co-located assets"),
    makeStandalone: z.boolean().optional().default(false).describe("If true, makes the component standalone"),
    route: z.object({ path: z.string(), routerConfigPath: z.string(), lazy: z.boolean().optional() }).optional().describe("If provided, wires the component to a Route"),
    dryRun: z.boolean().optional().default(false).describe("If true, shows what it would do without copying"),
  } as z.ZodRawShape
};

export async function handleMigrateComponent(request: any) {

  const projectPath = process.env.PROJECT_PATH;
  const newProjectPath = process.env.NEW_PROJECT_PATH;

  if (!projectPath || !newProjectPath) {
      return {
          content: [{ type: "text", text: "PROJECT_PATH or NEW_PROJECT_PATH is not set in the environment." }],
          isError: true
      };
  }

  const args = request.params?.arguments || request.arguments || request;

  const opts: MigrateComponentArgs = {
    projectPath: projectPath,
    newProjectPath: newProjectPath,
    componentTsPath: args.componentTsPath,
    targetAppRoot: args.targetAppRoot,
    copyCoLocatedAssets: args.copyCoLocatedAssets,
    makeStandalone: args.makeStandalone,
    route: args.route,
    dryRun: args.dryRun,
  }

  const out = await migrateComponent(opts);
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}
