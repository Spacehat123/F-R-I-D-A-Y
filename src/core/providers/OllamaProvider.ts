import { LLMProvider, ChatMessage } from "./Provider";

export class OllamaProvider implements LLMProvider {
  constructor(private model: string) { }

  async sendMessages(messages: ChatMessage[]): Promise<string> {
    try {
      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model || "llama3",
          messages,
          stream: false,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Ollama error:", errText);
        return `Ollama returned an error (${res.status}). Make sure Ollama is running and the model "${this.model}" is pulled.`;
      }

      const data = await res.json();
      return data.message?.content ?? "No response from Ollama.";
    } catch (err) {
      console.error("Ollama connection error:", err);
      return "Cannot connect to Ollama. Make sure it's running on localhost:11434.";
    }
  }
}