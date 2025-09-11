import { PackageJson } from "../models/package-json.interface.js";

export const extractAngularVersion = (packageJson: PackageJson): string | undefined => {
    const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies
    };

    return allDeps['@angular/core'] || allDeps['@angular/cli'];
}