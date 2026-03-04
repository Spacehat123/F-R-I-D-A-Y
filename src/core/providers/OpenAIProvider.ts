import { LLMProvider, ChatMessage } from "./Provider";

export class OpenAIProvider implements LLMProvider {
  constructor(private apiKey: string, private model: string) { }

  async sendMessages(messages: ChatMessage[]): Promise<string> {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model || "gpt-4o",
          messages,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("OpenAI error:", errText);
        return `OpenAI returned an error (${res.status}). Check your API key and model.`;
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "No response from OpenAI.";
    } catch (err) {
      console.error("OpenAI connection error:", err);
      return "Cannot connect to OpenAI. Check your internet connection.";
    }
  }
}