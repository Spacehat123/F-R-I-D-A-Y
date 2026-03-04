import { IntentResult } from "./IntentEngine"
import { openApp } from "../plugins/system/openApp"
import { searchWeb } from "../plugins/browser/searchWeb"
import { AIProviderRouter } from "./providers/AIProviderRouter"
import { readFile } from "../plugins/system/readFile"

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
      case "read_file":
        return await readFile()

      default:
        return "I didn't understand that."

    }

  }

}