import { invoke } from "@tauri-apps/api/core"
import PermissionManager from "../../core/PermissionManager"

export async function openApp(app: string) {

  if (!PermissionManager.canOpenApps()) {
    return "System access is disabled."
  }

  if (!app) return "Which app should I open?"

  await invoke("open_app", { app })

  return `Opening ${app}`

}