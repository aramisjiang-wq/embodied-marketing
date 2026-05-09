import { spawn } from "child_process";
import path from "path";

const PYTHON = "/opt/homebrew/bin/python3.11";
const SCRIPT = path.join(process.cwd(), "scripts", "collect.py");

export function runCollector(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [SCRIPT], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Collector failed: ${stderr || stdout}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}
