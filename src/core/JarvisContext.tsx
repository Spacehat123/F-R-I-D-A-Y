import { createContext, useContext, useState, ReactNode } from "react";
import { IntentEngine } from "./IntentEngine"
import { CommandRouter } from "./CommandRouter"
export type ProviderType = "openai" | "ollama" | null;

interface JarvisState {
  provider: ProviderType;
  listening: boolean;
  thinking: boolean;
  workspace: string | null;
  transcript: string;
  response: string;
  apiKey: string | null;
  model: string;

  processCommand: (text: string) => Promise<void>;

  setProvider: (p: ProviderType) => void;
  setListening: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  setWorkspace: (w: string | null) => void;
  setTranscript: (t: string) => void;
  setResponse: (r: string) => void;
  setApiKey: (k: string | null) => void;
  setModel: (m: string) => void;
}

const JarvisContext = createContext<JarvisState | null>(null);

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<ProviderType>(null);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [model, setModel] = useState("qwen2.5-coder:7b");
  async function processCommand(text: string) {

  setTranscript(text)

  const intent = IntentEngine.detect(text)

  const result = await CommandRouter.route(
    intent,
    text,
    provider || "ollama",
    apiKey,
    model
  )

  if (result) {
    setResponse(result)
    // 🔊 STOP previous speech
    speechSynthesis.cancel()

    // 🔊 Create voice response
    const utterance = new SpeechSynthesisUtterance(result)
    // get available voices
    const voices = speechSynthesis.getVoices()
    
    // try to pick a better one
    const betterVoice =
      voices.find(v => v.name.includes("Google")) ||
      voices.find(v => v.name.includes("Microsoft")) ||
      voices[0]


    if (betterVoice) utterance.voice = betterVoice

    utterance.rate = 0.95
    utterance.pitch = 0.9
    utterance.rate = 0.95
    utterance.pitch = 0.9
    utterance.lang = "en-US"
    // 🔊 Speak
    speechSynthesis.speak(utterance)

  }

}


  return (
    <JarvisContext.Provider
      value={{
        provider,
        listening,
        thinking,
        workspace,
        transcript,
        response,
        apiKey,
        model,
        processCommand,
        setProvider,
        setListening,
        setThinking,
        setWorkspace,
        setTranscript,
        setResponse,
        setApiKey,
        setModel
        
      }}
    >
      {children}
    </JarvisContext.Provider>
  );
}

export function useJarvis() {
  const ctx = useContext(JarvisContext);
  if (!ctx) throw new Error("useJarvis must be used inside JarvisProvider");
  return ctx;
}