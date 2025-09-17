import { AnalyzeOptions, analyzeProject } from "./analyze_project.js";

// Exported tool metadata + handler (index.ts will import this and register it)
export const analyzeTool = {
    name: "analyze_project",
    title: "Analyze Angular project (JSON report)",
    description: "Comprehensive Angular project analysis - complete project scanning (package.json, angular.json, tsconfig.json, etc.), current Angular version and all related libraries identification, detection of old or insecure dependencies, and project structure evaluation with common architectural issues assessment.",
    inputSchema: {
        type: "object",
        properties: {
            projectPath: {
                type: "string",
                description: "Path to the Angular project to analyze (optional, defaults to PROJECT_PATH env var or current directory)"
            },
            maxPackages: {
                type: "number",
                description: "Maximum number of packages to analyze (optional, defaults to 150)"
            },
            concurrency: {
                type: "number",
                description: "Maximum number of concurrent operations (optional, defaults to 6)"
            },
            includeDev: {
                type: "boolean",
                description: "Include development dependencies (optional, defaults to true)"
            },
            modulesTop: {
                type: "number",
                description: "Maximum number of modules to analyze (optional, defaults to 10)"
            }
        },
        required: [
            "projectPath"
        ]
    }
};

export async function handleAnalyze(request: any) {

    const args = request.params?.arguments || request.arguments || request;

    const opts: AnalyzeOptions = {
        projectPath: process.env.PROJECT_PATH!,
        maxPackages: args.maxPackages || 150,
        concurrency: args.concurrency || 6,
        includeDev: args.includeDev || true,
        modulesTop: args.modulesTop || 10
    }

    const out = await analyzeProject(opts);

    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}