import { join } from 'path';
import { PackageJson } from '../models/package-json.interface.js';
import { existsSync, readFileSync } from 'fs';

export const readPackageJson = (projectPath: string): PackageJson | null => {
    const packageJsonPath = join(projectPath, 'package.json');
    if (!existsSync(packageJsonPath)) return null;

    try {
        return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
    } catch {
        return null;
    }
}