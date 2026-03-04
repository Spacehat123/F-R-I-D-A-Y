export type Intent =
  | "chat"
  | "open_app"
  | "search_web"
  | "coding_help"
  | "read_file"
  | "analyze_file"
  | "unknown";

export interface IntentResult {
  intent: Intent;
  entity?: string;
}

export class IntentEngine {
  static detect(text: string): IntentResult {
    const input = text.toLowerCase().trim();

    // Stop / shut up
    if (input.includes("stop") || input.includes("shut up")) {
      speechSynthesis.cancel();
      return { intent: "chat" };
    }

    // Open app
    if (/^open\s+/.test(input)) {
      return {
        intent: "open_app",
        entity: input.replace(/^open\s+/, "").trim(),
      };
    }

    // Search web
    if (/^search\s+/.test(input)) {
      return {
        intent: "search_web",
        entity: input.replace(/^search\s+/, "").trim(),
      };
    }

    // File analysis keywords
    if (
      input.includes("explain this file") ||
      input.includes("analyze this") ||
      input.includes("what does this file") ||
      input.includes("review this code") ||
      input.includes("summarize this")
    ) {
      return { intent: "analyze_file" };
    }

    // Coding help
    if (
      input.includes("code") ||
      input.includes("bug") ||
      input.includes("function") ||
      input.includes("error") ||
      input.includes("debug") ||
      input.includes("refactor")
    ) {
      return { intent: "coding_help" };
    }

    // Read file (voice command)
    if (input.includes("read file") || input.includes("open file")) {
      return { intent: "read_file" };
    }

    // Default to chat
    return { intent: "chat" };
  }
}