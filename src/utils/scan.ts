import fs from "fs";
import path from "path";
import { globby } from "globby";


// List files by glob relative to base directory
export async function listFilesByGlob(base: string, patterns: string[], ignore: string[] = []) {
    return globby(patterns, { cwd: base, dot: false, ignore });
}


export function readTextSafe(p: string): string {
    try { return fs.readFileSync(p, "utf-8"); } catch { return ""; }
}

// Roughly count files under a folder (capped to keep it fast)
export function approxFolderFileCount(p: string): number {
    try {
        let count = 0;
        const walk = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                if (e.name === "node_modules" || e.name === "dist" || e.name.startsWith(".")) continue;
                const full = path.join(dir, e.name);
                if (e.isDirectory()) walk(full); else count++;
                if (count > 500) return; // safety cap
            }
        };
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) walk(p);
        return count;
    } catch { return 0; }
}