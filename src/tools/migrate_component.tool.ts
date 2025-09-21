import { migrateComponent, MigrateComponentArgs } from "./migrate_component.js";

export const migrateComponentTool = {
  name: "migrate_component",
  title: "Migrate a single Angular component",
  description: "Migrate a single Angular component from an old project to a new project, with optional copying of co-located assets and linking to a Route.",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
      newProjectPath: { type: "string" },
      componentTsPath: { type: "string" },
      targetAppRoot: { type: "string", optional: true },
      copyCoLocatedAssets: { type: "boolean", optional: true },
      makeStandalone: { type: "boolean", optional: true },
      route: { type: "object", properties: { path: { type: "string" }, routerConfigPath: { type: "string" }, lazy: { type: "boolean", optional: true } }, optional: true },
      dryRun: { type: "boolean", optional: true }
    },
    required: ["projectPath", "newProjectPath", "componentTsPath"],
  }
};

export async function handleMigrateComponent(request: any) {

  const args = request.params?.arguments || request.arguments || request;

  const opts: MigrateComponentArgs = {
    projectPath: process.env.PROJECT_PATH!,
    newProjectPath: process.env.NEW_PROJECT_PATH!,
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
