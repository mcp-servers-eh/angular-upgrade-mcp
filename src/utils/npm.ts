import { run } from "./run.js";

const latestCache = new Map<string, string | undefined>();

export async function getLatestVersion(pkgName: string): Promise<string | undefined> {

  if (latestCache.has(pkgName)) return latestCache.get(pkgName);

  const { code, stdout } = await run("npm", ["view", pkgName, "version"], process.cwd());

  const ver = code === 0 && stdout ? stdout.trim() : undefined;
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
