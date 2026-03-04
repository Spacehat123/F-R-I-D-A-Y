export interface LLMProvider {
  sendMessage(prompt: string): Promise<string>;
}