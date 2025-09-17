import fs from "fs";
import path from "path";
import semver from "semver";
import { ensureInsideAllowed } from "../utils/fs.js";
import { getLatestVersion } from "../utils/npm.js";
import { listFilesByGlob, readTextSafe, approxFolderFileCount } from "../utils/scan.js";

export type AnalyzeOptions = {
  projectPath: string;
  maxPackages?: number;   // default 150
  concurrency?: number;   // default 6
  includeDev?: boolean;   // default true
  modulesTop?: number;    // default 10
};

export type AnalyzeOutput = {
  workspace: "angular-cli" | "nx" | "unknown";
  isAngularProject: boolean;
  angularCore: string | "unknown";
  angularCli: string | "unknown";
  rxjs: string | "unknown";
  typescript: string | "unknown";
  structure: { apps: number; libs: number; hasStandalone: boolean };
  entryPoints: { main?: string; appModule?: string | null };
  testing: { hasKarma: boolean; hasJest: boolean };
  suggestions: Array<{ name: string; current: string; latest?: string; updateHint?: string; type: "dep" | "devDep" }>;
  packagesInfo: { totalDeps: number; totalDevDeps: number; scanned: number; capped: boolean; concurrency: number };
  modulesOverview: {
    ngModules: number;
    lazyModules: number;
    topModules: Array<{ name: string; path: string; lazy: boolean; files: number }>;
    special: { appModule?: string | null; coreModule?: string | null; sharedModule?: string | null };
  };
  recommendations: string[];
};

