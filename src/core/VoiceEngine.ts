export class VoiceEngine {
    private mediaRecorder: MediaRecorder | null = null;
    private chunks: BlobPart[] = [];
  
    async start(): Promise<void> {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
      this.mediaRecorder = new MediaRecorder(stream);
      this.chunks = [];
  
      this.mediaRecorder.ondataavailable = (e) => {
        this.chunks.push(e.data);
      };
  
      this.mediaRecorder.start();
    }
  
    async stop(): Promise<Blob> {
      return new Promise((resolve) => {
        if (!this.mediaRecorder) return;
  
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.chunks, { type: "audio/webm" });
          resolve(blob);
        };
  
        this.mediaRecorder.stop();
      });
    }
  }