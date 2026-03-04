import "./App.css";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useJarvis, ProviderType } from "./core/JarvisContext";
import { VoiceEngine } from "./core/VoiceEngine";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

// ─── Types ────────────────────────────────────────────────────────

interface FileEntry {
  path: string;
  name: string;
  content: string;
  is_dir: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  content: string;
  children: TreeNode[];
  depth: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getFileIcon(name: string, isDir: boolean): string {
  if (isDir) return "📁";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const icons: Record<string, string> = {
    ts: "🟦", tsx: "⚛️", js: "🟨", jsx: "⚛️",
    py: "🐍", rs: "🦀", json: "📋", md: "📝",
    html: "🌐", css: "🎨", svg: "🖼️", yaml: "⚙️",
    yml: "⚙️", toml: "⚙️", sql: "🗄️", go: "🔵",
    java: "☕", rb: "💎", php: "🐘", swift: "🍎",
    txt: "📄", csv: "📊", xml: "📰", sh: "🖥️",
    bat: "🖥️", c: "©️", cpp: "©️", h: "📎",
  };
  return icons[ext] || "📄";
}

function buildTree(entries: FileEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode>();

  // Sort: dirs first, then alphabetically
  const sorted = [...entries].sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;
    return a.path.localeCompare(b.path);
  });

  for (const entry of sorted) {
    const parts = entry.path.split("/");
    const node: TreeNode = {
      name: parts[parts.length - 1],
      path: entry.path,
      isDir: entry.is_dir,
      content: entry.content,
      children: [],
      depth: parts.length - 1,
    };
    map.set(entry.path, node);

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      const parent = map.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        root.push(node);
      }
    }
  }

  // Sort children within each dir: dirs first, then alpha
  function sortChildren(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children.length > 0) sortChildren(n.children);
    }
  }
  sortChildren(root);

  return root;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── App Component ────────────────────────────────────────────────

