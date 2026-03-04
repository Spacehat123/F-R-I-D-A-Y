import "./App.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { useJarvis, ProviderType } from "./core/JarvisContext";
import { VoiceEngine } from "./core/VoiceEngine";
import { invoke } from "@tauri-apps/api/core";
import { ProviderManager } from "./core/providers/ProviderManager";

export default function App() {
  const {
    listening,
    thinking,
    transcript,
    response,
    provider,
    model,
    apiKey,
    setListening,
    setTranscript,
    setResponse,
    setThinking,
    setProvider,
    setModel,
    setApiKey,
  } = useJarvis();

  const [showSettings, setShowSettings] = useState(false);

  // stable instances / refs so callbacks don't capture stale values
  const voiceRef = useRef(new VoiceEngine());
  const recordingRef = useRef(false);

  const handleKeyDown = useCallback(async (e: KeyboardEvent) => {
    if (e.code === "Space" && !recordingRef.current) {
      recordingRef.current = true;
      setListening(true);
      try {
        await voiceRef.current.start();
      } catch (err) {
        console.error("failed to start recording", err);
        recordingRef.current = false;
        setListening(false);
      }
    }
  }, [setListening]);

  const handleKeyUp = useCallback(async (e: KeyboardEvent) => {
    if (e.code === "Space" && recordingRef.current) {
      recordingRef.current = false;
      setListening(false);

      let text: string;
      try {
        const audioBlob = await voiceRef.current.stop();
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const filePath = await invoke<string>("save_temp_audio", {
          data: Array.from(uint8Array),
        });

        text = await invoke<string>("transcribe_audio", {
          path: filePath,
        });

        setTranscript(text);
      } catch (err) {
        console.error("recording/transcription failed", err);
        return;
      }

      setThinking(true);

      try {
        let raw: string;

        if (provider === "ollama") {
          raw = await invoke<string>("llm_generate", {
            provider: "ollama",
            prompt: text,
            model: model || "qwen2.5-coder:7b",
          });
        } else if (provider === "openai") {
          const pm = ProviderManager.create(provider, apiKey, model);
          if (!pm) throw new Error("provider configuration missing");
          const resp = await pm.sendMessage(text);
          raw = JSON.stringify({ response: resp });
        } else {
          throw new Error("no provider selected");
        }

        const parsed = JSON.parse(raw);
        setResponse(parsed.response ?? "No response.");
      } catch (err) {
        console.error("LLM error", err);
        setResponse("LLM error.");
      } finally {
        setThinking(false);
      }
    }
  }, [provider, apiKey, model, setListening, setTranscript, setThinking, setResponse]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return (
    <div className="jarvis-container">
      <button className="settings-btn" onClick={() => setShowSettings(true)}>
        ⚙
      </button>

      <div className={`hud-ring outer ${listening ? "pulse" : ""}`} />
      <div className={`hud-ring inner ${thinking ? "fast" : ""}`} />
      <div className={`core ${thinking ? "active-core" : ""}`} />

      <div className="status">
        {listening
          ? "LISTENING..."
          : thinking
          ? "PROCESSING..."
          : "SYSTEM ONLINE"}
      </div>

      <div className="panel left-panel">
        <h3>USER INPUT</h3>
        <p>{transcript}</p>
      </div>

      <div className="panel right-panel">
        <h3>JARVIS RESPONSE</h3>
        <p>{response}</p>
      </div>

      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-modal">
            <h2>JARVIS SETTINGS</h2>

            <label>Provider</label>
            <select
              value={provider ?? ""}
              onChange={(e) =>
                setProvider((e.target.value as ProviderType) || null)
              }
            >
              <option value="">Select Provider</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="openai">OpenAI</option>
            </select>

            {provider === "openai" && (
              <>
                <label>API Key</label>
                <input
                  type="password"
                  value={apiKey ?? ""}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </>
            )}

            <label>Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={
                provider === "ollama" ? "llama3" : "gpt-4o"
              }
            />

            <div className="settings-actions">
              <button onClick={() => setShowSettings(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
