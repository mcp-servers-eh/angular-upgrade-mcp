import { join } from "path";
import { existsSync, statSync, readdirSync } from "fs";

export const analyzeProjectStructure = (projectPath: string): string[] => {
    const structure: string[] = [];

    try {
        const srcPath = join(projectPath, 'src');
        if (existsSync(srcPath) && statSync(srcPath).isDirectory()) {
            const scanDirectory = (dir: string, prefix: string = '') => {
                const items = readdirSync(dir);
                for (const item of items) {
                    const itemPath = join(dir, item);
                    const stat = statSync(itemPath);
                    if (stat.isDirectory()) {
                        structure.push(`${prefix}${item}/`);
                        scanDirectory(itemPath, `${prefix}${item}/`);
                    } else {
                        structure.push(`${prefix}${item}`);
                    }
                }
            };
            scanDirectory(srcPath);
        }
    } catch (error) {
        structure.push('Error reading project structure');
    }

    return structure;
}