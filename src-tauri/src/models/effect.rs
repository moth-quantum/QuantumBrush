use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Effect {
    pub name: String,
    pub id: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub long_description: Option<String>,
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
    pub user_input: HashMap<String, ParamSpec>,
    pub stroke_input: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub flags: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParamSpec {
    #[serde(rename = "type")]
    pub param_type: String,
    #[serde(default)]
    pub min: Option<f64>,
    #[serde(default)]
    pub max: Option<f64>,
    pub default: serde_json::Value,
}
