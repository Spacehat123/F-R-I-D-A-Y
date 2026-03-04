import { LLMProvider } from "./Provider";
import { OllamaProvider } from "./OllamaProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { ProviderType } from "../JarvisContext";

export class ProviderManager {
  static create(
    provider: ProviderType,
    apiKey: string | null,
    model: string
  ): LLMProvider | null {
    if (!provider) return null;

    if (provider === "ollama") {
      return new OllamaProvider(model);
    }

    if (provider === "openai") {
      if (!apiKey) return null;
      return new OpenAIProvider(apiKey, model);
    }

    return null;
  }
}