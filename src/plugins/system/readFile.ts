import { invoke } from "@tauri-apps/api/core";

/**
 * Read a single file via the Rust backend.
 * The path should be an absolute path on the filesystem.
 */
export async function readFile(path: string): Promise<string> {
  try {
    const content = await invoke<string>("read_file", { path });
    return content;
  } catch (err) {
    console.error("readFile error:", err);
    return `Error reading file: ${err}`;
  }
}