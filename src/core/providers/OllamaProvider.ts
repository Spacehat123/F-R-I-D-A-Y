import { LLMProvider } from "./Provider";

export class OllamaProvider implements LLMProvider {
  constructor(private model: string) {}

  async sendMessage(prompt: string): Promise<string> {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model || "llama3",
        prompt,
        stream: false,
      }),
    });

    const data = await res.json();
    return data.response;
  }
}