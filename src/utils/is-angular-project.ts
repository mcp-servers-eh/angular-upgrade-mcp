import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { PackageJson } from "../models/package-json.interface.js";

export const isAngularProject = (projectPath: string): boolean => {
    const packageJsonPath = join(projectPath, 'package.json');
    if (!existsSync(packageJsonPath)) return false;

    try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
        return !!(packageJson.dependencies?.['@angular/core'] || packageJson.devDependencies?.['@angular/core']);
    } catch {
        return false;
    }
}