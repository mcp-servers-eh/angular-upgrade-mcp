import path from "path";
import fs from "fs";
import fse from "fs-extra";
import { globby } from "globby";

export type MigrateComponentArgs = {
  oldProjectPath: string;
  newProjectPath: string;
  componentTsPath: string;
  targetAppRoot?: string;
  copyCoLocatedAssets?: boolean;
  makeStandalone?: boolean;
  route?: {
    path: string;
    routerConfigPath: string; // e.g. src/app/app.routes.ts or app-routing.module.ts
    lazy?: boolean;           // if true and standalone, add lazy import
  };
  dryRun?: boolean;
};

export type MigrateComponentResult = {
  from: string;
  to: string;
  createdDirs: string[];
  copiedFiles: string[];
  updatedFiles: string[];
  skipped: string[];
  notes: string[];
  errors: Array<{ file?: string; error: string }>;
};

const ASSET_EXT = [".png",".jpg",".jpeg",".webp",".gif",".svg",".ico",".avif"];

export async function migrateComponent(args: MigrateComponentArgs): Promise<MigrateComponentResult> {
  const notes: string[] = [];
  const errors: Array<{ file?: string; error: string }> = [];
  const copiedFiles: string[] = [];
  const updatedFiles: string[] = [];
  const createdDirs: string[] = [];
  const skipped: string[] = [];

  const oldRoot = path.resolve(args.oldProjectPath);
  const newRoot = path.resolve(args.newProjectPath);
  const isDry = !!args.dryRun;

  // normalize paths
  const compTsOldAbs = path.resolve(oldRoot, args.componentTsPath.replace(/^[\\/]+/, ""));
  if (!fs.existsSync(compTsOldAbs)) {
    return { from: oldRoot, to: newRoot, createdDirs, copiedFiles, updatedFiles, skipped, notes, errors: [{ file: args.componentTsPath, error: "component .ts not found" }] };
  }
  if (!/\.component\.ts$/.test(compTsOldAbs)) {
    notes.push("componentTsPath does not end with .component.ts – continuing anyway.");
  }

  const srcAppRel = relativizeUnderSrcApp(compTsOldAbs, oldRoot);
  if (!srcAppRel) {
    notes.push("Component is not under src/app in the old project. Will mirror from its folder under src/app anyway if possible.");
  }
  const targetAppRoot = args.targetAppRoot ?? "src/app";

  // mirror directory structure from old src/app
  const relativeDir = srcAppRel ? path.dirname(srcAppRel) : deriveRelFromSrc(compTsOldAbs, oldRoot);
  const targetDirAbs = path.join(newRoot, targetAppRoot, relativeDir);

  // ensure dir
  if (!isDry) {
    await fse.ensureDir(targetDirAbs);
  }
  createdDirs.push(path.relative(newRoot, targetDirAbs).replace(/\\/g, "/"));

  // gather sibling files: ts/html/(s)css/spec
  const baseNameNoExt = path.basename(compTsOldAbs, ".ts"); // e.g. order-list.component
  const compDirOld = path.dirname(compTsOldAbs);
  const siblingGlobs = [
    `${baseNameNoExt}.ts`,
    `${baseNameNoExt}.html`,
    `${baseNameNoExt}.css`,
    `${baseNameNoExt}.scss`,
    `${baseNameNoExt}.sass`,
    `${baseNameNoExt}.less`,
    `${baseNameNoExt}.spec.ts`
  ];
  const siblingMatches = (await globby(siblingGlobs, { cwd: compDirOld })).map(p => path.join(compDirOld, p));

  // copy files preserving names
  for (const abs of siblingMatches) {
    const relName = path.basename(abs);
    const dest = path.join(targetDirAbs, relName);
    if (!isDry) {
      await fse.copy(abs, dest, { overwrite: true });
      // preserve times
      const s = fs.statSync(abs);
      fs.utimesSync(dest, s.atime, s.mtime);
    }
    copiedFiles.push(path.relative(newRoot, dest).replace(/\\/g, "/"));
  }

  // update component TS if standalone requested (best-effort)
  const compTsNewAbs = path.join(targetDirAbs, `${baseNameNoExt}.ts`);
  if (args.makeStandalone && fs.existsSync(compTsNewAbs)) {
    try {
      const code = fs.readFileSync(compTsNewAbs, "utf8");
      const updated = toggleStandaloneTrue(code);
      if (updated.changed && !isDry) {
        fs.writeFileSync(compTsNewAbs, updated.code, "utf8");
      }
      if (updated.changed) updatedFiles.push(path.relative(newRoot, compTsNewAbs).replace(/\\/g, "/"));
      notes.push(updated.note);
    } catch (e: any) {
      errors.push({ file: compTsNewAbs, error: `standalone transform failed: ${e?.message ?? e}` });
    }
  }

  // copy co-located assets referenced in template (only same folder)
  if (args.copyCoLocatedAssets) {
    const tplCandidates = ["html"].map(ext => path.join(targetDirAbs, `${baseNameNoExt}.${ext}`)).filter(p => fs.existsSync(p));
    for (const tpl of tplCandidates) {
      try {
        const html = fs.readFileSync(tpl, "utf8");
        const urls = extractLocalUrls(html);
        for (const url of urls) {
          // only same-folder or relative within the component dir
          const srcAbs = path.resolve(compDirOld, url);
          if (!fs.existsSync(srcAbs)) continue;
          if (!ASSET_EXT.includes(path.extname(srcAbs).toLowerCase())) continue;
          const destAbs = path.join(targetDirAbs, path.basename(srcAbs));
          if (!isDry) await fse.copy(srcAbs, destAbs, { overwrite: true });
          copiedFiles.push(path.relative(newRoot, destAbs).replace(/\\/g, "/"));
        }
      } catch (e: any) {
        errors.push({ file: tpl, error: `asset scan failed: ${e?.message ?? e}` });
      }
    }
  }

  // optional: wire a route
  if (args.route) {
    const routerFileAbs = path.resolve(newRoot, args.route.routerConfigPath);
    if (!fs.existsSync(routerFileAbs)) {
      notes.push(`routerConfigPath not found: ${args.route.routerConfigPath} (skipping route wiring)`);
    } else {
      try {
        const className = detectClassName(compTsNewAbs) ?? "UnknownComponent";
        const importRel = posixify(path.relative(path.dirname(routerFileAbs), compTsNewAbs).replace(/\.ts$/, ""));
        const isStandalone = args.makeStandalone ? true : detectStandalone(compTsNewAbs);

        let routerCode = fs.readFileSync(routerFileAbs, "utf8");

        if (isStandalone && args.route.lazy) {
          // routes: [{ path: 'x', loadComponent: () => import('./path').then(m => m.ClassName) }]
          const lazySnippet = `{ path: '${args.route.path}', loadComponent: () => import('${importRel}').then(m => m.${className}) }`;
          routerCode = ensureRoutesArray(routerCode, lazySnippet);
        } else {
          // import + routes: [{ path: 'x', component: ClassName }]
          if (!routerCode.includes(`from '${importRel}'`) && !routerCode.includes(`from "${importRel}"`)) {
            const importLine = `import { ${className} } from '${importRel}';\n`;
            routerCode = importLine + routerCode;
          }
          const eagerSnippet = `{ path: '${args.route.path}', component: ${className} }`;
          routerCode = ensureRoutesArray(routerCode, eagerSnippet);
        }

        if (!isDry) fs.writeFileSync(routerFileAbs, routerCode, "utf8");
        updatedFiles.push(path.relative(newRoot, routerFileAbs).replace(/\\/g, "/"));
      } catch (e: any) {
        errors.push({ file: args.route.routerConfigPath, error: `route wiring failed: ${e?.message ?? e}` });
      }
    }
  }

  notes.push(`Mode: ${isDry ? "DRY_RUN (no write)" : "WRITE (copied files)"}`);
  return { from: oldRoot, to: newRoot, createdDirs, copiedFiles, updatedFiles, skipped, notes, errors };
}

