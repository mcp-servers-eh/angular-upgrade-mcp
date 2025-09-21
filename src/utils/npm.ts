import { run } from "./run.js";

const latestCache = new Map<string, string | undefined>();

export async function getLatestVersion(pkgName: string): Promise<string | undefined> {

  if (latestCache.has(pkgName)) return latestCache.get(pkgName);

  // Get all versions and find the latest stable one
  const { code, stdout } = await run("npm", ["view", pkgName, "versions", "--json"], process.cwd());

  let ver: string | undefined;
  if (code === 0 && stdout) {
    try {
      const versions = JSON.parse(stdout);
      if (Array.isArray(versions)) {
        // Filter out pre-release versions (beta, alpha, rc, etc.)
        const stableVersions = versions.filter((v: string) => {
          // Exclude versions with pre-release identifiers
          return !v.includes('-') && !v.includes('beta') && !v.includes('alpha') && !v.includes('rc');
        });
        
        if (stableVersions.length > 0) {
          // Sort versions and get the latest stable one
          stableVersions.sort((a, b) => {
            const aParts = a.split('.').map(Number);
            const bParts = b.split('.').map(Number);
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
              const aPart = aParts[i] || 0;
              const bPart = bParts[i] || 0;
              if (aPart !== bPart) return aPart - bPart;
            }
            return 0;
          });
          ver = stableVersions[stableVersions.length - 1];
        }
      }
    } catch {
      // Fallback: try to get the latest version without filtering
      const { code: fallbackCode, stdout: fallbackStdout } = await run("npm", ["view", pkgName, "version"], process.cwd());
      if (fallbackCode === 0 && fallbackStdout) {
        const fallbackVer = fallbackStdout.trim();
        // Only use it if it's not a pre-release version
        if (!fallbackVer.includes('-') && !fallbackVer.includes('beta') && !fallbackVer.includes('alpha') && !fallbackVer.includes('rc')) {
          ver = fallbackVer;
        }
      }
    }
  }

  latestCache.set(pkgName, ver);
  return ver;
}

export async function getPeerDeps(name: string, version: string) {
  const spec = version ? `${name}@${version}` : name;
  const { code, stdout } = await run("npm", ["view", spec, "--json"], process.cwd());
  if (code !== 0) return null;
  try {
    const obj = JSON.parse(stdout || "{}") || {};
    return {
      peerDependencies: obj.peerDependencies || {},
      peerDependenciesMeta: obj.peerDependenciesMeta || {},
    };
  } catch {
    return { peerDependencies: {}, peerDependenciesMeta: {} };
  }
}

export function clearLatestCache() {
  latestCache.clear();
}
