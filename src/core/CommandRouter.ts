import { IntentResult } from "./IntentEngine";
import { openApp } from "../plugins/system/openApp";
import { searchWeb } from "../plugins/browser/searchWeb";
import { AIProviderRouter } from "./providers/AIProviderRouter";
import { ChatMessage } from "./providers/Provider";

export class CommandRouter {
  static async route(
    intent: IntentResult,
    messages: ChatMessage[],
    provider: "openai" | "ollama",
    apiKey: string | null,
    model: string
  ): Promise<string> {
    switch (intent.intent) {
      case "open_app":
        return openApp(intent.entity || "");

      case "search_web":
        return searchWeb(intent.entity || "");

      case "analyze_file":
      case "coding_help":
      case "chat":
        return await AIProviderRouter.generate(messages, provider, apiKey, model);

      case "read_file":
        // This is now handled by the UI file picker button;
        // if triggered by voice, just prompt the user.
        return "Use the + button to upload files, or drag and drop them onto the window.";

      default:
        return "I didn't understand that command. Try asking me a question.";
    }
  }
}