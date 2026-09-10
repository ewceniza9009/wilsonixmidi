#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

#[tauri::command]
fn read_media(path: String) -> Result<Response, String> {
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