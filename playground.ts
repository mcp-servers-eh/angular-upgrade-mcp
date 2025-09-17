import { analyzeProject } from "./src/tools/analyze_project.js";
import { scaffoldProject } from "./src/tools/scaffold_project.js";
import { getPeerDeps } from "./src/utils/npm.js";
import { run } from "./src/utils/run.js";
import { migrateAssets } from "./src/tools/migrate_assets.js";
import { ensureInsideAllowed } from "./src/utils/fs.js";
import path from "path";

async function main() {
    // const result = await analyzeProject({ projectPath: "D:/Aptar/Product Regulatory/Code/frontend" });

    // const result = await getPeerDeps("eslint", "^9");

    //  const createRun = await run("npx", createArgs, newAbs);
    // // const result = await run("npx", ["@angular/cli", "new", "frontend-mcp", "--skip-install", "--routing=false", "--style=scss"], "D:/Aptar/Product Regulatory/Code");

    // const result = await scaffoldProject({
    //     oldProjectPath: "D:/Aptar/Product Regulatory/Code/frontend",
    //     newProjectPath: "D:/Aptar/Product Regulatory/Code/frontend-mcp",
    //     upgradeStrategy: "all"
    // });

    // const result = await migrateAssets({
    //     oldProjectPath: "D:/Aptar/Product Regulatory/Code/frontend",
    //     newProjectPath: "D:/Aptar/Product Regulatory/Code/frontend-mcp",
    //     dryRun: false,
    //     include: ["Dockerfile", "nginx.conf", "README.md"]
    // });

    
    // console.log(JSON.stringify(result, null, 2));
}

main();
