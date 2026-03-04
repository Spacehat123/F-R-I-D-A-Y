import { IntentResult } from "./IntentEngine"
import { openApp } from "../plugins/system/openApp"
import { searchWeb } from "../plugins/browser/searchWeb"
import { AIProviderRouter } from "./providers/AIProviderRouter"

export class CommandRouter {

  static async route(
    intent: IntentResult,
    text: string,
    provider: "openai" | "ollama",
    apiKey: string | null,
    model: string
  ) {

    switch (intent.intent) {

      case "open_app":
        return openApp(intent.entity || "")

      case "search_web":
        return searchWeb(intent.entity || "")

      case "coding_help":
        return await AIProviderRouter.generate(
          text,
          provider,
          apiKey,
          model
        )

      case "chat":
        return await AIProviderRouter.generate(
          text,
          provider,
          apiKey,
          model
        )

      default:
        return "I didn't understand that."

    }

  }

}