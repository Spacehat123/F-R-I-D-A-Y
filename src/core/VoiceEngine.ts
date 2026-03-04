import { invoke } from "@tauri-apps/api/core"

export class VoiceEngine {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: BlobPart[] = []

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    this.mediaRecorder = new MediaRecorder(stream)
    this.chunks = []

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data)
    }

    this.mediaRecorder.start()
  }

async stop(): Promise<string> {
  return new Promise((resolve) => {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.onstop = async () => {

      const blob = new Blob(this.chunks, { type: "audio/webm" });

      const arrayBuffer = await blob.arrayBuffer();
      const audioBytes = Array.from(new Uint8Array(arrayBuffer));

      const path = await invoke<string>("save_temp_audio", {
        data: audioBytes
      });

      const text = await invoke<string>("transcribe_audio", {
        path: path
      });

      resolve(text);
    }
    this.mediaRecorder.stop();
  });
}}