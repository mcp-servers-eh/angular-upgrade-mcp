import { migrateAssets, MigrateAssetsOptions } from "./migrate_assets.js";

export const migrateAssetsTool = {
  name: "migrate_assets",
  title: "Migrate Angular static assets (src/*)",
  description: "Copies static assets and files (assets, environments, favicon, manifest, robots.txt, …) from an old project to a new project and updates angular.json.",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
      newProjectPath: { type: "string" },
      include: { type: "array", items: { type: "string" }, optional: true },
      exclude: { type: "array", items: { type: "string" }, optional: true },
      dryRun: { type: "boolean", optional: true },
    },
    required: ["projectPath", "newProjectPath"],
  }
};

export async function handleMigrateAssets(request: any) {

  const args = request.params?.arguments || request.arguments || request;

  const opts: MigrateAssetsOptions = {
    projectPath: process.env.PROJECT_PATH!,
    newProjectPath: process.env.NEW_PROJECT_PATH!,
    include: args.include,
    exclude: args.exclude,
    dryRun: args.dryRun,
  }

  const out = await migrateAssets(opts);
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}
