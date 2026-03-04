import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { IntentEngine } from "./IntentEngine";
import { CommandRouter } from "./CommandRouter";

export type ProviderType = "openai" | "ollama" | null;

interface Message {
  role: string;
  content: string;
}

export interface Attachment {
  name: string;
  content: string;
}

interface JarvisState {
  provider: ProviderType;
  listening: boolean;
  thinking: boolean;
  workspace: string | null;
  transcript: string;
  response: string;
  apiKey: string | null;
  model: string;

  attachments: Attachment[];
  history: Message[];

  processCommand: (text: string) => Promise<void>;

  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  setHistory: React.Dispatch<React.SetStateAction<Message[]>>;

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
  const [provider, setProvider] = useState<ProviderType>(() => {
    try {
      const saved = localStorage.getItem("jarvis_provider");
      return (saved as ProviderType) || null;
    } catch {
      return null;
    }
  });
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem("jarvis_apiKey");
    } catch {
      return null;
    }
  });
  const [model, setModel] = useState<string>(() => {
    try {
      return localStorage.getItem("jarvis_model") || "qwen2.5-coder:7b";
    } catch {
      return "qwen2.5-coder:7b";
    }
  });

  const [attachments, setAttachments] = useState<Attachment[]>(() => {
    try {
      const raw = localStorage.getItem("jarvis_attachments");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [history, setHistory] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem("jarvis_history");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  async function processCommand(text: string) {
    setTranscript(text);

    const intent = IntentEngine.detect(text);

    const context = [
      ...history,
      ...attachments.map((a) => ({
        role: "system",
        content: `File context (${a.name}):\n${a.content}`,
      })),
      { role: "user", content: text },
    ];

    const result = await CommandRouter.route(
      intent,
      JSON.stringify(context),
      provider || "ollama",
      apiKey,
      model
    );

    setHistory((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: result },
    ]);

    if (result) {
      setResponse(result);

      // stop previous speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(result);

      const voices = speechSynthesis.getVoices();

      const betterVoice =
        voices.find((v) => v.name.includes("Google")) ||
        voices.find((v) => v.name.includes("Microsoft")) ||
        voices[0];

      if (betterVoice) utterance.voice = betterVoice;

      utterance.rate = 0.95;
      utterance.pitch = 0.9;
      utterance.lang = "en-US";

      speechSynthesis.speak(utterance);
    }
  }

  // persist certain bits of state whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("jarvis_attachments", JSON.stringify(attachments));
    } catch {}
  }, [attachments]);

  useEffect(() => {
    try {
      localStorage.setItem("jarvis_history", JSON.stringify(history));
    } catch {}
  }, [history]);

  useEffect(() => {
    try {
      if (provider) localStorage.setItem("jarvis_provider", provider);
    } catch {}
  }, [provider]);

  useEffect(() => {
    try {
      if (apiKey) localStorage.setItem("jarvis_apiKey", apiKey);
    } catch {}
  }, [apiKey]);

  useEffect(() => {
    try {
      if (model) localStorage.setItem("jarvis_model", model);
    } catch {}
  }, [model]);

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

        attachments,
        history,
        setAttachments,
        setHistory,

        processCommand,

        setProvider,
        setListening,
        setThinking,
        setWorkspace,
        setTranscript,
        setResponse,
        setApiKey,
        setModel,
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