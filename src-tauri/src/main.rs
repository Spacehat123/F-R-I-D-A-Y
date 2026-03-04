use std::fs::File;
use std::io::Write;
use std::process::Command;

#[tauri::command]
async fn save_temp_audio(data: Vec<u8>) -> Result<String, String> {
    let temp_path = std::env::temp_dir().join("jarvis_input.webm");

    let mut file = File::create(&temp_path).map_err(|e| e.to_string())?;
    file.write_all(&data).map_err(|e| e.to_string())?;

    Ok(temp_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn transcribe_audio(path: String) -> Result<String, String> {
    let wav_path = std::env::temp_dir().join("jarvis_input.wav");

    let ffmpeg_status = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            &path,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            wav_path.to_str().unwrap(),
        ])
        .status()
        .map_err(|e| e.to_string())?;

    if !ffmpeg_status.success() {
        return Err("FFmpeg conversion failed".into());
    }

    let whisper_path =
        "D:\\Pranav\\AI\\whisper\\whisper.cpp\\build\\bin\\Release\\whisper-cli.exe";
    let model_path =
        "D:\\Pranav\\AI\\whisper\\whisper.cpp\\ggml-base.en.bin";

    let output = Command::new(whisper_path)
        .args([
            "-m",
            model_path,
            "-f",
            wav_path.to_str().unwrap(),
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Whisper execution failed".into());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

#[tauri::command]
async fn llm_generate(prompt: String, model: String) -> Result<String, String> {
    use serde_json::json;

    let body = json!({
        "model": model,
        "prompt": prompt,
        "stream": false
    });

    let output = Command::new("curl")
        .args([
            "-s",
            "http://127.0.0.1:11434/api/generate",
            "-H",
            "Content-Type: application/json",
            "-d",
            &body.to_string(),
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Ollama request failed".into());
    }

    let response = String::from_utf8_lossy(&output.stdout);
    Ok(response.to_string())
}
#[tauri::command]
fn open_app(app: String) {
    std::process::Command::new(app)
        .spawn()
        .expect("failed to open app");
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    match std::fs::read_to_string(path) {
        Ok(contents) => Ok(contents),
        Err(err) => Err(err.to_string()),
    }
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_temp_audio,
            transcribe_audio,
            llm_generate,
            open_app,
            read_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}