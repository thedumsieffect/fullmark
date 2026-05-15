mod commands;

use std::sync::Mutex;

use tauri::{Emitter, Manager, RunEvent};

#[derive(Default)]
struct PendingOpenFiles(Mutex<Vec<String>>);

#[tauri::command]
fn take_pending_open_files(pending: tauri::State<'_, PendingOpenFiles>) -> Vec<String> {
    let mut paths = pending
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    std::mem::take(&mut *paths)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(PendingOpenFiles::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            take_pending_open_files,
            commands::fs::atomic_write_text,
            commands::fs::list_dir,
            commands::fs::read_text_file,
            commands::fs::resolve_path,
            commands::fs::walk_workspace,
            commands::launch_services::set_default_markdown_handler,
            commands::launch_services::get_default_markdown_handler,
            commands::launch_services::is_default_markdown_handler,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    #[cfg(target_os = "macos")]
    if let Err(err) = commands::launch_services::register_current_app() {
        eprintln!("failed to register FullMark with Launch Services: {err}");
    }

    app.run(|app_handle, event| {
        if let RunEvent::Opened { urls } = event {
            // Convert any "Open With FullMark" file URLs into plain paths and
            // forward to the frontend. The frontend infers the workspace from
            // the parent directory if no workspace is currently open.
            let paths: Vec<String> = urls
                .iter()
                .filter_map(|u| u.to_file_path().ok())
                .map(|p| p.to_string_lossy().into_owned())
                .collect();

            if !paths.is_empty() {
                let pending = app_handle.state::<PendingOpenFiles>();
                pending
                    .0
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner())
                    .extend(paths);
                let _ = app_handle.emit("open-files", ());
                if let Some(win) = app_handle.get_webview_window("main") {
                    let _ = win.set_focus();
                }
            }
        }
    });
}
