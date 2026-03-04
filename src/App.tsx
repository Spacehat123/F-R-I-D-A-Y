import "./App.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { useJarvis, ProviderType } from "./core/JarvisContext";
import { VoiceEngine } from "./core/VoiceEngine";

// pdfjs is a relatively heavy library but we only use it when a PDF is uploaded
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
// the worker file is required for proper functioning
GlobalWorkerOptions.workerSrc = 
  "https://unpkg.com/pdfjs-dist@3.10.154/build/pdf.worker.min.js";

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

  const { processCommand, attachments, setAttachments } = useJarvis();

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
  async function extractPdfText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += strings.join(" ") + "\n\n";
      }
      return fullText;
    } catch (err) {
      console.error("PDF parsing failed", err);
      return "<unable to extract text from PDF>";
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();

    const file = e.dataTransfer.files[0];
    if (!file) return;

    let text: string;
    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      text = await extractPdfText(file);
    } else {
      text = await file.text();
    }

    const attachment = { name: file.name, content: text };
    setAttachments((prev) => [...prev, attachment]);

    setThinking(true);
    try {
      await processCommand(
        `I've added the contents of ${file.name} to memory.`
      );
    } catch (err) {
      console.error(err);
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // file input reference for the + button
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let text: string;
    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      text = await extractPdfText(file);
    } else {
      text = await file.text();
    }

    const attachment = { name: file.name, content: text };
    setAttachments((prev) => [...prev, attachment]);

    setThinking(true);
    try {
      await processCommand(`I've added the contents of ${file.name} to memory.`);
    } catch (err) {
      console.error(err);
    } finally {
      setThinking(false);
    }
  };

  // ---------- UI ----------

  return (
    <div className="jarvis-container">
      <button className="settings-btn" onClick={() => setShowSettings(true)}>
        ⚙
      </button>
      <button
        className="shutup-btn"
        onClick={() => speechSynthesis.cancel()}
>
        🔇 Shut Up
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

      {/* hidden input used by upload button */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      <button
        className="upload-btn"
        onClick={() => fileInputRef.current?.click()}
        title="Upload file to memory"
      >
        +
      </button>

      <div className="panel left-panel">
        <h3>USER INPUT</h3>
        <p>{transcript}</p>
      </div>

      <div className="panel right-panel">
        <h3>JARVIS RESPONSE</h3>
        <p>{response}</p>
      </div>

      <div className="attachments-panel">
        <h4>Memory Files</h4>
        {attachments.length === 0 ? (
          <p><em>No files loaded</em></p>
        ) : (
          <ul>
            {attachments.map((a, i) => (
              <li key={i}>{a.name}</li>
            ))}
          </ul>
        )}
      </div>
      <div
        className="jarvis-container"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      ></div>


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