import { createContext, useContext, useState, ReactNode } from "react";

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