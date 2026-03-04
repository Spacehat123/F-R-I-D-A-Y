import { ChatMessage } from "./Provider";
import { OpenAIProvider } from "./OpenAIProvider";
import { OllamaProvider } from "./OllamaProvider";

export class AIProviderRouter {
  static async generate(
    messages: ChatMessage[],
    provider: "openai" | "ollama",
    apiKey: string | null,
    model: string
  ): Promise<string> {
    if (provider === "openai" && apiKey) {
      const openai = new OpenAIProvider(apiKey, model);
      return await openai.sendMessages(messages);
    }

    if (provider === "ollama") {
      const ollama = new OllamaProvider(model);
      return await ollama.sendMessages(messages);
    }

    return "No AI provider configured. Go to Settings to select Ollama or OpenAI.";
  }
}