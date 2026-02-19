use crate::services::python_service::PythonServer;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn start_python_server(state: State<'_, AppState>) -> Result<String, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();

    // Check if already running
    {
        let server_lock = state.python_server.lock().map_err(|e| e.to_string())?;
        if server_lock.is_some() {
            return Ok("Server already running".to_string());
        }
    }

    // Start in a blocking task so we don't block the async runtime
    let server = tokio::task::spawn_blocking(move || {
        PythonServer::start(&app_dir)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let mut server_lock = state.python_server.lock().map_err(|e| e.to_string())?;
    *server_lock = Some(server);

    Ok("Server started".to_string())
}

#[tauri::command]
pub async fn stop_python_server(state: State<'_, AppState>) -> Result<String, String> {
    let mut server_lock = state.python_server.lock().map_err(|e| e.to_string())?;

    if let Some(server) = server_lock.take() {
        server.stop().map_err(|e| e.to_string())?;
        Ok("Server stopped".to_string())
    } else {
        Ok("Server not running".to_string())
    }
}

#[tauri::command]
pub async fn check_python_server() -> Result<bool, String> {
    PythonServer::health_check()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn detect_python() -> Result<String, String> {
    PythonServer::detect_python().map_err(|e| e.to_string())
}
