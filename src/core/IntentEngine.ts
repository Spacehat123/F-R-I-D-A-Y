export type Intent =
  | "chat"
  | "open_app"
  | "search_web"
  | "coding_help"
  | "unknown"

export interface IntentResult {
  intent: Intent
  entity?: string
}

export class IntentEngine {

  static detect(text: string): IntentResult {
    const input = text.toLowerCase()

    if (input.includes("open")) {
      return {
        intent: "open_app",
        entity: input.replace("open", "").trim()
      }
    }

    if (input.includes("search")) {
      return {
        intent: "search_web",
        entity: input.replace("search", "").trim()
      }
    }

    if (input.includes("code") || input.includes("bug")) {
      return {
        intent: "coding_help"
      }
    }

    return {
      intent: "chat"
    }
  }

}