mod commands;
mod models;
mod services;

use commands::{effect, project, python, stroke};
use services::python_service::PythonServer;
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub python_server: Mutex<Option<PythonServer>>,
    pub app_dir: Mutex<String>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Determine the app root directory.
            // In dev mode, cwd is the project root (where package.json lives).
            // We detect this by checking if effect/ directory exists.
            let cwd = std::env::current_dir().unwrap_or_default();
            let app_dir = if cwd.join("effect").exists() {
                cwd.to_string_lossy().to_string()
            } else if cwd.parent().map(|p| p.join("effect").exists()).unwrap_or(false) {
                // cwd is src-tauri/, go up one level
                cwd.parent().unwrap().to_string_lossy().to_string()
            } else {
                cwd.to_string_lossy().to_string()
            };
            eprintln!("QuantumBrush app_dir: {}", app_dir);

            app.manage(AppState {
                python_server: Mutex::new(None),
                app_dir: Mutex::new(app_dir),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Project commands
            project::new_project,
            project::open_project,
            project::list_projects,
            project::delete_project,
            project::export_image,
            project::get_current_image,
            project::set_app_dir,
            // Effect commands
            effect::load_effects,
            // Python commands
            python::start_python_server,
            python::stop_python_server,
            python::check_python_server,
            python::detect_python,
            // Stroke commands
            stroke::create_stroke,
            stroke::run_stroke,
            stroke::apply_stroke,
            stroke::delete_stroke,
            stroke::cancel_stroke,
            stroke::get_stroke_status,
            stroke::list_strokes,
            stroke::update_stroke_params,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Stop Python server on window close
                let app = window.app_handle();
                if let Some(state) = app.try_state::<AppState>() {
                    if let Ok(mut server) = state.python_server.lock() {
                        if let Some(srv) = server.take() {
                            let _ = srv.stop();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