function safeReadJson<T = any>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function findFirstFile(base: string, rels: string[]): string | undefined {
  for (const r of rels) {
    const p = path.join(base, r);
    if (fs.existsSync(p)) return p;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, task: (it: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length) as any;
  let i = 0; let active = 0;
  return new Promise((resolve, reject) => {
    const runNext = () => {
      while (active < limit && i < items.length) {
        const idx = i++; active++;
        task(items[idx]).then(res => { results[idx] = res; active--; runNext(); }).catch(reject);
      }
      if (active === 0 && i >= items.length) resolve(results);
    };
    runNext();
  });
}

export async function analyzeProject(opts: AnalyzeOptions): Promise<AnalyzeOutput> {
  const { projectPath, maxPackages = 150, concurrency = 6, includeDev = true, modulesTop = 10 } = opts;
  const abs = ensureInsideAllowed(projectPath);

  //#region Basic package info

  const pkgPath = path.join(abs, "package.json");
  if (!fs.existsSync(pkgPath)) throw new Error(`package.json not found in ${abs}`);
  const pkg = safeReadJson<any>(pkgPath) || {};
  const deps = (pkg.dependencies || {}) as Record<string, string>;
  const devDeps = includeDev ? (pkg.devDependencies || {}) as Record<string, string> : {};

  const angularCore = deps["@angular/core"] ?? "unknown";
  const angularCli = (deps["@angular/cli"] ?? devDeps["@angular/cli"]) ?? "unknown";
  const rxjs = deps["rxjs"] ?? devDeps["rxjs"] ?? "unknown";
  const typescript = devDeps["typescript"] ?? deps["typescript"] ?? "unknown";

  const isNx = !!deps["nx"] || !!devDeps["nx"] || fs.existsSync(path.join(abs, "nx.json"));
  const workspace: AnalyzeOutput["workspace"] = isNx ? "nx" : (fs.existsSync(path.join(abs, "angular.json")) ? "angular-cli" : "unknown");

  //#endregion

  //#region Structure

  const appsDir = path.join(abs, "apps");
  const libsDir = path.join(abs, "libs");
  const srcApp = path.join(abs, "src", "app");
  const apps = fs.existsSync(appsDir) ? fs.readdirSync(appsDir).filter(d => !d.startsWith(".")).length : (fs.existsSync(srcApp) ? 1 : 0);
  const libs = fs.existsSync(libsDir) ? fs.readdirSync(libsDir).filter(d => !d.startsWith(".")).length : 0;

  //#endregion

  //#region Entry points

  const angularJson = safeReadJson<any>(path.join(abs, "angular.json"));
  let mainRel: string | undefined;
  if (angularJson?.projects) {
    const values = Object.values<any>(angularJson.projects);
    const firstApp = values.find((p: any) => p?.projectType === "application") || values[0];
    mainRel = firstApp?.architect?.build?.options?.main || firstApp?.targets?.build?.options?.main;
  }
  const mainPath = mainRel ? path.join(abs, mainRel) : findFirstFile(abs, ["src/main.ts", "apps/app/src/main.ts", "apps/web/src/main.ts"]);

  //#endregion

  //#region Standalone detection

  let hasStandalone = false;
  let appModulePath: string | null = null;
  if (mainPath && fs.existsSync(mainPath)) {
    const mainSrc = fs.readFileSync(mainPath, "utf-8");
    hasStandalone = /bootstrapApplication\s*\(/.test(mainSrc);
  }
  appModulePath = findFirstFile(abs, ["src/app/app.module.ts", "apps/app/src/app/app.module.ts"]) ?? null;

  //#endregion

  //#region Testing frameworks

  const hasKarma = !!deps["karma"] || !!devDeps["karma"] || fs.existsSync(path.join(abs, "karma.conf.js"));
  const hasJest = !!deps["jest"] || !!devDeps["jest"] || fs.existsSync(path.join(abs, "jest.config.js")) || fs.existsSync(path.join(abs, "jest.config.ts"));

  //#endregion

  //#region Dynamic packages scan (deps + devDeps) - suggestions

  const allDeps: Array<{ name: string; current: string; type: "dep" | "devDep" }> = [
    ...Object.entries(deps).map(([name, current]) => ({ name, current, type: "dep" as const })),
    ...Object.entries(devDeps).map(([name, current]) => ({ name, current, type: "devDep" as const })),
  ];
  const capped = allDeps.length > maxPackages;
  const scanList = capped ? allDeps.slice(0, maxPackages) : allDeps;

  const suggestions = await mapLimit(scanList, concurrency, async ({ name, current, type }) => {
    const latest = await getLatestVersion(name);
    let updateHint: string | undefined;
    if (latest) {
      try {
        if (current && semver.validRange(current)) {
          const min = semver.minVersion(current);
          if (min && semver.lt(min, latest)) updateHint = `update to ${name}@${latest}`;
        } else if (!current) {
          updateHint = `install ${name}@${latest}`;
        }
      } catch { }
    }
    return { name, current, latest, updateHint, type };
  });

  //#endregion

  //#region Modules overview (app-only scope)

  // Normalize to forward slashes, strip leading "./" and ".ts"
  const normNoExt = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\.ts$/i, "");

  // Read the real exported class name from a module file
  const readModuleClassName = (fullPath: string): string | undefined => {
    const txt = readTextSafe(fullPath);
    const m = /export\s+class\s+(\w+)\b/.exec(txt);
    return m?.[1];
  };

  // Check file really defines an NgModule (not just named *.module.ts)
  const isRealNgModuleFile = (fullPath: string): boolean => {
    const txt = readTextSafe(fullPath);
    const hasDecorator = /@NgModule\s*\(/.test(txt);
    const hasExportedClass = /export\s+class\s+\w+\b/.test(txt);
    return hasDecorator && hasExportedClass;
  };

  // Fallback: convert kebab to PascalCase + 'Module'
  const kebabToPascal = (s: string) =>
    s
      .split(/[^a-zA-Z0-9]/)
      .filter(Boolean)
      .map(w => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
      .join("");

  const inferClassFromFile = (relPath: string): string => {
    // e.g. "src/app/modules/raw-materials/raw-materials.module.ts"
    const base = path.basename(relPath).replace(/\.module\.ts$/i, "");
    return `${kebabToPascal(base)}Module`;
  };


  // -----------------------------
  // Collect lazy-load hints from routing (import path + className)
  // -----------------------------
  type LazyHint = { importPath: string; className: string };
  const lazyHints: LazyHint[] = [];

  // Dynamic import: import('...').then(mod => mod.SomeModule) — any variable name/spacing
  const dynRe =
    /loadChildren\s*:\s*\(\s*\)\s*=>\s*import\(['"]([^'"]+)['"]\)\.then\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\.(\w+)\s*\)/g;

  // Legacy string syntax: 'path#SomeModule'
  const legacyRe = /loadChildren\s*:\s*['"]([^#'"]+)#(\w+)['"]/g;

  const MODULE_GLOBS = [
    "src/app/**/*.module.ts",
    "apps/**/src/app/**/*.module.ts",
    "libs/**/src/**/*.module.ts"
  ];

  const ROUTING_GLOBS = [
    "src/app/**/*-routing.module.ts",
    "apps/**/src/app/**/*-routing.module.ts",
    "src/app/**/app-routing.module.ts",
    "apps/**/src/app/**/app-routing.module.ts",
    "libs/**/src/**/*-routing.module.ts"
  ];

  const IGNORE_GLOBS = [
    "**/node_modules/**",
    "**/dist/**",
    "**/.angular/**",
    "**/.git/**"
  ];

  const moduleFilesAll = await listFilesByGlob(abs, MODULE_GLOBS, IGNORE_GLOBS);
  const routingFiles = await listFilesByGlob(abs, ROUTING_GLOBS, IGNORE_GLOBS);


  for (const rel of routingFiles) {
    const src = readTextSafe(path.join(abs, rel));
    let m: RegExpExecArray | null;
    while ((m = dynRe.exec(src))) lazyHints.push({ importPath: m[1], className: m[2] });
    while ((m = legacyRe.exec(src))) lazyHints.push({ importPath: m[1], className: m[2] });
  }


  // -----------------------------
  // Filter to *real* NgModules, then build module list with lazy + size
  // -----------------------------

  // Only real NgModules (have @NgModule + exported class)
  const moduleFiles = moduleFilesAll.filter(rel => {
    const full = path.join(abs, rel);
    return isRealNgModuleFile(full);
  });

  // Build list for reporting (sorted by approximate size desc)
  const mods = moduleFiles
    .map(rel => {
      const full = path.join(abs, rel);
      const folder = path.dirname(full);

      // Prefer reading the class name from the file, fallback to filename inference
      const classNameFromFile = readModuleClassName(full) || inferClassFromFile(rel);

      // Match against routing hints by class name OR import path containment
      const relNoExt = normNoExt(rel);
      const isLazy = lazyHints.some(h => {
        const hintClass = h.className;
        const hintImport = normNoExt(h.importPath);

        // Case-insensitive match on Windows
        const a = process.platform === "win32" ? classNameFromFile.toLowerCase() : classNameFromFile;
        const b = process.platform === "win32" ? hintClass.toLowerCase() : hintClass;

        const classMatch = a === b;
        const pathMatch = relNoExt.endsWith(hintImport) || relNoExt.includes("/" + hintImport);
        return classMatch || pathMatch;
      });

      const files = approxFolderFileCount(folder);
      return { name: classNameFromFile, path: rel, lazy: isLazy, files };
    })
    .sort((a, b) => b.files - a.files);

  // Special modules (search within *filtered* module list)
  const special = {
    appModule: appModulePath ? path.relative(abs, appModulePath) : null,
    coreModule: moduleFiles.find(p => /(^|\/)core\.module\.ts$/i.test(p)) || null,
    sharedModule: moduleFiles.find(p => /(^|\/)shared\.module\.ts$/i.test(p)) || null
  };

  // Final overview
  const modulesOverview = {
    ngModules: moduleFiles.length,                     // exact count of real NgModules
    lazyModules: mods.filter(m => m.lazy).length,      // matched via routing hints
    topModules: mods.slice(0, Math.max(1, Math.min(50, modulesTop))),
    special
  } as AnalyzeOutput["modulesOverview"];

  //#endregion

  //#region Recommendations (short and actionable)

  const rec: string[] = [];
  const isRange = (v: string) => !!semver.validRange(v);
  if (rxjs !== "unknown" && isRange(rxjs) && semver.intersects(rxjs, "<7")) rec.push("Consider upgrading rxjs to ^7 during migration");
  if (angularCli !== "unknown" && isRange(angularCli) && semver.intersects(angularCli, "<15")) rec.push("Create a fresh workspace and migrate features incrementally");
  if (!hasStandalone) rec.push("If upgrading to Angular 15+, consider moving to standalone bootstrap gradually");

  //#endregion

  return {
    workspace,
    isAngularProject: angularCore !== "unknown" || fs.existsSync(path.join(abs, "angular.json")) || isNx,
    angularCore,
    angularCli,
    rxjs,
    typescript,
    structure: { apps, libs, hasStandalone },
    entryPoints: { main: mainPath ? path.relative(abs, mainPath) : undefined, appModule: appModulePath ? path.relative(abs, appModulePath) : null },
    testing: { hasKarma, hasJest },
    modulesOverview,
    packagesInfo: { totalDeps: Object.keys(deps).length, totalDevDeps: Object.keys(devDeps).length, scanned: suggestions.length, capped, concurrency },
    suggestions,
    recommendations: rec.length ? rec : ["Run incremental copy + verify after each step"]
  };
}