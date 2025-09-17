import { z } from "zod";
import { scaffoldProject, ScaffoldProjectOptions } from "./scaffold_project";

export const scaffoldTool = {
  name: "scaffold_project",
  title: "Create and scaffold Angular project (packages upgrade)",
  description: "Creates a new Angular project with @angular/cli, copies dependencies from an old project, and upgrades versions to a target (or latest). Optionally runs npm install.",
  inputSchema: z.object({
    oldProjectPath: z.string(),
    newProjectPath: z.string(),
    newProjectName: z.string(),
    targetAngularVersion: z.string().optional(),
    installDeps: z.boolean().optional(),
    upgradeStrategy: z.enum(["angularOnly","all"]).optional(),
  })
};

export async function handleScaffoldProject(args: ScaffoldProjectOptions) {
  const out = await scaffoldProject(args);
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}
