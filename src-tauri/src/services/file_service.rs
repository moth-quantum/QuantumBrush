use crate::models::project::ProjectMetadata;
use std::fs;
use std::path::Path;

pub fn create_project(
    app_dir: &str,
    name: &str,
    image_path: &str,
) -> Result<ProjectMetadata, Box<dyn std::error::Error + Send + Sync>> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_millis() as u64;

    let project_id = format!("project_{}", timestamp);
    let project_dir = Path::new(app_dir).join("project").join(&project_id);
    let stroke_dir = project_dir.join("stroke");
    let metadata_dir = Path::new(app_dir).join("metadata");

    fs::create_dir_all(&stroke_dir)?;
    fs::create_dir_all(&metadata_dir)?;

    // Copy source image as both original.png and current.png
    let source = Path::new(image_path);
    if !source.exists() {
        return Err(format!("Image file not found: {}", image_path).into());
    }

    fs::copy(source, project_dir.join("original.png"))?;
    fs::copy(source, project_dir.join("current.png"))?;

    let metadata = ProjectMetadata {
        project_name: name.to_string(),
        project_id: project_id.clone(),
        created_time: timestamp,
        modified_time: timestamp,
        status: "normal".to_string(),
    };

    let metadata_path = metadata_dir.join(format!("{}.json", project_id));
    let json = serde_json::to_string_pretty(&metadata)?;
    fs::write(metadata_path, json)?;

    Ok(metadata)
}

pub fn load_project_metadata(
    app_dir: &str,
    project_id: &str,
) -> Result<ProjectMetadata, Box<dyn std::error::Error + Send + Sync>> {
    let metadata_path = Path::new(app_dir)
        .join("metadata")
        .join(format!("{}.json", project_id));

    let content = fs::read_to_string(metadata_path)?;
    let metadata: ProjectMetadata = serde_json::from_str(&content)?;
    Ok(metadata)
}

pub fn list_projects(
    app_dir: &str,
) -> Result<Vec<ProjectMetadata>, Box<dyn std::error::Error + Send + Sync>> {
    let metadata_dir = Path::new(app_dir).join("metadata");

    if !metadata_dir.exists() {
        return Ok(Vec::new());
    }

    let mut projects = Vec::new();

    for entry in fs::read_dir(metadata_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().map(|e| e == "json").unwrap_or(false) {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(mut metadata) = serde_json::from_str::<ProjectMetadata>(&content) {
                    // Validate project directory exists
                    let project_dir =
                        Path::new(app_dir).join("project").join(&metadata.project_id);
                    if !project_dir.exists() {
                        metadata.status = "missing_project_dir".to_string();
                    }
                    projects.push(metadata);
                }
            }
        }
    }

    // Sort by modified_time descending (most recent first)
    projects.sort_by(|a, b| b.modified_time.cmp(&a.modified_time));

    Ok(projects)
}

pub fn delete_project(
    app_dir: &str,
    project_id: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let project_dir = Path::new(app_dir).join("project").join(project_id);
    let metadata_path = Path::new(app_dir)
        .join("metadata")
        .join(format!("{}.json", project_id));

    if project_dir.exists() {
        fs::remove_dir_all(project_dir)?;
    }
    if metadata_path.exists() {
        fs::remove_file(metadata_path)?;
    }

    Ok(())
}

pub fn export_image(
    app_dir: &str,
    project_id: &str,
    export_path: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let current_path = Path::new(app_dir)
        .join("project")
        .join(project_id)
        .join("current.png");

    if !current_path.exists() {
        return Err("Current image not found".into());
    }

    fs::copy(current_path, export_path)?;
    Ok(())
}

pub fn get_current_image_base64(
    app_dir: &str,
    project_id: &str,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let current_path = Path::new(app_dir)
        .join("project")
        .join(project_id)
        .join("current.png");

    if !current_path.exists() {
        return Err("Current image not found".into());
    }

    let bytes = fs::read(current_path)?;
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/png;base64,{}", b64))
}

pub fn update_project_modified_time(
    app_dir: &str,
    project_id: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let metadata_path = Path::new(app_dir)
        .join("metadata")
        .join(format!("{}.json", project_id));

    if metadata_path.exists() {
        let content = fs::read_to_string(&metadata_path)?;
        let mut metadata: ProjectMetadata = serde_json::from_str(&content)?;
        metadata.modified_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis() as u64;
        let json = serde_json::to_string_pretty(&metadata)?;
        fs::write(metadata_path, json)?;
    }

    Ok(())
}
