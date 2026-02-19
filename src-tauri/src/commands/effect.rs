use crate::models::effect::Effect;
use crate::AppState;
use std::fs;
use std::path::Path;
use tauri::State;

#[tauri::command]
pub async fn load_effects(state: State<'_, AppState>) -> Result<Vec<Effect>, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    let effect_dir = Path::new(&app_dir).join("effect");

    if !effect_dir.exists() {
        return Err("Effect directory not found".to_string());
    }

    let mut effects = Vec::new();

    let entries = fs::read_dir(&effect_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let dir_name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Skip __pycache__ and hidden directories
        if dir_name.starts_with('_') || dir_name.starts_with('.') {
            continue;
        }

        let req_path = path.join(format!("{}_requirements.json", dir_name));

        if req_path.exists() {
            match fs::read_to_string(&req_path) {
                Ok(content) => match serde_json::from_str::<Effect>(&content) {
                    Ok(effect) => effects.push(effect),
                    Err(e) => {
                        eprintln!("Failed to parse {}: {}", req_path.display(), e);
                    }
                },
                Err(e) => {
                    eprintln!("Failed to read {}: {}", req_path.display(), e);
                }
            }
        }
    }

    // Sort by name for consistent ordering
    effects.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(effects)
}
