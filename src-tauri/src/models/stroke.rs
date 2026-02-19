use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stroke {
    pub stroke_id: String,
    pub project_id: String,
    pub effect_id: String,
    pub user_input: HashMap<String, serde_json::Value>,
    pub stroke_input: StrokeInput,
    #[serde(default)]
    pub processing_status: String,
    #[serde(default)]
    pub created: bool,
    #[serde(default)]
    pub effect_received: bool,
    #[serde(default)]
    pub effect_processed: bool,
    #[serde(default)]
    pub effect_success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrokeInput {
    #[serde(default)]
    pub path: Vec<Vec<f64>>,
    #[serde(default)]
    pub clicks: Vec<Vec<f64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_rgba: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunEffectRequest {
    pub stroke_id: String,
    pub project_id: String,
    pub effect_id: String,
    pub user_input: HashMap<String, serde_json::Value>,
    pub stroke_input: StrokeInputForServer,
    pub input_image_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrokeInputForServer {
    pub path: Vec<Vec<f64>>,
    #[serde(default)]
    pub clicks: Vec<Vec<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunEffectResponse {
    pub success: bool,
    pub stroke_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_image_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrokeStatusResponse {
    pub stroke_id: String,
    pub status: String,
}

/// Stroke info sent to the frontend (without large data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrokeInfo {
    pub stroke_id: String,
    pub project_id: String,
    pub effect_id: String,
    pub user_input: HashMap<String, serde_json::Value>,
    pub processing_status: String,
    pub has_output: bool,
}
