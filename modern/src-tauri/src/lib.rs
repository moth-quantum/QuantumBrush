use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

struct AppState {
    root: PathBuf,
    python: PathBuf,
}

#[derive(Debug, Serialize, Clone)]
pub struct EffectSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub user_input: Value,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProjectMeta {
    pub project_id: String,
    pub project_name: String,
    pub modified_time: i64,
    pub status: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct StrokeSummary {
    pub stroke_id: String,
    pub effect_id: String,
    pub effect_name: String,
    pub processing_status: String,
    pub effect_success: Option<bool>,
    pub error_message: Option<String>,
    pub input_path: String,
    pub output_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathPoint {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Deserialize)]
pub struct DrawPath {
    pub click: PathPoint,
    pub points: Vec<PathPoint>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStrokeArgs {
    pub project_id: String,
    pub effect_id: String,
    pub parameters: Value,
    pub paths: Vec<DrawPath>,
}

fn find_app_root() -> PathBuf {
    if let Ok(root) = std::env::var("QUANTUMBRUSH_ROOT") {
        let p = PathBuf::from(&root);
        if p.join("effect/apply_effect.py").is_file() {
            return p;
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        let mut dir = cwd.clone();
        for _ in 0..6 {
            if dir.join("effect/apply_effect.py").is_file() {
                return dir;
            }
            if !dir.pop() {
                break;
            }
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.parent().map(Path::to_path_buf).unwrap_or_default();
        for _ in 0..8 {
            if dir.join("effect/apply_effect.py").is_file() {
                return dir;
            }
            if !dir.pop() {
                break;
            }
        }
    }

    PathBuf::from("..")
}

fn resolve_python(root: &Path) -> PathBuf {
    let candidates = if cfg!(windows) {
        vec![
            root.join(".venv/Scripts/python.exe"),
            root.join("modern/.venv/Scripts/python.exe"),
        ]
    } else {
        vec![
            root.join(".venv/bin/python"),
            root.join("modern/.venv/bin/python"),
        ]
    };

    for c in candidates {
        if c.is_file() {
            return c;
        }
    }

    if cfg!(windows) {
        PathBuf::from("python")
    } else {
        PathBuf::from("python3")
    }
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

fn read_json(path: &Path) -> Result<Value, String> {
    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    let tmp = path.with_extension("json.tmp");
    let body = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&tmp, body).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn format_timestamp(ms: i64) -> String {
    chrono::DateTime::from_timestamp_millis(ms)
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

#[tauri::command]
fn get_app_info(state: tauri::State<'_, Mutex<AppState>>) -> Result<Value, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    Ok(json!({
        "root": s.root.to_string_lossy(),
        "python": s.python.to_string_lossy(),
        "root_exists": s.root.join("effect/apply_effect.py").is_file(),
    }))
}

#[tauri::command]
fn list_effects(state: tauri::State<'_, Mutex<AppState>>) -> Result<Vec<EffectSummary>, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let effect_dir = s.root.join("effect");
    if !effect_dir.is_dir() {
        return Err(format!("effect directory not found at {}", effect_dir.display()));
    }

    let mut effects = Vec::new();
    for entry in fs::read_dir(&effect_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            continue;
        }
        let folder = entry.path();
        for req in fs::read_dir(&folder).map_err(|e| e.to_string())? {
            let req = req.map_err(|e| e.to_string())?;
            let name = req.file_name().to_string_lossy().to_string();
            if !name.ends_with("_requirements.json") {
                continue;
            }
            let value = read_json(&req.path())?;
            let id = value
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or(folder.file_name().unwrap().to_str().unwrap_or("unknown"))
                .to_string();
            let display_name = value
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(&id)
                .to_string();
            let description = value
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let user_input = value.get("user_input").cloned().unwrap_or(json!({}));
            effects.push(EffectSummary {
                id,
                name: display_name,
                description,
                user_input,
            });
        }
    }

    effects.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(effects)
}

#[tauri::command]
fn list_projects(state: tauri::State<'_, Mutex<AppState>>) -> Result<Vec<ProjectMeta>, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let metadata_dir = s.root.join("metadata");
    ensure_dir(&metadata_dir)?;

    let mut projects = Vec::new();
    for entry in fs::read_dir(&metadata_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let meta = read_json(&path)?;
        let project_id = meta
            .get("project_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if project_id.is_empty() {
            continue;
        }
        let project_dir = s.root.join("project").join(&project_id);
        let status = if project_dir.is_dir() {
            "normal".to_string()
        } else {
            "missing_project_dir".to_string()
        };
        projects.push(ProjectMeta {
            project_id,
            project_name: meta
                .get("project_name")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled")
                .to_string(),
            modified_time: meta.get("modified_time").and_then(|v| v.as_i64()).unwrap_or(0),
            status,
        });
    }

    projects.sort_by(|a, b| b.modified_time.cmp(&a.modified_time));
    Ok(projects)
}

#[tauri::command]
fn create_project_from_image(
    state: tauri::State<'_, Mutex<AppState>>,
    project_name: String,
    source_image_path: String,
) -> Result<Value, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let source = PathBuf::from(&source_image_path);
    if !source.is_file() {
        return Err(format!("Image not found: {source_image_path}"));
    }

