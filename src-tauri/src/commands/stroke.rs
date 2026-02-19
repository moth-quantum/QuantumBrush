use crate::models::stroke::{
    RunEffectRequest, StrokeInfo, StrokeInputForServer,
    StrokeStatusResponse,
};
use crate::services::{file_service, python_service};
use crate::AppState;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::{Emitter, State, Window};

#[tauri::command]
pub async fn create_stroke(
    state: State<'_, AppState>,
    project_id: String,
    effect_id: String,
    user_input: HashMap<String, Value>,
    paths: Vec<Vec<Vec<f64>>>,
    clicks: Vec<Vec<f64>>,
) -> Result<StrokeInfo, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    let stroke_id = format!("stroke_{}", chrono_timestamp());

    let project_dir = Path::new(&app_dir).join("project").join(&project_id);
    let stroke_dir = project_dir.join("stroke");
    fs::create_dir_all(&stroke_dir).map_err(|e| e.to_string())?;

    // Flatten paths into single array of points
    let flat_path: Vec<Vec<f64>> = paths.into_iter().flatten().collect();

    // Save input image (copy current.png)
    let current_path = project_dir.join("current.png");
    let input_path = stroke_dir.join(format!("{}_input.png", stroke_id));
    fs::copy(&current_path, &input_path).map_err(|e| e.to_string())?;

    // Create stroke instructions JSON
    let instructions = serde_json::json!({
        "stroke_id": stroke_id,
        "project_id": project_id,
        "effect_id": effect_id,
        "user_input": user_input,
        "stroke_input": {
            "path": flat_path,
            "clicks": clicks,
            "image_rgba": "array"
        },
        "stroke_output": {},
        "processing_status": "pending",
        "created": true,
        "effect_received": false,
        "effect_processed": false,
        "effect_success": false
    });

    let instructions_path = stroke_dir.join(format!("{}_instructions.json", stroke_id));
    let json_str = serde_json::to_string_pretty(&instructions).map_err(|e| e.to_string())?;
    fs::write(&instructions_path, json_str).map_err(|e| e.to_string())?;

    Ok(StrokeInfo {
        stroke_id,
        project_id,
        effect_id,
        user_input,
        processing_status: "pending".to_string(),
        has_output: false,
    })
}

