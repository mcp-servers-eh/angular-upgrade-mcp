import { PackageJson } from "../models/package-json.interface.js";

export const extractAngularDependencies = (packageJson: PackageJson): Record<string, string> => {
    const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies
    };

    const angularDeps: Record<string, string> = {};
    for (const [name, version] of Object.entries(allDeps)) {
        if (name.startsWith('@angular/')) {
            angularDeps[name] = version;
        }
    }

    return angularDeps;
}