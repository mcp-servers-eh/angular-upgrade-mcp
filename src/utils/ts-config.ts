import { TsConfig } from "../models/ts-config.interface.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export const readTsConfig = (projectPath: string): TsConfig | null => {
    const tsConfigPath = join(projectPath, 'tsconfig.json');
    if (!existsSync(tsConfigPath)) return null;

    try {
        return JSON.parse(readFileSync(tsConfigPath, 'utf8')) as TsConfig;
    } catch {
        return null;
    }
}