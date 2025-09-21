import { z } from "zod";
import { scaffoldProject, ScaffoldProjectOptions } from "./scaffold_project.js";

export const scaffoldTool = {
  name: "scaffold_project",
  title: "Create and scaffold Angular project (packages upgrade)",
  description: "Creates a new Angular project with @angular/cli, copies dependencies from an old project, and upgrades versions to a target (or latest). Optionally runs npm install.",
  inputSchema: {
    targetAngularVersion: z.string().optional().describe("Target Angular version (optional, default is latest)"),
    upgradeStrategy: z.enum(["angularOnly", "all"]).optional().default("all").describe("Upgrade all packages or only major angular packages (optional, default is all)"),
    installDeps: z.boolean().optional().default(false).describe("Install dependencies (optional, default is false)"),
  } as z.ZodRawShape
};

export async function handleScaffoldProject(request: any) {

  const projectPath = process.env.PROJECT_PATH;
  const newProjectPath = process.env.NEW_PROJECT_PATH;

  if (!projectPath || !newProjectPath) {
      return {
          content: [{ type: "text", text: "PROJECT_PATH or NEW_PROJECT_PATH is not set in the environment." }],
          isError: true
      };
  }

  const args = request.params?.arguments || request.arguments || request;

  const opts: ScaffoldProjectOptions = {
    oldProjectPath: projectPath,
    newProjectPath: newProjectPath,
    targetAngularVersion: args.targetAngularVersion,
    installDeps: args.installDeps ?? false,
    upgradeStrategy: args.upgradeStrategy ?? "all",
  }

  const out = await scaffoldProject(opts);
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}
