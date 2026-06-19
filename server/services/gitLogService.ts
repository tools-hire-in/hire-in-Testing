import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const MAX_COMMITS = 100;

export async function getCommitsSinceLastRelease(lastSha: string): Promise<string> {
  try {
    let args: string[];
    if (lastSha && lastSha.trim()) {
      args = ["log", "--oneline", `${lastSha.trim()}..HEAD`];
    } else {
      args = ["log", "--oneline", `-n`, String(MAX_COMMITS)];
    }

    const { stdout } = await execFileAsync("git", args, {
      cwd: process.cwd(),
      timeout: 10000,
      maxBuffer: 1024 * 512,
    });

    const lines = stdout.trim().split("\n").filter(Boolean);
    const capped = lines.slice(0, MAX_COMMITS);
    return capped.join("\n");
  } catch (err: any) {
    console.warn("[gitLogService] Could not read git log:", err?.message);
    return "";
  }
}

export async function getHeadSha(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      timeout: 5000,
    });
    return stdout.trim();
  } catch {
    return "";
  }
}