/** helpers */

function relativizeUnderSrcApp(absFile: string, oldRoot: string): string | null {
  const srcApp = path.join(oldRoot, "src", "app");
  const rel = path.relative(srcApp, absFile);
  return rel.startsWith("..") ? null : rel.replace(/\\/g, "/");
}

function deriveRelFromSrc(absFile: string, oldRoot: string): string {
  const src = path.join(oldRoot, "src");
  const rel = path.relative(src, absFile);
  return path.dirname(rel).replace(/\\/g, "/");
}

function toggleStandaloneTrue(code: string): { changed: boolean; code: string; note: string } {
  // naive best-effort: add standalone:true inside @Component({...})
  const compDecorator = /@Component\s*\(\s*\{([\s\S]*?)\}\s*\)\s*export\s+class\s+([A-Za-z0-9_]+)/m;
  const m = code.match(compDecorator);
  if (!m) return { changed: false, code, note: "standalone: could not find @Component decorator." };
  if (/standalone\s*:/.test(m[1])) return { changed: false, code, note: "standalone: already present; left as-is." };
  const injected = code.replace(compDecorator, (_all, obj, cls) => {
    const withStandalone = `@Component({ standalone: true, ${obj.trim().replace(/^\{|\}$/g, "")} })\nexport class ${cls}`;
    return withStandalone;
  });
  return { changed: true, code: injected, note: "standalone: added standalone:true (best-effort)." };
}

function extractLocalUrls(html: string): string[] {
  const urls = new Set<string>();
  // src="..."  href="..."
  const re = /\b(?:src|href)\s*=\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (u.startsWith("http")) continue;
    if (u.startsWith("data:")) continue;
    urls.add(u);
  }
  return [...urls];
}

function detectClassName(compTsPath: string): string | null {
  try {
    const code = fs.readFileSync(compTsPath, "utf8");
    const m = code.match(/export\s+class\s+([A-Za-z0-9_]+)/);
    return m ? m[1] : null;
  } catch { return null; }
}

function detectStandalone(compTsPath: string): boolean {
  try {
    const code = fs.readFileSync(compTsPath, "utf8");
    return /@Component\s*\(\s*\{[\s\S]*?standalone\s*:\s*true/.test(code);
  } catch { return false; }
}

function ensureRoutesArray(code: string, toAdd: string): string {
  // naive: find first 'Routes' array or 'const routes = [...]'
  const routesDecl = /(const\s+routes\s*:\s*Routes\s*=\s*\[)([\s\S]*?)(\];)/m;
  if (routesDecl.test(code)) {
    return code.replace(routesDecl, (_all, start, body, end) => {
      if (body.includes(toAdd)) return `${start}${body}${end}`;
      const trimmed = body.trim();
      const withComma = trimmed && !trimmed.endsWith(",") ? trimmed + "," : trimmed;
      return `${start}\n  ${withComma}\n  ${toAdd}\n${end}`;
    });
  }
  // fallback: append minimal routes declaration
  const header = `import { Routes } from '@angular/router';\n`;
  const hasHeader = code.includes("@angular/router");
  const pre = hasHeader ? "" : header;
  const decl = `\nconst routes: Routes = [\n  ${toAdd}\n];\n`;
  return pre + code + decl;
}

function posixify(p: string) {
  return p.split(path.sep).join("/").replace(/\\/g, "/");
}
