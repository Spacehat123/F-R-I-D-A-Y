import { open } from "@tauri-apps/plugin-dialog"
import { invoke } from "@tauri-apps/api/core"

export async function readFile() {

  const selected = await open({
    multiple: false,
    filters: [
      { name: "Text", extensions: ["txt", "md", "js", "ts", "py", "json"] }
    ]
  })

  if (!selected) return "No file selected."
  

  const content = await invoke<string>("read_file", {
    path: selected
  })

  return content
}