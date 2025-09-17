import fs from "fs";
import path from "path";
import semver from "semver";
import { ensureInsideAllowed } from "../utils/fs.js";
import { run } from "../utils/run.js";
import { getLatestVersion, getPeerDeps } from "../utils/npm.js";

type UpgradeStrategy = "angularOnly" | "all";
type PackageMap = Record<string, string>;

export type ScaffoldProjectOptions = {
    oldProjectPath: string;        // existing project to read packages from
    newProjectPath: string;        // absolute directory where the new project should be created
    targetAngularVersion?: string; // e.g. "18" or "18.2.5"; if omitted, use latest
    installDeps?: boolean;         // default false
    upgradeStrategy?: UpgradeStrategy; // default "angularOnly"
};

export type ScaffoldPlan = {
    cliSpecifier: string;
    deps: PackageMap;
    devDeps: PackageMap;
    kept: Array<{ name: string; version: string }>;
    upgraded: Array<{ name: string; from?: string; to: string; reason: string }>;
    skipped: Array<{ name: string; reason: string }>;
};

export type ScaffoldProjectOutput = {
    created: boolean;
    newProjectPath: string; // final generated project directory
    newProjectName: string; // derived from path
    plan: ScaffoldPlan;
    installRun?: { code: number; stdout: string; stderr: string };
    createRun: { code: number; stdout: string; stderr: string };
    errors?: string[];
};

const ANGULAR_SCOPES = ["@angular/", "@angular-devkit/", "@schematics/angular"];

function isAngularPackage(name: string): boolean {
    return (
        ANGULAR_SCOPES.some((s) => name.startsWith(s)) ||
        name === "zone.js" ||
        name === "rxjs"
    );
}

function detectCliSpecifier(targetAngularVersion?: string): string {
    if (!targetAngularVersion) return "@angular/cli@latest";
    const major = semver.coerce(targetAngularVersion)?.major;
    if (!major) return "@angular/cli@latest";
    return `@angular/cli@${major}`; // pin to same major
}

// Decide target version for a package based on strategy
async function computeTargetVersion(name: string, from: string | undefined, opts: ScaffoldProjectOptions)
: Promise<{ 
    to?: string; 
    reason: string
}> {
    const upgradeAll = (opts.upgradeStrategy ?? "angularOnly") === "all";
    const targetNg = opts.targetAngularVersion;

    if (isAngularPackage(name)) {
        if (name.startsWith("@angular/") && targetNg) {
            return { to: targetNg, reason: "match targetAngularVersion" };
        }
        if (name === "@angular/cli") {
            const latest = await getLatestVersion("@angular/cli");
            return { to: latest, reason: "align with Angular CLI latest" };
        }
        if (upgradeAll) {
            const latest = await getLatestVersion(name);
            return { to: latest, reason: "upgrade all (latest)" };
        }
        return { to: from, reason: "keep (angularOnly strategy)" };
    }

    if (upgradeAll) {
        const latest = await getLatestVersion(name);
        return { to: latest, reason: "upgrade all (latest)" };
    }
    return { to: from, reason: "keep (angularOnly strategy)" };
}

// Enforce peerDependencies across deps/devDeps dynamically (no hardcoded rules)
async function enforcePeerCompatibility(depsIn: PackageMap, devDepsIn: PackageMap)
: Promise<{
    deps: PackageMap;
    devDeps: PackageMap;
    upgraded: Array<{ name: string; from?: string; to: string; reason: string }>;
}> {
    const deps: PackageMap = { ...depsIn };
    const devDeps: PackageMap = { ...devDepsIn };
    const upgraded: Array<{
        name: string;
        from?: string;
        to: string;
        reason: string;
    }> = [];

    const universe: PackageMap = { ...deps, ...devDeps };

    for (const [pkg, spec] of Object.entries(universe)) {
        const meta = await getPeerDeps(pkg, spec);
        if (!meta) continue;

        const peers: Record<string, string> = (meta as any).peerDependencies || {};
        const peersMeta: Record<string, { optional?: boolean }> =
            (meta as any).peerDependenciesMeta || {};

        for (const [peerName, peerRange] of Object.entries(peers)) {
            const optional = !!peersMeta[peerName]?.optional;
            const have = deps[peerName] ?? devDeps[peerName];

            if (!have) {
                if (!optional) {
                    deps[peerName] = peerRange;
                    upgraded.push({
                        name: peerName,
                        to: peerRange,
                        reason: `added missing peer for ${pkg}`,
                    });
                }
                continue;
            }

            const haveRange = semver.validRange(have);
            const needRange = semver.validRange(peerRange);
            let ok = false;

            if (haveRange && needRange) {
                ok = semver.intersects(have, peerRange, { includePrerelease: true });
            } else {
                const haveCoerced = semver.coerce(have);
                ok = !!(
                    haveCoerced && needRange && semver.satisfies(haveCoerced, peerRange)
                );
            }

            if (!ok) {
                const fromSpec = have;
                if (peerName in deps) deps[peerName] = peerRange;
                else devDeps[peerName] = peerRange;
                upgraded.push({
                    name: peerName,
                    from: fromSpec,
                    to: peerRange,
                    reason: `align to peer range of ${pkg}`,
                });
            }
        }
    }

    return { deps, devDeps, upgraded };
}

