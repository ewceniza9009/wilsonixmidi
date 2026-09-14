#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::Path;
use tauri::ipc::Response;

#[tauri::command]
async fn pick_media() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let files = rfd::FileDialog::new()
            .set_title("Add media to playlist")
            .add_filter(
                "Audio & Video",
                &[
                    "mp3", "mp4", "m4a", "aac", "wav", "ogg", "oga", "flac", "opus", "webm",
                    "aiff", "wma", "mov", "m4v", "mp2",
                ],
            )
            .add_filter("MP3 Audio", &["mp3"])
            .add_filter("MP4 Video", &["mp4", "mp4v", "m4v", "mov"])
            .add_filter("WAV Audio", &["wav"])
            .add_filter("FLAC Audio", &["flac"])
            .add_filter("Ogg / Opus", &["ogg", "oga", "opus"])
            .add_filter("All files", &["*"])
            .pick_files();
        match files {
            Some(f) => Ok(f
                .into_iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect()),
            None => Ok(Vec::new()),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

const MEDIA_EXTENSIONS: &[&str] = &[
    "mp3", "mp2", "wav", "aif", "aiff", "flac", "ogg", "oga", "opus", "m4a", "aac", "mp4", "m4v",
    "mov", "webm", "wma",
];

/// Only allow reading files that could plausibly have been selected through the
/// media picker/playlist. Blocks traversal segments and null/control characters.
fn is_safe_media_path(path: &str) -> bool {
    if path.is_empty() || path.len() > 4096 {
        return false;
    }
    if path.bytes().any(|b| b < 0x20 || b == 0x7f) {
        return false;
    }
    if path.split(['/', '\\']).any(|seg| seg == "..") {
        return false;
    }
    match Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
    {
        Some(ext) => MEDIA_EXTENSIONS.contains(&ext.as_str()),
        None => false,
    }
}

#[tauri::command]
fn read_media(path: String) -> Result<Response, String> {
    if !is_safe_media_path(&path) {
        return Err("read_media rejected: the requested path is not a supported media file".into());
    }
    match std::fs::read(&path) {
        Ok(bytes) => Ok(Response::new(bytes)),
        Err(e) => Err(format!("{e}")),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![pick_media, read_media])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
