import { spawn } from "child_process";
import os from "os";

export async function run(cmd: string, args: string[], cwd: string) {
  const isWindows = os.platform() === "win32";

  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      shell: isWindows, // Important for Windows to support built-in commands like dir
    });

    let out = "", err = "";

    child.stdout?.on("data", d => { out += d.toString().trim(); });
    child.stderr?.on("data", d => { err += d.toString().trim(); });

    // If spawn fails (e.g., ENOENT or EACCES)
    child.once("error", (e) => {
      resolve({ code: 127, stdout: out, stderr: String(e?.message ?? e) });
    });

    child.once("close", (code) => {
      resolve({ code: code ?? 0, stdout: out, stderr: err });
    });
  });
}
