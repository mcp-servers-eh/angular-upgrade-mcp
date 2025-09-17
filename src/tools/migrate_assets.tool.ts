import { z } from "zod";
import { migrateAssets, MigrateAssetsOptions } from "./migrate_assets";

export const migrateAssetsTool = {
  name: "migrate_assets",
  title: "Migrate Angular static assets (src/*)",
  description: "Copies static assets and files (assets, environments, favicon, manifest, robots.txt, …) from an old project to a new project and updates angular.json.",
  inputSchema: z.object({
    oldProjectPath: z.string(),
    newProjectPath: z.string(),
    projectName: z.string().optional(),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    dryRun: z.boolean().optional(),
  })
};

export async function handleMigrateAssets(args: MigrateAssetsOptions) {
  const out = await migrateAssets(args);
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}
