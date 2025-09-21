import { z } from "zod";
import { migrateAssets, MigrateAssetsOptions } from "./migrate_assets.js";

export const migrateAssetsTool = {
  name: "migrate_assets",
  title: "Migrate Angular static assets (src/*)",
  description: "Copies static assets and files (assets, environments, favicon, manifest, robots.txt, …) from an old project to a new project and updates angular.json.",
  inputSchema: {
    include: z.array(z.string()).optional().describe("File patterns to include"),
    exclude: z.array(z.string()).optional().describe("File patterns to exclude"),
    dryRun: z.boolean().optional().default(false).describe("If true, shows what it would do without copying"),
  } as z.ZodRawShape
};

export async function handleMigrateAssets(request: any) {

  const projectPath = process.env.PROJECT_PATH;
  const newProjectPath = process.env.NEW_PROJECT_PATH;

  if (!projectPath || !newProjectPath) {
      return {
          content: [{ type: "text", text: "PROJECT_PATH or NEW_PROJECT_PATH is not set in the environment." }],
          isError: true
      };
  }

  const args = request.params?.arguments || request.arguments || request;

  const opts: MigrateAssetsOptions = {
    projectPath: projectPath,
    newProjectPath: newProjectPath,
    include: args.include,
    exclude: args.exclude,
    dryRun: args.dryRun,
  }

  const out = await migrateAssets(opts);
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}