export async function scaffoldProject(opts: ScaffoldProjectOptions): Promise<ScaffoldProjectOutput> {

    // derive new project name from last path segment
    const derivedName = path.basename(opts.newProjectPath).trim();
    const newProjectName = derivedName.replace(/\s+/g, "-");
    const newProjectPath = opts.newProjectPath.replace(newProjectName, "");

    const existingAngularJson = path.join(newProjectPath, newProjectName, "angular.json");

    if (fs.existsSync(existingAngularJson)) {
        return {
            created: false,
            newProjectPath: opts.newProjectPath,
            newProjectName: newProjectName,
            plan: {
                cliSpecifier: "",
                deps: {},
                devDeps: {},
                kept: [],
                upgraded: [],
                skipped: [],
            },
            createRun: { code: 1, stdout: "", stderr: "Project already exists" },
            errors: [`Project already exists at ${opts.newProjectPath}`],
        };
    }

    // Validate paths
    const oldAbs = ensureInsideAllowed(opts.oldProjectPath);
    const newAbs = ensureInsideAllowed(opts.newProjectPath);

    // Read old project's package.json
    const oldPkgPath = path.join(oldAbs, "package.json");
    if (!fs.existsSync(oldPkgPath)) {
        throw new Error(`Old project package.json not found at ${oldPkgPath}`);
    }

    const oldPkg = JSON.parse(fs.readFileSync(oldPkgPath, "utf-8"));
    const oldDeps: PackageMap = { ...(oldPkg.dependencies || {}) };
    const oldDevDeps: PackageMap = { ...(oldPkg.devDependencies || {}) };

    // 1) Create angular project using npx @angular/cli
    const cliSpecifier = detectCliSpecifier(opts.targetAngularVersion);

    const createArgs = [
        "-y",
        cliSpecifier,
        "new",
        newProjectName,
        "--skip-install",
        "--routing=false",
        "--style=scss",
    ];

    fs.mkdirSync(newAbs, { recursive: true });

    const createRun = await run("npx", createArgs, newProjectPath);

    const errors: string[] = [];
    if (createRun.code !== 0) {
        errors.push(
            `Angular CLI creation failed: ${createRun.stderr || createRun.stdout}`
        );
    }

    // 2) Build desired deps/devDeps
    const nextDeps: PackageMap = {};
    const nextDevDeps: PackageMap = {};

    const pushSet = async (src: PackageMap, dst: PackageMap) => {
        for (const [name, from] of Object.entries(src)) {
            const { to } = await computeTargetVersion(name, from, opts);
            if (to) dst[name] = to;
        }
    };

    await pushSet(oldDeps, nextDeps);
    await pushSet(oldDevDeps, nextDevDeps);

    if (!("@angular/cli" in nextDevDeps)) {
        const cliLatest = await getLatestVersion("@angular/cli");
        if (cliLatest) nextDevDeps["@angular/cli"] = cliLatest;
    }

    if (opts.targetAngularVersion) {
        nextDeps["@angular/core"] = opts.targetAngularVersion;
    }

    const peerFix = await enforcePeerCompatibility(nextDeps, nextDevDeps);
    Object.assign(nextDeps, peerFix.deps);
    Object.assign(nextDevDeps, peerFix.devDeps);

    const kept: Array<{ name: string; version: string }> = [];
    const upgraded: Array<{ name: string; from?: string; to: string; reason: string }> = [
        ...peerFix.upgraded,
    ];
    const skipped: Array<{ name: string; reason: string }> = [];

    // 4) Write package.json in the new project (Angular CLI creates subfolder = project name)
    const newProjDir = path.join(newProjectPath, newProjectName);
    const newPkgPath = path.join(newProjDir, "package.json");

    if (!fs.existsSync(newPkgPath)) {
        errors.push(`New project package.json was not created. CLI output code=${createRun.code}`);
    } else {
        const newPkg = JSON.parse(fs.readFileSync(newPkgPath, "utf-8"));
        newPkg.name = newProjectName;
        newPkg.dependencies = { ...(newPkg.dependencies || {}), ...nextDeps };
        newPkg.devDependencies = { ...(newPkg.devDependencies || {}), ...nextDevDeps };
        fs.writeFileSync(newPkgPath, JSON.stringify(newPkg, null, 2));
    }

    let installRun: { code: number; stdout: string; stderr: string } | undefined;
    if (opts.installDeps) {
        installRun = await run("npm", ["install"], newProjDir);
    }

    const plan: ScaffoldPlan = {
        cliSpecifier,
        deps: nextDeps,
        devDeps: nextDevDeps,
        kept,
        upgraded,
        skipped,
    };

    return {
        created: createRun.code === 0,
        newProjectPath: newProjDir,
        newProjectName: newProjectName,
        plan,
        installRun,
        createRun,
        errors: errors.length ? errors : undefined,
    };
}
