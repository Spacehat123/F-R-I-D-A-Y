export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  sendMessages(messages: ChatMessage[]): Promise<string>;
}