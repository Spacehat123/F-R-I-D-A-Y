# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Jarvis Features

- **Conversation memory**: Jarvis retains the chat history and any uploaded files.  History and attachments persist across restarts via localStorage.
- **File upload**: Click the **+** button (or drag-and-drop) to add a file. Jarvis will read its contents and include them in the context for future responses.
  - PDF files are parsed using a lightweight PDF library so text can be extracted automatically.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
