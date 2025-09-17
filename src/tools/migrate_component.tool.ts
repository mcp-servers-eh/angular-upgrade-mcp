import { z } from "zod";
import { migrateComponent, MigrateComponentArgs } from "./migrate_component.js";

export const migrateComponentTool = {
  name: "migrate_component",
  title: "Migrate a single Angular component",
  description: "Migrate a single Angular component from an old project to a new project, with optional copying of co-located assets and linking to a Route.",
  inputSchema: z.object({
    oldProjectPath: z.string(),
    newProjectPath: z.string(),
    componentTsPath: z.string(),
    targetAppRoot: z.string().optional(),
    copyCoLocatedAssets: z.boolean().optional(),
    makeStandalone: z.boolean().optional(),
    route: z.object({
      path: z.string(),
      routerConfigPath: z.string(),
      lazy: z.boolean().optional()
    }).optional(),
    dryRun: z.boolean().optional()
  })
};

export async function handleMigrateComponent(args: MigrateComponentArgs) {
  const out = await migrateComponent(args);
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}
