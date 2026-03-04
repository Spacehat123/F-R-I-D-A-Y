use std::fs;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;

// Maximum file size: 50 MB
const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;
// When a file exceeds this size, truncate the content string
const TRUNCATE_CHARS: usize = 200_000;

// Only skip obvious binary file types to prevent reading massive files
fn should_skip_file(path: &Path) -> bool {
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    
    // Binary/executable/archive extensions to skip
    matches!(
        ext.as_str(),
        "exe" | "dll" | "so" | "dylib" | "o" | "obj" | "a" | "lib"
        | "zip" | "tar" | "gz" | "rar" | "7z" | "iso" | "dmg"
        | "bin" | "dat" | "db" | "sqlite" | "dbf"
        | "png" | "jpg" | "jpeg" | "gif" | "bmp" | "ico" | "webp"
        | "mp3" | "mp4" | "avi" | "mov" | "mkv" | "wav" | "flac" | "aac" | "m4a"
        | "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx"
        | "class" | "pyc" | "pyo" | "out" | "so" | "a"
    )
}

fn read_text_safe(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("Cannot stat {}: {}", path.display(), e))?;
    let size = metadata.len();

    if size > MAX_FILE_SIZE {
        return Err(format!(
            "File too large ({:.1} MB). Maximum is 50 MB.",
            size as f64 / 1_048_576.0
        ));
    }

    // Try UTF-8 first
    match fs::read_to_string(path) {
        Ok(mut content) => {
            if content.len() > TRUNCATE_CHARS {
                content.truncate(TRUNCATE_CHARS);
                content.push_str("\n\n... [truncated – file too large to display fully]");
            }
            Ok(content)
        }
        Err(_) => {
            // Fallback: read as raw bytes and convert lossy
            let mut buf = Vec::new();
            let mut file = File::open(path).map_err(|e| e.to_string())?;
            file.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            let mut content = String::from_utf8_lossy(&buf).to_string();
            if content.len() > TRUNCATE_CHARS {
                content.truncate(TRUNCATE_CHARS);
                content.push_str("\n\n... [truncated – file too large to display fully]");
            }
            Ok(content)
        }
    }
}

// ─── Tauri Commands ─────────────────────────────────────────────

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
        .args(["-m", model_path, "-f", wav_path.to_str().unwrap()])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Whisper execution failed".into());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

#[tauri::command]
fn open_app(app: String) -> Result<(), String> {
    std::process::Command::new(&app)
        .spawn()
        .map_err(|e| format!("Failed to open {}: {}", app, e))?;
    Ok(())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    read_text_safe(p)
}

#[derive(serde::Serialize)]
struct FileEntry {
    path: String,
    name: String,
    content: String,
    is_dir: bool,
}

#[tauri::command]
async fn read_folder(path: String) -> Result<Vec<FileEntry>, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut entries: Vec<FileEntry> = Vec::new();
    collect_files(&root, &root, &mut entries);

    Ok(entries)
}

fn collect_files(root: &Path, current: &Path, entries: &mut Vec<FileEntry>) {
    let Ok(dir) = fs::read_dir(current) else {
        return;
    };

    for entry in dir.flatten() {
        let path = entry.path();
        let name = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string()
            .replace('\\', "/");

        if path.is_dir() {
            // Skip hidden dirs, node_modules, .git, target, dist, etc.
            let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
            if dir_name.starts_with('.')
                || dir_name == "node_modules"
                || dir_name == "target"
                || dir_name == "dist"
                || dir_name == "__pycache__"
                || dir_name == ".git"
                || dir_name == "build"
            {
                continue;
            }

            entries.push(FileEntry {
                path: name.clone(),
                name: name.clone(),
                content: String::new(),
                is_dir: true,
            });

            collect_files(root, &path, entries);
        } else if !should_skip_file(&path) {
            let content = read_text_safe(&path).unwrap_or_else(|e| format!("<error: {}>", e));
            entries.push(FileEntry {
                path: name.clone(),
                name: name.clone(),
                content,
                is_dir: false,
            });
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_temp_audio,
            transcribe_audio,
            open_app,
            read_file,
            read_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}