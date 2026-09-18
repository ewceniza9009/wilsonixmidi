#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::ipc::Response;

fn allowed_media_dirs() -> &'static Mutex<std::collections::HashSet<PathBuf>> {
    static DIRS: OnceLock<Mutex<std::collections::HashSet<PathBuf>>> = OnceLock::new();
    DIRS.get_or_init(|| Mutex::new(std::collections::HashSet::new()))
}

fn canonical_key(path: &Path) -> Option<PathBuf> {
    std::fs::canonicalize(path)
        .ok()
        .map(|p| p.to_string_lossy().to_lowercase().into())
}

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
            Some(f) => {
                let paths: Vec<PathBuf> = f.into_iter().collect();
                if let Ok(mut dirs) = allowed_media_dirs().lock() {
                    for p in &paths {
                        if let Some(parent) = p.parent() {
                            if let Some(key) = canonical_key(parent) {
                                dirs.insert(key);
                            }
                        }
                    }
                }
                Ok(paths
                    .into_iter()
                    .map(|p| p.to_string_lossy().to_string())
                    .collect())
            }
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
/// media picker/playlist. Blocks traversal segments, null/control characters,
/// unsupported extensions, and any path outside directories the user picked.
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

fn is_within_picked_dirs(path: &Path) -> bool {
    let Some(key) = canonical_key(path) else {
        return false;
    };
    let Ok(dirs) = allowed_media_dirs().lock() else {
        return false;
    };
    let mut parent = PathBuf::from(&key);
    loop {
        if dirs.contains(&parent) {
            return true;
        }
        if !parent.pop() {
            return false;
        }
    }
}

#[tauri::command]
fn read_media(path: String) -> Result<Response, String> {
    if !is_safe_media_path(&path) {
        return Err("read_media rejected: the requested path is not a supported media file".into());
    }
    let p = Path::new(&path);
    if !is_within_picked_dirs(p) {
        return Err("read_media rejected: the requested path was not selected through the media picker".into());
    }
    match std::fs::read(p) {
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