#[tauri::command]
pub async fn run_stroke(
    state: State<'_, AppState>,
    window: Window,
    stroke_id: String,
    project_id: String,
) -> Result<(), String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();

    // Load stroke instructions
    let stroke_dir = Path::new(&app_dir)
        .join("project")
        .join(&project_id)
        .join("stroke");
    let instructions_path = stroke_dir.join(format!("{}_instructions.json", stroke_id));

    let content = fs::read_to_string(&instructions_path).map_err(|e| e.to_string())?;
    let mut instructions: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Update status to running
    instructions["processing_status"] = serde_json::json!("running");
    let json_str =
        serde_json::to_string_pretty(&instructions).map_err(|e| e.to_string())?;
    fs::write(&instructions_path, &json_str).map_err(|e| e.to_string())?;

    let effect_id = instructions["effect_id"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let user_input: HashMap<String, Value> =
        serde_json::from_value(instructions["user_input"].clone()).unwrap_or_default();

    let stroke_input_val = &instructions["stroke_input"];
    let path: Vec<Vec<f64>> =
        serde_json::from_value(stroke_input_val["path"].clone()).unwrap_or_default();
    let clicks: Vec<Vec<f64>> =
        serde_json::from_value(stroke_input_val["clicks"].clone()).unwrap_or_default();

    let input_image_path = stroke_dir
        .join(format!("{}_input.png", stroke_id))
        .to_string_lossy()
        .to_string();

    let request = RunEffectRequest {
        stroke_id: stroke_id.clone(),
        project_id: project_id.clone(),
        effect_id,
        user_input,
        stroke_input: StrokeInputForServer { path, clicks },
        input_image_path,
    };

    // Send to Python server
    let sid = stroke_id.clone();
    let pid = project_id.clone();
    let ip = instructions_path.clone();

    tokio::spawn(async move {
        match python_service::PythonServer::run_effect(request).await {
            Ok(response) => {
                // Update instructions file
                if let Ok(content) = fs::read_to_string(&ip) {
                    if let Ok(mut instr) = serde_json::from_str::<serde_json::Value>(&content) {
                        if response.success {
                            instr["processing_status"] = serde_json::json!("completed");
                            instr["effect_success"] = serde_json::json!(true);
                            instr["effect_processed"] = serde_json::json!(true);
                            instr["effect_received"] = serde_json::json!(true);
                        } else {
                            instr["processing_status"] = serde_json::json!("failed");
                            instr["effect_success"] = serde_json::json!(false);
                        }
                        if let Ok(json_str) = serde_json::to_string_pretty(&instr) {
                            let _ = fs::write(&ip, json_str);
                        }
                    }
                }

                let _ = window.emit(
                    "stroke-completed",
                    serde_json::json!({
                        "stroke_id": sid,
                        "project_id": pid,
                        "success": response.success,
                        "error": response.error,
                    }),
                );
            }
            Err(e) => {
                // Update instructions file with failure
                if let Ok(content) = fs::read_to_string(&ip) {
                    if let Ok(mut instr) = serde_json::from_str::<serde_json::Value>(&content) {
                        instr["processing_status"] = serde_json::json!("failed");
                        instr["effect_success"] = serde_json::json!(false);
                        if let Ok(json_str) = serde_json::to_string_pretty(&instr) {
                            let _ = fs::write(&ip, json_str);
                        }
                    }
                }

                let _ = window.emit(
                    "stroke-completed",
                    serde_json::json!({
                        "stroke_id": sid,
                        "project_id": pid,
                        "success": false,
                        "error": e.to_string(),
                    }),
                );
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn apply_stroke(
    state: State<'_, AppState>,
    project_id: String,
    stroke_id: String,
) -> Result<String, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    let project_dir = Path::new(&app_dir).join("project").join(&project_id);
    let stroke_dir = project_dir.join("stroke");

    let output_path = stroke_dir.join(format!("{}_output.png", stroke_id));
    let current_path = project_dir.join("current.png");

    if !output_path.exists() {
        return Err("Stroke output not found. Run the stroke first.".to_string());
    }

    // Alpha-blend output onto current image
    let current_img = image::open(&current_path)
        .map_err(|e| e.to_string())?
        .to_rgba8();
    let output_img = image::open(&output_path)
        .map_err(|e| e.to_string())?
        .to_rgba8();

    let mut result = current_img.clone();

    for (x, y, pixel) in output_img.enumerate_pixels() {
        if pixel[3] > 0 {
            // Non-transparent pixel from output
            if x < result.width() && y < result.height() {
                let bg = result.get_pixel(x, y);
                let blended = alpha_blend(bg, pixel);
                result.put_pixel(x, y, blended);
            }
        }
    }

    result.save(&current_path).map_err(|e| e.to_string())?;

    // Return base64 of new current image
    file_service::get_current_image_base64(&app_dir, &project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_stroke(
    state: State<'_, AppState>,
    project_id: String,
    stroke_id: String,
) -> Result<(), String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    let stroke_dir = Path::new(&app_dir)
        .join("project")
        .join(&project_id)
        .join("stroke");

    // Delete all files for this stroke
    for suffix in &["_instructions.json", "_input.png", "_output.png"] {
        let path = stroke_dir.join(format!("{}{}", stroke_id, suffix));
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn cancel_stroke(
    state: State<'_, AppState>,
    project_id: String,
    stroke_id: String,
) -> Result<(), String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    let stroke_dir = Path::new(&app_dir)
        .join("project")
        .join(&project_id)
        .join("stroke");
    let instructions_path = stroke_dir.join(format!("{}_instructions.json", stroke_id));

    if instructions_path.exists() {
        let content = fs::read_to_string(&instructions_path).map_err(|e| e.to_string())?;
        let mut instr: serde_json::Value =
            serde_json::from_str(&content).map_err(|e| e.to_string())?;
        instr["processing_status"] = serde_json::json!("canceled");
        let json_str = serde_json::to_string_pretty(&instr).map_err(|e| e.to_string())?;
        fs::write(&instructions_path, json_str).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_stroke_status(
    state: State<'_, AppState>,
    project_id: String,
    stroke_id: String,
) -> Result<StrokeStatusResponse, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();

    // Try Python server first
    if let Ok(status) = python_service::PythonServer::get_status(&stroke_id).await {
        return Ok(status);
    }

    // Fall back to reading instructions file
    let instructions_path = Path::new(&app_dir)
        .join("project")
        .join(&project_id)
        .join("stroke")
        .join(format!("{}_instructions.json", stroke_id));

    if instructions_path.exists() {
        let content = fs::read_to_string(&instructions_path).map_err(|e| e.to_string())?;
        let instr: serde_json::Value =
            serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(StrokeStatusResponse {
            stroke_id,
            status: instr["processing_status"]
                .as_str()
                .unwrap_or("unknown")
                .to_string(),
        })
    } else {
        Ok(StrokeStatusResponse {
            stroke_id,
            status: "unknown".to_string(),
        })
    }
}

#[tauri::command]
pub async fn list_strokes(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<StrokeInfo>, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    let stroke_dir = Path::new(&app_dir)
        .join("project")
        .join(&project_id)
        .join("stroke");

    if !stroke_dir.exists() {
        return Ok(Vec::new());
    }

    let mut strokes = Vec::new();

    let entries = fs::read_dir(&stroke_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path
            .file_name()
            .map(|n| n.to_string_lossy().ends_with("_instructions.json"))
            .unwrap_or(false)
        {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(instr) = serde_json::from_str::<serde_json::Value>(&content) {
                    let sid = instr["stroke_id"].as_str().unwrap_or("").to_string();
                    let output_path =
                        stroke_dir.join(format!("{}_output.png", sid));

                    strokes.push(StrokeInfo {
                        stroke_id: sid,
                        project_id: instr["project_id"]
                            .as_str()
                            .unwrap_or("")
                            .to_string(),
                        effect_id: instr["effect_id"]
                            .as_str()
                            .unwrap_or("")
                            .to_string(),
                        user_input: serde_json::from_value(instr["user_input"].clone())
                            .unwrap_or_default(),
                        processing_status: instr["processing_status"]
                            .as_str()
                            .unwrap_or("pending")
                            .to_string(),
                        has_output: output_path.exists(),
                    });
                }
            }
        }
    }

    // Sort by stroke_id (timestamp-based)
    strokes.sort_by(|a, b| a.stroke_id.cmp(&b.stroke_id));

    Ok(strokes)
}

#[tauri::command]
pub async fn update_stroke_params(
    state: State<'_, AppState>,
    project_id: String,
    stroke_id: String,
    user_input: HashMap<String, Value>,
) -> Result<(), String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?.clone();
    let instructions_path = Path::new(&app_dir)
        .join("project")
        .join(&project_id)
        .join("stroke")
        .join(format!("{}_instructions.json", stroke_id));

    let content = fs::read_to_string(&instructions_path).map_err(|e| e.to_string())?;
    let mut instr: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    instr["user_input"] = serde_json::to_value(&user_input).map_err(|e| e.to_string())?;
    instr["processing_status"] = serde_json::json!("pending");
    instr["effect_received"] = serde_json::json!(false);
    instr["effect_processed"] = serde_json::json!(false);
    instr["effect_success"] = serde_json::json!(false);

    let json_str = serde_json::to_string_pretty(&instr).map_err(|e| e.to_string())?;
    fs::write(&instructions_path, json_str).map_err(|e| e.to_string())?;

    // Delete old output
    let output_path = instructions_path
        .parent()
        .unwrap()
        .join(format!("{}_output.png", stroke_id));
    if output_path.exists() {
        let _ = fs::remove_file(output_path);
    }

    Ok(())
}

fn alpha_blend(
    bg: &image::Rgba<u8>,
    fg: &image::Rgba<u8>,
) -> image::Rgba<u8> {
    let fg_a = fg[3] as f32 / 255.0;
    let bg_a = bg[3] as f32 / 255.0;
    let out_a = fg_a + bg_a * (1.0 - fg_a);

    if out_a == 0.0 {
        return image::Rgba([0, 0, 0, 0]);
    }

    let r = ((fg[0] as f32 * fg_a + bg[0] as f32 * bg_a * (1.0 - fg_a)) / out_a) as u8;
    let g = ((fg[1] as f32 * fg_a + bg[1] as f32 * bg_a * (1.0 - fg_a)) / out_a) as u8;
    let b = ((fg[2] as f32 * fg_a + bg[2] as f32 * bg_a * (1.0 - fg_a)) / out_a) as u8;
    let a = (out_a * 255.0) as u8;

    image::Rgba([r, g, b, a])
}

fn chrono_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
