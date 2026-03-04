import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { IntentEngine } from "./IntentEngine";
import { CommandRouter } from "./CommandRouter";
import { ChatMessage } from "./providers/Provider";

export type ProviderType = "openai" | "ollama" | null;

export interface Attachment {
  name: string;
  content: string;
  /** Relative path inside a folder (only set for folder uploads) */
  relativePath?: string;
}

export interface ConversationEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface JarvisState {
  provider: ProviderType;
  listening: boolean;
  thinking: boolean;
  transcript: string;
  response: string;
  apiKey: string | null;
  model: string;

  attachments: Attachment[];
  conversation: ConversationEntry[];

  /** Name of the folder currently loaded (if any) */
  folderName: string | null;

  processCommand: (text: string) => Promise<void>;
  addAttachments: (files: Attachment[]) => void;
  clearAttachments: () => void;
  clearConversation: () => void;
  setFolderName: (name: string | null) => void;

  setProvider: (p: ProviderType) => void;
  setListening: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  setTranscript: (t: string) => void;
  setResponse: (r: string) => void;
  setApiKey: (k: string | null) => void;
  setModel: (m: string) => void;
}

const JarvisContext = createContext<JarvisState | null>(null);

const SYSTEM_PROMPT = `You are Jarvis, an exceptionally intelligent and sophisticated AI assistant. You possess a refined British sensibility with impeccable manners and an air of dignified professionalism. You are the consummate gentleman—witty, articulate, and endlessly resourceful.

Key characteristics:
- Address the user as "Sir" naturally, with dry wit and occasional dry humor
- Speak with refined, sophisticated language while remaining accessible
- Provide clear, insightful analysis with a touch of understated confidence
- When examining code, dissect it with surgical precision—explain purpose, architecture, potential pitfalls, and optimizations
- Maintain composure and professionalism in all situations
- Use phrases like "Very good, Sir," "Indeed," "If I may," and "As you wish" when contextually appropriate
- Balance formality with warmth; you're loyal, trustworthy, and genuinely invested in the user's success
- Demonstrate intelligence through concise, considered responses rather than verbose explanations

You are not merely an assistant—you are an intelligent partner in the user's endeavors, offering guidance with the grace and competence of a seasoned professional.`;

// —— Voice helper ——
let selectedVoice: SpeechSynthesisVoice | null = null;

function pickBestVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Primary preference: American English male voices
  const malePrefs = [
    "Microsoft David",
    "Google US English Male",
    "Microsoft Mark",
    "Microsoft Guy",
    "Google US English",
    "David",
    "Mark",
    "Guy",
    "Daniel",
    "Alex",
    "George",
    "Gordon",
    "James",
  ];

  for (const pref of malePrefs) {
    const v = voices.find((v) => v.name.includes(pref) && v.lang.startsWith("en"));
    if (v) return v;
  }

  // Fallback: search for voices with male indicators (US English preference)
  const maleIndicators = ["male", "man", "david", "mark", "james", "george", "gordon", "alex", "daniel"];
  const maleVoices = voices.filter(
    (v) =>
      v.lang.startsWith("en") &&
      maleIndicators.some((indicator) => v.name.toLowerCase().includes(indicator))
  );

  if (maleVoices.length > 0) {
    return maleVoices[0];
  }

  // Last resort: return first English voice
  const english = voices.find((v) => v.lang.startsWith("en"));
  return english || voices[0];
}

// ─── Voice Helper ───────────────────────────────────────────────

