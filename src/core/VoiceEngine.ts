import { invoke } from "@tauri-apps/api/core";

export class VoiceEngine {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.start();
  }

  async stop(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No active recording"));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        // Stop all audio tracks to release the mic
        if (this.stream) {
          this.stream.getTracks().forEach((t) => t.stop());
          this.stream = null;
        }

        try {
          const blob = new Blob(this.chunks, { type: "audio/webm" });
          const arrayBuffer = await blob.arrayBuffer();
          const audioBytes = Array.from(new Uint8Array(arrayBuffer));

          const path = await invoke<string>("save_temp_audio", {
            data: audioBytes,
          });

          const text = await invoke<string>("transcribe_audio", {
            path,
          });

          resolve(text);
        } catch (err) {
          reject(err);
        }
      };

      this.mediaRecorder.stop();
    });
  }
}