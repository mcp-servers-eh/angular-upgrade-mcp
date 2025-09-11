import { execSync } from "child_process";

export const getLatestVersion = async (packageName: string) => {
    const latest = execSync(`npm view ${packageName} version`, { stdio: ["pipe", "pipe", "ignore"] })
    return latest.toString().trim();
};