    let project_id = format!("project_{}", chrono::Utc::now().timestamp_millis());
    let project_dir = s.root.join("project").join(&project_id);
    ensure_dir(&project_dir)?;

    let original = project_dir.join("original.png");
    let current = project_dir.join("current.png");
    fs::copy(&source, &original).map_err(|e| e.to_string())?;
    fs::copy(&source, &current).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().timestamp_millis();
    let metadata = json!({
        "project_name": project_name,
        "project_id": project_id,
        "created_time": now,
        "modified_time": now,
    });
    write_json(
        &s.root.join("metadata").join(format!("{project_id}.json")),
        &metadata,
    )?;

    Ok(json!({
        "project_id": project_id,
        "project_name": project_name,
        "image_path": current.to_string_lossy(),
    }))
}

#[tauri::command]
fn open_project(
    state: tauri::State<'_, Mutex<AppState>>,
    project_id: String,
) -> Result<Value, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let project_dir = s.root.join("project").join(&project_id);
    if !project_dir.is_dir() {
        return Err("Project directory not found".into());
    }

    let current = project_dir.join("current.png");
    let original = project_dir.join("original.png");
    let image_path = if current.is_file() {
        current
    } else if original.is_file() {
        original
    } else {
        return Err("No image found in project".into());
    };

    let meta_path = s.root.join("metadata").join(format!("{project_id}.json"));
    if meta_path.is_file() {
        let mut meta = read_json(&meta_path)?;
        if let Some(obj) = meta.as_object_mut() {
            obj.insert(
                "modified_time".into(),
                json!(chrono::Utc::now().timestamp_millis()),
            );
            write_json(&meta_path, &meta)?;
        }
    }

    Ok(json!({
        "project_id": project_id,
        "image_path": image_path.to_string_lossy(),
    }))
}

