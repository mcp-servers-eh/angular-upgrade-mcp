import { z } from "zod";
import { AnalyzeOptions, analyzeProject } from "./analyze_project.js";

// Exported tool metadata + handler (index.ts will import this and register it)
export const analyzeTool = {
    name: "analyze_project",
    title: "Analyze Angular project (JSON report)",
    description: "Comprehensive Angular project analysis - complete project scanning (package.json, angular.json, tsconfig.json, etc.), current Angular version and all related libraries identification, detection of old or insecure dependencies, and project structure evaluation with common architectural issues assessment.",
    inputSchema: {
        maxPackages: z.number().optional().default(150).describe("Maximum number of packages to analyze (optional, default is 150)"),
        concurrency: z.number().optional().default(6).describe("Maximum number of concurrent operations (optional, default is 6)"),
        includeDev: z.boolean().optional().default(true).describe("Include development dependencies (optional, default is true)"),
        modulesTop: z.number().optional().default(10).describe("Maximum number of modules to analyze (optional, default is 10)"),
    } as z.ZodRawShape
};

export async function handleAnalyzeProject(request: any) {
    
    const projectPath = process.env.PROJECT_PATH;
    if (!projectPath) {
        return {
            content: [{ type: "text", text: "PROJECT_PATH is not set in the environment." }],
            isError: true
        };
    }

    const args = request.params?.arguments || request.arguments || request;

    const opts: AnalyzeOptions = {
        projectPath: projectPath,
        maxPackages: args.maxPackages ?? 150,
        concurrency: args.concurrency ?? 6,
        includeDev: args.includeDev ?? true,
        modulesTop: args.modulesTop ?? 10
    }

    const out = await analyzeProject(opts);

    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}