import { AngularJson } from "../models/angular-json.interface.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export const readAngularJson = (projectPath: string): AngularJson | null => {
    const angularJsonPath = join(projectPath, 'angular.json');
    if (!existsSync(angularJsonPath)) return null;

    try {
        return JSON.parse(readFileSync(angularJsonPath, 'utf8')) as AngularJson;
    } catch {
        return null;
    }
}