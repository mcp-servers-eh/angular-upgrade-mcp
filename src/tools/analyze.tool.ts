import { z } from "zod";
import { AnalyzeOptions, analyzeProject } from "./analyze_project";

// Exported tool metadata + handler (index.ts will import this and register it)
export const analyzeTool = {
    name: "analyze_project",
    title: "Analyze Angular project (JSON report)",
    description: "Reads package.json/angular.json, scans modules & deps, and returns a concise JSON summary.",
    inputSchema: z.object({
        projectPath: z.string(),
        maxPackages: z.number().int().positive().optional(),
        concurrency: z.number().int().positive().optional(),
        includeDev: z.boolean().optional(),
        modulesTop: z.number().int().positive().optional()
    })
};

export async function handleAnalyze(args: AnalyzeOptions) {
    const out = await analyzeProject(args);
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}