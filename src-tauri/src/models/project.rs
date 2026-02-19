use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub project_name: String,
    pub project_id: String,
    pub created_time: u64,
    pub modified_time: u64,
    #[serde(default = "default_status")]
    pub status: String,
}

fn default_status() -> String {
    "normal".to_string()
}
