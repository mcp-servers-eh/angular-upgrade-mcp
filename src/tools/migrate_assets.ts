import fs from "fs";
import path from "path";
import fse from "fs-extra";
import { globby } from "globby";
import { ensureInsideAllowed } from "../utils/fs.js";

export type MigrateAssetsOptions = {
    projectPath: string;   // Path to the old project (repository root containing src)
    newProjectPath: string;   // Path to the new project created with scaffold_project
    include?: string[];       // Additional globs if needed
    exclude?: string[];       // Globs for exclusion
    dryRun?: boolean;         // If true, shows what it would do without copying
};

export type MigrateAssetsResult = {
    from: string;
    to: string;
    copied: string[];
    skipped: string[];
    errors: Array<{ file: string; error: string }>;
    updatedAngularJson?: boolean;
    notes: string[];
};

const DEFAULT_INCLUDE = [
    "src/assets/**",
    "src/environments/**",
    "src/favicon.*",
    "src/manifest.webmanifest",
    "src/robots.txt",
    // Common in some projects
    "src/**/*.svg",
    "src/**/*.ico",
    "src/**/*.webp",
    "src/**/*.png",
    "src/**/*.jpg",
    "src/**/*.jpeg",
    "src/**/*.gif",
    "src/**/*.ttf",
    "src/**/*.woff",
    "src/**/*.woff2",
    "angular.json"
];

const DEFAULT_EXCLUDE = [
    "src/app/**",
    "src/*.ts",
    "src/**/*.ts",
    "src/main.*",
    "src/polyfills.*",
    "src/test.*",
    "src/**/*.spec.*",
    "src/**/*.test.*",
    "node_modules/**",
    "dist/**",
    "**/.**", // Hidden files
];

export async function migrateAssets(opts: MigrateAssetsOptions): Promise<MigrateAssetsResult> {
    const notes: string[] = [];
    const errors: Array<{ file: string; error: string }> = [];
    const copied: string[] = [];
    const skipped: string[] = [];

    const oldRoot = ensureInsideAllowed(opts.projectPath);
    const newRoot = ensureInsideAllowed(opts.newProjectPath);

    const include = (opts.include && opts.include.length ? [...opts.include, ...DEFAULT_INCLUDE] : DEFAULT_INCLUDE);
    const exclude = [...DEFAULT_EXCLUDE, ...(opts.exclude ?? [])];

    // 1) Collect files from the old project
    const matches = await globby(include, { cwd: oldRoot, dot: false, ignore: exclude });
    if (matches.length === 0) {
        notes.push("No files found matching the specified patterns.");
    }

    const isDry = !!opts.dryRun;
    notes.push(`Mode: ${isDry ? "DRY_RUN (no write)" : "WRITE (copying files)"}`);

    // 2) Copy files to the same structure inside the new project
    for (const rel of matches) {
        const fromAbs = path.join(oldRoot, rel);
        const toAbs = path.join(newRoot, rel);

        // Ensure the target directory exists
        if (!isDry) {
            try {
                await fse.ensureDir(path.dirname(toAbs));
            } catch (e: any) {
                errors.push({ file: rel, error: `ensureDir failed: ${e?.message ?? String(e)}` });
                continue;
            }
        }

        // If the file exists with similar content, we can skip it
        const shouldSkip = !isDry && fs.existsSync(toAbs);
        if (shouldSkip) {
            try {
                const srcStat = fs.statSync(fromAbs);
                const dstStat = fs.statSync(toAbs);
                if (srcStat.size === dstStat.size && +srcStat.mtimeMs === +dstStat.mtimeMs) {
                    skipped.push(rel);
                    continue;
                }
            } catch {
                // If the check fails, continue with copying
            }
        }

        if (!isDry) {
            try {
                await fse.copy(fromAbs, toAbs, { overwrite: true, errorOnExist: false });
                // Preserve modification time for future comparison
                const s = fs.statSync(fromAbs);
                await fs.utimesSync(toAbs, s.atime, s.mtime);
                copied.push(rel);
            } catch (e: any) {
                errors.push({ file: rel, error: e?.message ?? String(e) });
            }
        } else {
            copied.push(rel); // In dryRun, consider it as part of the plan
        }
    }

    // 3) Update angular.json (assets/styles) in the new project if needed
    let updatedAngularJson = false;
    try {

        const derivedName = path.basename(opts.newProjectPath).trim();
        const newProjectName = derivedName.replace(/\s+/g, "-");
        const angularJsonPath = path.join(newRoot, "angular.json");

        if (fs.existsSync(angularJsonPath)) {

            const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, "utf-8"));

            if (newProjectName && angularJson.projects?.[newProjectName]?.architect?.build?.options) {
                const options = angularJson.projects[newProjectName].architect.build.options;

                // assets: Ensure src/assets and favicon exist
                options.assets = normalizeArray(options.assets);
                if (!options.assets.some((a: any) => isAssetsEntry(a, "src/assets"))) {
                    options.assets.push("src/assets");
                    updatedAngularJson = true;
                }

                // favicon (if one was copied)
                const hasFavicon = matches.some(m => /^src\/favicon\.(?:ico|png|svg)$/.test(m));
                if (hasFavicon) {
                    // Some projects use options.favicon (Angular 17+)
                    if (options.favicon !== "src/favicon.ico" && options.favicon !== "src/favicon.png" && options.favicon !== "src/favicon.svg") {
                        // Keep it generic; Angular will detect the extension
                        options.favicon = "src/favicon.ico";
                        updatedAngularJson = true;
                    }
                }

                // styles: If there are styles.* in the root or styles folder
                options.styles = normalizeArray(options.styles);
                const styleCandidates = ["src/styles.css", "src/styles.scss", "src/styles.sass", "src/styles.less"];
                for (const s of styleCandidates) {
                    if (fs.existsSync(path.join(newRoot, s)) && !options.styles.includes(s)) {
                        options.styles.push(s);
                        updatedAngularJson = true;
                    }
                }

                if (updatedAngularJson && !opts.dryRun) {
                    fs.writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2));
                }

            } else {
                notes.push("Could not determine projectName inside angular.json; settings were not modified.");
            }
            
        } else {
            notes.push("angular.json not found in the new project.");
        }

    } catch (e: any) {
        errors.push({ file: "angular.json", error: e?.message ?? String(e) });
    }

    return {
        from: oldRoot,
        to: newRoot,
        copied,
        skipped,
        errors,
        updatedAngularJson,
        notes,
    };
}

function normalizeArray(v: any): any[] {
    if (Array.isArray(v)) return v;
    if (v == null) return [];
    return [v];
}

function isAssetsEntry(entry: any, rel: string) {
    if (typeof entry === "string") return entry === rel;
    if (entry && typeof entry === "object") {
        return (entry.input === rel) || (entry.glob && String(entry.glob).startsWith(rel));
    }
    return false;
}