import { LLMProvider } from "./Provider";

export class OpenAIProvider implements LLMProvider {
  constructor(private apiKey: string, private model: string) {}

  async sendMessage(prompt: string): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model || "gpt-4o",
        messages: [
          { role: "system", content: "You are Jarvis, concise and intelligent." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "No response.";
  }
}