#[tauri::command]
fn delete_project(
    state: tauri::State<'_, Mutex<AppState>>,
    project_id: String,
) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let project_dir = s.root.join("project").join(&project_id);
    if project_dir.is_dir() {
        fs::remove_dir_all(&project_dir).map_err(|e| e.to_string())?;
    }
    let meta = s.root.join("metadata").join(format!("{project_id}.json"));
    if meta.is_file() {
        fs::remove_file(meta).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn save_project_image(
    state: tauri::State<'_, Mutex<AppState>>,
    project_id: String,
    png_base64: String,
) -> Result<String, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let bytes = STANDARD
        .decode(png_base64.split(',').last().unwrap_or(&png_base64))
        .map_err(|e| e.to_string())?;
    let path = s
        .root
        .join("project")
        .join(&project_id)
        .join("current.png");
    ensure_dir(path.parent().unwrap())?;
    fs::write(&path, bytes).map_err(|e| e.to_string())?;

    let meta_path = s.root.join("metadata").join(format!("{project_id}.json"));
    if meta_path.is_file() {
        let mut meta = read_json(&meta_path)?;
        if let Some(obj) = meta.as_object_mut() {
            obj.insert(
                "modified_time".into(),
                json!(chrono::Utc::now().timestamp_millis()),
            );
            write_json(&meta_path, &meta)?;
        }
    }

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn export_project_image(
    state: tauri::State<'_, Mutex<AppState>>,
    project_id: String,
    destination_path: String,
) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let current = s
        .root
        .join("project")
        .join(&project_id)
        .join("current.png");
    if !current.is_file() {
        return Err("No current image to export".into());
    }
    fs::copy(&current, PathBuf::from(destination_path)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn create_stroke(
    state: tauri::State<'_, Mutex<AppState>>,
    args: CreateStrokeArgs,
) -> Result<String, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let stroke_id = format!("stroke_{}", chrono::Utc::now().timestamp_millis());
    let project_dir = s.root.join("project").join(&args.project_id);
    let stroke_dir = project_dir.join("stroke");
    ensure_dir(&stroke_dir)?;

    let mut path_array = Vec::new();
    let mut clicks_array = Vec::new();
    for p in &args.paths {
        clicks_array.push(json!([
            p.click.x.round() as i64,
            p.click.y.round() as i64
        ]));
        for pt in &p.points {
            path_array.push(json!([pt.x.round() as i64, pt.y.round() as i64]));
        }
    }

    let instructions = json!({
        "stroke_id": stroke_id,
        "project_id": args.project_id,
        "effect_id": args.effect_id,
        "user_input": args.parameters,
        "stroke_input": {
            "real_hardware": false,
            "path": path_array,
            "clicks": clicks_array,
            "input_location": stroke_dir.join(format!("{stroke_id}_input.png")).to_string_lossy(),
            "output_location": stroke_dir.join(format!("{stroke_id}_output.png")).to_string_lossy(),
        },
        "hardware": {
            "provider": "aer",
            "device": "garnet",
            "shots": 1024,
            "optimization_level": 2,
            "max_qpu_seconds": 30.0
        },
        "created": true,
        "effect_received": "null",
        "effect_processed": "null",
        "effect_success": "null",
        "processing_status": "pending"
    });

    let instructions_path = stroke_dir.join(format!("{stroke_id}_instructions.json"));
    write_json(&instructions_path, &instructions)?;

    let current = project_dir.join("current.png");
    let input = stroke_dir.join(format!("{stroke_id}_input.png"));
    if current.is_file() {
        fs::copy(&current, &input).map_err(|e| e.to_string())?;
    } else {
        return Err("Project has no current image".into());
    }

    Ok(stroke_id)
}

#[tauri::command]
fn list_strokes(
    state: tauri::State<'_, Mutex<AppState>>,
    project_id: String,
) -> Result<Vec<StrokeSummary>, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let stroke_dir = s.root.join("project").join(&project_id).join("stroke");
    if !stroke_dir.is_dir() {
        return Ok(vec![]);
    }

    let mut effect_map = std::collections::HashMap::new();
    if let Ok(effects) = fs::read_dir(s.root.join("effect")) {
        for entry in effects.flatten() {
            if !entry.path().is_dir() {
                continue;
            }
            let folder = entry.path();
            for req in fs::read_dir(&folder).into_iter().flatten().flatten() {
                let name = req.file_name().to_string_lossy().to_string();
                if !name.ends_with("_requirements.json") {
                    continue;
                }
                if let Ok(value) = read_json(&req.path()) {
                    let id = value
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let display = value
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or(&id)
                        .to_string();
                    if !id.is_empty() {
                        effect_map.insert(id, display);
                    }
                }
            }
        }
    }

    let mut strokes = Vec::new();
    for entry in fs::read_dir(&stroke_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with("_instructions.json") {
            continue;
        }
        let stroke_id = name.trim_end_matches("_instructions.json").to_string();
        let instr = read_json(&entry.path())?;
        let effect_id = instr
            .get("effect_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let processing_status = instr
            .get("processing_status")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let effect_success = instr.get("effect_success").map(|v| match v {
            Value::Bool(b) => Some(*b),
            Value::String(s) => Some(s == "true"),
            _ => None,
        });
        let error_message = instr
            .get("error_message")
            .and_then(|v| v.as_str())
            .map(String::from);

        strokes.push(StrokeSummary {
            stroke_id: stroke_id.clone(),
            effect_id: effect_id.clone(),
            effect_name: effect_map
                .get(&effect_id)
                .cloned()
                .unwrap_or(effect_id),
            processing_status,
            effect_success,
            error_message,
            input_path: stroke_dir
                .join(format!("{stroke_id}_input.png"))
                .to_string_lossy()
                .to_string(),
            output_path: stroke_dir
                .join(format!("{stroke_id}_output.png"))
                .to_string_lossy()
                .to_string(),
        });
    }

    strokes.sort_by(|a, b| a.stroke_id.cmp(&b.stroke_id));
    Ok(strokes)
}

#[tauri::command]
fn run_stroke(
    state: tauri::State<'_, Mutex<AppState>>,
    project_id: String,
    stroke_id: String,
) -> Result<Value, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let instructions_path = s
        .root
        .join("project")
        .join(&project_id)
        .join("stroke")
        .join(format!("{stroke_id}_instructions.json"));

    if !instructions_path.is_file() {
        return Err("Stroke instructions not found".into());
    }

    let mut instr = read_json(&instructions_path)?;
    if let Some(obj) = instr.as_object_mut() {
        obj.insert("processing_status".into(), json!("running"));
        obj.insert("effect_received".into(), json!("null"));
        obj.insert("effect_processed".into(), json!("null"));
        obj.insert("effect_success".into(), json!("null"));
    }
    write_json(&instructions_path, &instr)?;

    let apply_script = s.root.join("effect/apply_effect.py");
    if !apply_script.is_file() {
        return Err(format!(
            "apply_effect.py not found at {}. Set QUANTUMBRUSH_ROOT.",
            apply_script.display()
        ));
    }

    let log_dir = s.root.join("log");
    ensure_dir(&log_dir)?;
    let stderr_log = log_dir.join("python_stderr.log");

    let mut cmd = Command::new(&s.python);
    cmd.current_dir(&s.root)
        .arg(apply_script)
        .arg(&instructions_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Ok(token) = std::env::var("IQM_TOKEN") {
        cmd.env("IQM_TOKEN", token);
    }

    let output = cmd.output().map_err(|e| {
        format!(
            "Failed to run Python ({}): {e}. Run scripts/setup-python.sh first.",
            s.python.display()
        )
    })?;

    if let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&stderr_log)
    {
        let _ = writeln!(file, "--- stroke {stroke_id} ---");
        let _ = file.write_all(&output.stderr);
    }

    let mut instr_after = read_json(&instructions_path)?;
    let mut success = output.status.success()
        && instr_after
            .get("effect_success")
            .map(|v| v == &json!(true) || v == &json!("true"))
            .unwrap_or(false);

    if success {
        if let Some(obj) = instr_after.as_object_mut() {
            obj.insert("processing_status".into(), json!("completed"));
            obj.insert("effect_success".into(), json!("true"));
        }
        write_json(&instructions_path, &instr_after)?;
    } else {
        let status = instr_after
            .get("processing_status")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        if status == "running" {
            if let Some(obj) = instr_after.as_object_mut() {
                obj.insert("processing_status".into(), json!("failed"));
                obj.insert("effect_success".into(), json!("false"));
            }
            write_json(&instructions_path, &instr_after)?;
        }
    }

    let status = instr_after
        .get("processing_status")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(json!({
        "success": success,
        "exit_code": output.status.code(),
        "processing_status": status,
        "stdout": String::from_utf8_lossy(&output.stdout),
        "stderr": String::from_utf8_lossy(&output.stderr),
    }))
}

#[tauri::command]
fn get_stroke_instructions(
    state: tauri::State<'_, Mutex<AppState>>,
    project_id: String,
    stroke_id: String,
) -> Result<Value, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let path = s
        .root
        .join("project")
        .join(&project_id)
        .join("stroke")
        .join(format!("{stroke_id}_instructions.json"));
    read_json(&path)
}

#[tauri::command]
fn delete_stroke(
    state: tauri::State<'_, Mutex<AppState>>,
    project_id: String,
    stroke_id: String,
) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let stroke_dir = s.root.join("project").join(&project_id).join("stroke");
    for suffix in ["_instructions.json", "_input.png", "_output.png"] {
        let p = stroke_dir.join(format!("{stroke_id}{suffix}"));
        if p.is_file() {
            fs::remove_file(p).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn format_project_time(timestamp_ms: i64) -> String {
    format_timestamp(timestamp_ms)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let root = find_app_root();
    let python = resolve_python(&root);
    let state = AppState { root, python };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(state))
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            list_effects,
            list_projects,
            create_project_from_image,
            open_project,
            delete_project,
            save_project_image,
            export_project_image,
            create_stroke,
            list_strokes,
            run_stroke,
            get_stroke_instructions,
            delete_stroke,
            format_project_time,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
