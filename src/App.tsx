import "./App.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { useJarvis, ProviderType } from "./core/JarvisContext";
import { VoiceEngine } from "./core/VoiceEngine";

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

  const { processCommand } = useJarvis();

  const [showSettings, setShowSettings] = useState(false);

  const voiceRef = useRef(new VoiceEngine());
  const recordingRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // ---------- VISUALIZER ----------

  const startVisualizer = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();

    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    audioContextRef.current = audioCtx;
    analyserRef.current = analyser;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2;

        ctx.fillStyle = "#00f7ff";
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth;
      }
    };

    draw();
  };

  const stopVisualizer = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // ---------- KEYBOARD EVENTS ----------

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if (e.code === "Space" && !recordingRef.current) {
        recordingRef.current = true;

        setListening(true);

        try {
          await voiceRef.current.start();
          startVisualizer();
        } catch (err) {
          console.error("failed to start recording", err);
          recordingRef.current = false;
          setListening(false);
        }
      }
    },
    [setListening]
  );

  const handleKeyUp = useCallback(
    async (e: KeyboardEvent) => {
      if (e.code === "Space" && recordingRef.current) {
        recordingRef.current = false;

        setListening(false);
        stopVisualizer();

        let text: string;

        try {
          text = await voiceRef.current.stop();
          setTranscript(text);
        } catch (err) {
          console.error("recording/transcription failed", err);
          return;
        }

        setThinking(true);

        try {
          await processCommand(text);
        } catch (err) {
          console.error("processCommand error", err);
          setResponse("Command processing error.");
        } finally {
          setThinking(false);
        }
      }
    },
    [setListening, setTranscript, setThinking, setResponse, processCommand]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // ---------- UI ----------

  return (
    <div className="jarvis-container">
      <button className="settings-btn" onClick={() => setShowSettings(true)}>
        ⚙
      </button>

      <div className={`hud-ring outer ${listening ? "pulse" : ""}`} />
      <div className={`hud-ring inner ${thinking ? "fast" : ""}`} />

      <canvas
        ref={canvasRef}
        id="voice-visualizer"
        width={200}
        height={200}
        className={`core ${thinking ? "active-core" : ""}`}
      />

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
              placeholder={provider === "ollama" ? "llama3" : "gpt-4o"}
            />

            <div className="settings-actions">
              <button onClick={() => setShowSettings(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}