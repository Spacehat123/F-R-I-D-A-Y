import { invoke } from "@tauri-apps/api/core";
import PermissionManager from "../../core/PermissionManager";

export async function openApp(app: string): Promise<string> {
  if (!PermissionManager.canOpenApps()) {
    return "System access is disabled. Enable it in permissions.";
  }

  if (!app) return "Which app should I open, Boss?";

  try {
    await invoke("open_app", { app });
    return `Opening ${app}`;
  } catch (err) {
    console.error("openApp error:", err);
    return `Failed to open ${app}: ${err}`;
  }
}