export default function App() {
  const {
    listening,
    thinking,
    transcript,
    response,
    provider,
    model,
    apiKey,
    attachments,
    conversation,
    folderName,
    processCommand,
    addAttachments,
    clearAttachments,
    clearConversation,
    setFolderName,
    setListening,
    setTranscript,
    setResponse,
    setThinking,
    setProvider,
    setModel,
    setApiKey,
  } = useJarvis();

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Refs
  const voiceRef = useRef(new VoiceEngine());
  const recordingRef = useRef(false);
  const convoEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll conversation
  useEffect(() => {
    convoEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, thinking]);

  // Build file tree whenever attachments change
  useEffect(() => {
    if (attachments.length === 0) {
      setFileTree([]);
      return;
    }
    const entries: FileEntry[] = attachments.map((a) => ({
      path: a.relativePath || a.name,
      name: a.name,
      content: a.content,
      is_dir: false,
    }));

    // Synthesize directory entries from paths
    const dirPaths = new Set<string>();
    for (const e of entries) {
      const parts = e.path.split("/");
      for (let i = 1; i < parts.length; i++) {
        dirPaths.add(parts.slice(0, i).join("/"));
      }
    }
    const allEntries: FileEntry[] = [
      ...[...dirPaths].map((d) => ({ path: d, name: d, content: "", is_dir: true })),
      ...entries,
    ];

    setFileTree(buildTree(allEntries));
  }, [attachments]);

  // Toast helper
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── File Upload (single/multiple files) ─────────────────────

  const handleFileUpload = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      setLoadingFiles(true);

      const newAttachments = [];
      for (const filePath of paths) {
        try {
          const content = await invoke<string>("read_file", { path: filePath });
          const fileName = filePath.split(/[\\/]/).pop() || filePath;
          newAttachments.push({ name: fileName, content });
        } catch (err) {
          console.error(`Failed to read ${filePath}:`, err);
          showToast(`Failed to read: ${filePath}`);
        }
      }

      if (newAttachments.length > 0) {
        addAttachments(newAttachments);
        showToast(`${newAttachments.length} file(s) loaded into memory`);
      }
    } catch (err) {
      console.error("File dialog error:", err);
    } finally {
      setLoadingFiles(false);
    }
  }, [addAttachments, showToast]);

  // ─── Folder Upload ───────────────────────────────────────────

  const handleFolderUpload = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (!selected || typeof selected !== "string") return;

      setLoadingFiles(true);
      const dirName = selected.split(/[\\/]/).pop() || "Project";
      setFolderName(dirName);

      try {
        const entries = await invoke<FileEntry[]>("read_folder", {
          path: selected,
        });

        const fileEntries = entries.filter((e) => !e.is_dir);
        const newAttachments = fileEntries.map((e) => ({
          name: e.name.split("/").pop() || e.name,
          content: e.content,
          relativePath: e.path,
        }));

        // Clear previous and add new
        clearAttachments();
        addAttachments(newAttachments);

        // Expand top-level dirs by default
        const topDirs = entries
          .filter((e) => e.is_dir && !e.path.includes("/"))
          .map((e) => e.path);
        setExpandedDirs(new Set(topDirs));

        showToast(`Loaded ${fileEntries.length} files from "${dirName}"`);
      } catch (err) {
        console.error("Folder read error:", err);
        showToast("Failed to read folder");
      }
    } catch (err) {
      console.error("Folder dialog error:", err);
    } finally {
      setLoadingFiles(false);
    }
  }, [addAttachments, clearAttachments, setFolderName, showToast]);

  // ─── Drag & Drop ─────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      setLoadingFiles(true);
      const newAttachments = [];

      for (const file of files) {
        try {
          const text = await file.text();
          newAttachments.push({ name: file.name, content: text });
        } catch (err) {
          console.error(`Failed to read dropped file ${file.name}:`, err);
        }
      }

      if (newAttachments.length > 0) {
        addAttachments(newAttachments);
        showToast(`${newAttachments.length} file(s) dropped into memory`);
      }
      setLoadingFiles(false);
    },
    [addAttachments, showToast]
  );

  // ─── Text Input ────────────────────────────────────────────────

  const handleSendText = useCallback(async () => {
    const text = inputText.trim();
    if (!text || thinking) return;

    setInputText("");
    setThinking(true);
    try {
      await processCommand(text);
    } catch (err) {
      console.error(err);
      setResponse("Command processing error.");
    } finally {
      setThinking(false);
    }
  }, [inputText, thinking, processCommand, setThinking, setResponse]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    },
    [handleSendText]
  );

  // ─── Voice Recording ──────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (recordingRef.current) return;
    recordingRef.current = true;
    setListening(true);

    try {
      await voiceRef.current.start();
    } catch (err) {
      console.error("Failed to start recording:", err);
      recordingRef.current = false;
      setListening(false);
    }
  }, [setListening]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setListening(false);

    try {
      const text = await voiceRef.current.stop();
      if (text && text.trim()) {
        setTranscript(text.trim());
        setThinking(true);
        try {
          await processCommand(text.trim());
        } catch (err) {
          console.error(err);
          setResponse("Command processing error.");
        } finally {
          setThinking(false);
        }
      }
    } catch (err) {
      console.error("Transcription failed:", err);
    }
  }, [setListening, setTranscript, setThinking, setResponse, processCommand]);

  // Mic button handler (toggle)
  const handleMicToggle = useCallback(() => {
    if (recordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  // Keyboard shortcut: hold Space to record
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture space if user is typing in an input
      if (
        e.code === "Space" &&
        !recordingRef.current &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        startRecording();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        recordingRef.current &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startRecording, stopRecording]);

  // ─── File Tree Toggle/Select ───────────────────────────────────

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleFileClick = useCallback(
    async (node: TreeNode) => {
      if (node.isDir) {
        toggleDir(node.path);
        return;
      }
      setSelectedFile(node.path);

      // When file is clicked, offer to analyze it
      if (node.content) {
        setInputText(`Explain the file "${node.name}"`);
        inputRef.current?.focus();
      }
    },
    [toggleDir]
  );

  // ─── Render File Tree ──────────────────────────────────────────

  function renderTreeNodes(nodes: TreeNode[]): React.ReactElement[] {
    const items: React.ReactElement[] = [];

    for (const node of nodes) {
      const isExpanded = expandedDirs.has(node.path);
      const isActive = selectedFile === node.path;

      items.push(
        <div
          key={node.path}
          className={`file-tree-item ${isActive ? "active" : ""}`}
          onClick={() => handleFileClick(node)}
          style={{ paddingLeft: `${16 + node.depth * 16}px` }}
          title={node.path}
        >
          {node.isDir && (
            <span className="file-tree-icon" style={{ fontSize: "10px" }}>
              {isExpanded ? "▼" : "▶"}
            </span>
          )}
          <span className="file-tree-icon">
            {node.isDir
              ? isExpanded
                ? "📂"
                : "📁"
              : getFileIcon(node.name, false)}
          </span>
          <span className="file-tree-name">{node.name}</span>
        </div>
      );

      if (node.isDir && isExpanded && node.children.length > 0) {
        items.push(...renderTreeNodes(node.children));
      }
    }

    return items;
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div
      className="app-layout"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Top Bar ── */}
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="logo-mark">F</div>
          <span className="logo-text">F.R.I.D.A.Y.</span>
          <span className="logo-sub">AI Assistant</span>
        </div>

        <div className="top-bar-right">
          <button
            className="btn btn-icon"
            onClick={() => setSidebarOpen((v) => !v)}
            title="Toggle file explorer"
          >
            {sidebarOpen ? "◧" : "☰"}
          </button>

          <button
            className="btn btn-danger"
            onClick={() => speechSynthesis.cancel()}
            title="Stop speaking"
          >
            🔇 Shut Up
          </button>

          <button
            className="btn"
            onClick={() => {
              clearConversation();
              showToast("Conversation cleared");
            }}
            title="Clear conversation"
          >
            🗑️ Clear
          </button>

          <button
            className="btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* ── Sidebar — File Explorer ── */}
      <div className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        {sidebarOpen && (
          <>
            <div className="sidebar-header">
              <span className="sidebar-title">
                {folderName ? `📂 ${folderName}` : "Explorer"}
              </span>
              <div className="sidebar-actions">
                <button
                  className="btn"
                  onClick={handleFileUpload}
                  title="Upload file(s)"
                  disabled={loadingFiles}
                >
                  📄+
                </button>
                <button
                  className="btn"
                  onClick={handleFolderUpload}
                  title="Open folder"
                  disabled={loadingFiles}
                >
                  📁+
                </button>
                {attachments.length > 0 && (
                  <button
                    className="btn"
                    onClick={() => {
                      clearAttachments();
                      setExpandedDirs(new Set());
                      setSelectedFile(null);
                      showToast("Files cleared");
                    }}
                    title="Clear all files"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="sidebar-body">
              {loadingFiles && (
                <div className="sidebar-empty">
                  <div className="sidebar-empty-icon">⏳</div>
                  <div className="sidebar-empty-text">Reading files...</div>
                </div>
              )}

              {!loadingFiles && attachments.length === 0 && (
                <div className="sidebar-empty">
                  <div className="sidebar-empty-icon">📂</div>
                  <div className="sidebar-empty-text">
                    No files loaded.
                    <br />
                    Use the buttons above to upload files or open a folder, or
                    drag & drop files here.
                  </div>
                </div>
              )}

              {!loadingFiles && fileTree.length > 0 && (
                <div className="file-tree">
                  {renderTreeNodes(fileTree)}
                </div>
              )}

              {!loadingFiles && attachments.length > 0 && (
                <div
                  style={{
                    padding: "10px 16px",
                    borderTop: "1px solid var(--border)",
                    marginTop: "8px",
                  }}
                >
                  <span className="file-count">
                    {attachments.length} file{attachments.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="main-content">
        {/* HUD Core */}
        <div className="hud-area">
          <div className="hud-core">
            <div
              className={`hud-ring ring-outer ${listening ? "listening" : thinking ? "thinking" : ""
                }`}
            />
            <div
              className={`hud-ring ring-mid ${listening ? "listening" : thinking ? "thinking" : ""
                }`}
            />
            <div
              className={`hud-ring ring-inner ${listening ? "listening" : thinking ? "thinking" : ""
                }`}
            />
            <div
              className={`hud-orb ${listening ? "listening" : thinking ? "thinking" : ""
                }`}
            />
          </div>
          <div
            className={`hud-status ${listening ? "listening" : thinking ? "thinking" : ""
              }`}
          >
            {listening
              ? "● LISTENING"
              : thinking
                ? "◉ PROCESSING"
                : "◎ SYSTEM ONLINE"}
          </div>
        </div>

        {/* Conversation */}
        <div className="conversation-area">
          {conversation.length === 0 && !thinking && (
            <div className="conversation-empty">
              <div className="conversation-empty-icon">◉</div>
              <div className="conversation-empty-text">
                Hold <strong>SPACE</strong> to speak, or type below.
                <br />
                Upload files with the sidebar to analyze code.
              </div>
            </div>
          )}

          {conversation.map((entry) => (
            <div
              key={entry.id}
              className={`msg ${entry.role === "user" ? "msg-user" : "msg-assistant"
                }`}
            >
              <span className="msg-label">
                {entry.role === "user" ? "You" : "F.R.I.D.A.Y."}
              </span>
              {entry.content}
              <span className="msg-time">{formatTime(entry.timestamp)}</span>
            </div>
          ))}

          {thinking && (
            <div className="thinking-indicator">
              <div className="thinking-dots">
                <span />
                <span />
                <span />
              </div>
              F.R.I.D.A.Y. is thinking...
            </div>
          )}

          <div ref={convoEndRef} />
        </div>

        {/* Input Bar */}
        <div className="input-bar">
          <button
            className="btn btn-accent btn-icon"
            onClick={handleFileUpload}
            title="Upload files"
            disabled={loadingFiles}
          >
            +
          </button>

          <input
            ref={inputRef}
            type="text"
            className="input-field"
            placeholder="Type a message or hold SPACE to speak..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={thinking}
          />

          <button
            className={`mic-btn ${listening ? "recording" : ""}`}
            onClick={handleMicToggle}
            title={listening ? "Stop recording" : "Start recording"}
          >
            🎤
          </button>

          <button
            className="input-send"
            onClick={handleSendText}
            disabled={!inputText.trim() || thinking}
          >
            Send
          </button>
        </div>

        {thinking && <div className="loading-bar" />}
      </div>

      {/* ── Drag & Drop Overlay ── */}
      {dragging && (
        <div className="drop-zone-overlay">
          <div className="drop-zone-content">
            <div className="drop-zone-icon">📂</div>
            <div className="drop-zone-text">Drop files here</div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <div className="toast">{toast}</div>}

      {/* ── Settings Modal ── */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚙ Settings</h2>

            <label>AI Provider</label>
            <select
              value={provider ?? ""}
              onChange={(e) =>
                setProvider((e.target.value as ProviderType) || null)
              }
            >
              <option value="">Select Provider</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="openai">OpenAI</option>
            </select>

            {provider === "openai" && (
              <>
                <label>API Key</label>
                <input
                  type="password"
                  value={apiKey ?? ""}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </>
            )}

            <label>Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={
                provider === "ollama" ? "qwen2.5-coder:7b" : "gpt-4o"
              }
            />

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowSettings(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}