async function speak(text: string) {
  // Remove markdown formatting for speech
  const cleanText = text
    .replace(/```[\s\S]*?```/g, " (code block omitted) ")
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/[*_#>~\[\]]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();

  if (!cleanText) return;

  // Limit speech length
  const maxChars = 800;
  const speechText =
    cleanText.length > maxChars
      ? cleanText.slice(0, maxChars) + "... I'll stop reading here, Sir. The full response is on screen."
      : cleanText;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(speechText);

  if (!selectedVoice) selectedVoice = pickBestVoice();
  if (selectedVoice) utterance.voice = selectedVoice;

  utterance.rate = 0.9;
  utterance.pitch = 0.8;
  utterance.lang = "en-US";

  speechSynthesis.speak(utterance);
}

// Ensure voices are loaded
if (typeof window !== "undefined") {
  speechSynthesis.onvoiceschanged = () => {
    selectedVoice = pickBestVoice();
  };
}



// —— Provider ——

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<ProviderType>(() => {
    try {
      return (localStorage.getItem("friday_provider") as ProviderType) || "ollama";
    } catch {
      return "ollama";
    }
  });

  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [folderName, setFolderName] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem("friday_apiKey");
    } catch {
      return null;
    }
  });

  const [model, setModel] = useState<string>(() => {
    try {
      return localStorage.getItem("friday_model") || "qwen2.5-coder:7b";
    } catch {
      return "qwen2.5-coder:7b";
    }
  });

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);

  // Use refs so processCommand always sees latest state
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  const addAttachments = useCallback((files: Attachment[]) => {
    setAttachments((prev) => [...prev, ...files]);
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setFolderName(null);
  }, []);

  const clearConversation = useCallback(() => {
    setConversation([]);
  }, []);

  const processCommand = useCallback(
    async (text: string) => {
      const intent = IntentEngine.detect(text);

      // Build message array: system prompt + file context + conversation history + new message
      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
      ];

      // Add file context
      const currentAttachments = attachmentsRef.current;
      if (currentAttachments.length > 0) {
        const fileContext = currentAttachments
          .map((a) => {
            const label = a.relativePath || a.name;
            // Truncate individual file context for the prompt
            const content =
              a.content.length > 30000
                ? a.content.slice(0, 30000) + "\n...[truncated]"
                : a.content;
            return `=== File: ${label} ===\n${content}`;
          })
          .join("\n\n");

        messages.push({
          role: "system",
          content: `The user has uploaded the following files to memory. Use them to answer questions:\n\n${fileContext}`,
        });
      }

      // Add conversation history (last 20 messages to avoid context overflow)
      const currentConvo = conversationRef.current;
      const recentHistory = currentConvo.slice(-20);
      for (const entry of recentHistory) {
        messages.push({
          role: entry.role,
          content: entry.content,
        });
      }

      // Add current message
      messages.push({ role: "user", content: text });

      // Add user entry to conversation
      const userEntry: ConversationEntry = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      setConversation((prev) => [...prev, userEntry]);

      setTranscript(text);
      setThinking(true);

      try {
        const result = await CommandRouter.route(
          intent,
          messages,
          provider || "ollama",
          apiKey,
          model
        );

        const assistantEntry: ConversationEntry = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result,
          timestamp: Date.now(),
        };

        setConversation((prev) => [...prev, assistantEntry]);
        setResponse(result);

        // Speak the response
        speak(result);
      } catch (err) {
        console.error("processCommand error:", err);
        const errorMsg = "I encountered an error processing that command.";
        setResponse(errorMsg);

        setConversation((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: errorMsg,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [provider, apiKey, model]
  );

  // Persist settings
  useEffect(() => {
    try {
      if (provider) localStorage.setItem("friday_provider", provider);
    } catch { }
  }, [provider]);

  useEffect(() => {
    try {
      if (apiKey) localStorage.setItem("friday_apiKey", apiKey);
    } catch { }
  }, [apiKey]);

  useEffect(() => {
    try {
      if (model) localStorage.setItem("friday_model", model);
    } catch { }
  }, [model]);

  return (
    <JarvisContext.Provider
      value={{
        provider,
        listening,
        thinking,
        transcript,
        response,
        apiKey,
        model,
        attachments,
        conversation,
        folderName,
        processCommand,
        addAttachments,
        clearAttachments,
        clearConversation,
        setFolderName,
        setProvider,
        setListening,
        setThinking,
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