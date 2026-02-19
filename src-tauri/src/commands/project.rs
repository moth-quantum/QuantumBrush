use crate::models::project::ProjectMetadata;
use crate::services::file_service;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn new_project(
    state: State<'_, AppState>,
    name: String,
    image_path: String,
) -> Result<ProjectMetadata, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    file_service::create_project(&app_dir, &name, &image_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_project(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<ProjectMetadata, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    file_service::load_project_metadata(&app_dir, &project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> Result<Vec<ProjectMetadata>, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    file_service::list_projects(&app_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_project(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<(), String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    file_service::delete_project(&app_dir, &project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_image(
    state: State<'_, AppState>,
    project_id: String,
    export_path: String,
) -> Result<(), String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    file_service::export_image(&app_dir, &project_id, &export_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_current_image(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<String, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    file_service::get_current_image_base64(&app_dir, &project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_app_dir(state: State<'_, AppState>, dir: String) -> Result<(), String> {
    let mut app_dir = state.app_dir.lock().map_err(|e| e.to_string())?;
    *app_dir = dir;
    Ok(())
}
