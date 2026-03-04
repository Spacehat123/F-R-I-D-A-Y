import { OpenAIProvider } from "./OpenAIProvider"
import { OllamaProvider } from "./OllamaProvider"

export class AIProviderRouter {

  static async generate(
    prompt: string,
    provider: "openai" | "ollama",
    apiKey: string | null,
    model: string
  ): Promise<string> {

    if (provider === "openai" && apiKey) {
      const openai = new OpenAIProvider(apiKey, model)
      return await openai.sendMessage(prompt)
    }

    if (provider === "ollama") {
      const ollama = new OllamaProvider(model)
      return await ollama.sendMessage(prompt)
    }

    return "No AI provider selected."
  }

}