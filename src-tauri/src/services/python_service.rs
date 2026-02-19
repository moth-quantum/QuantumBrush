use crate::models::stroke::{RunEffectRequest, RunEffectResponse, StrokeStatusResponse};
use std::net::TcpStream;
use std::process::{Child, Command};

const SERVER_PORT: u16 = 8787;
const SERVER_URL: &str = "http://localhost:8787";

pub struct PythonServer {
    process: Child,
}

impl PythonServer {
    pub fn detect_python() -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Check config file for custom path first
        let config_path = std::path::Path::new("config/python_path.txt");
        if config_path.exists() {
            if let Ok(path) = std::fs::read_to_string(config_path) {
                let path = path.trim().to_string();
                if !path.is_empty() {
                    return Ok(path);
                }
            }
        }

        // Try common Python 3 executables
        let candidates = vec![
            "python3",
            "python",
            "python3.12",
            "python3.11",
            "python3.10",
        ];

        for candidate in candidates {
            if let Ok(output) = Command::new(candidate).arg("--version").output() {
                if output.status.success() {
                    let version = String::from_utf8_lossy(&output.stdout).to_string();
                    let version = version.trim().to_string();

                    // Check it's Python 3.10+
                    if let Some(ver_str) = version.strip_prefix("Python ") {
                        let parts: Vec<&str> = ver_str.split('.').collect();
                        if parts.len() >= 2 {
                            if let (Ok(major), Ok(minor)) =
                                (parts[0].parse::<u32>(), parts[1].parse::<u32>())
                            {
                                if major == 3 && minor >= 10 {
                                    return Ok(candidate.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }

        Err("Python 3.10+ not found. Please install Python 3.10 or newer.".into())
    }

    fn detect_python_for_app(app_dir: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Prefer .venv inside the app directory
        let venv_python = std::path::Path::new(app_dir).join(".venv/bin/python3");
        if venv_python.exists() {
            return Ok(venv_python.to_string_lossy().to_string());
        }
        let venv_python = std::path::Path::new(app_dir).join(".venv/bin/python");
        if venv_python.exists() {
            return Ok(venv_python.to_string_lossy().to_string());
        }
        // Fall back to system detection
        Self::detect_python()
    }

    pub fn start(app_dir: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let python = Self::detect_python_for_app(app_dir)?;
        let server_script = std::path::Path::new(app_dir).join("effect/effect_server.py");

        if !server_script.exists() {
            return Err(format!(
                "Server script not found at {}",
                server_script.display()
            )
            .into());
        }

        let process = Command::new(&python)
            .arg(&server_script)
            .arg("--port")
            .arg(SERVER_PORT.to_string())
            .current_dir(app_dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        // Wait for server to become available using a plain TCP connect
        // (avoids reqwest::blocking which can't run inside tokio)
        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(15);
        let addr = format!("127.0.0.1:{}", SERVER_PORT);

        while start.elapsed() < timeout {
            std::thread::sleep(std::time::Duration::from_millis(500));

            if TcpStream::connect_timeout(
                &addr.parse().unwrap(),
                std::time::Duration::from_secs(1),
            )
            .is_ok()
            {
                eprintln!("Python server is accepting connections on port {}", SERVER_PORT);
                return Ok(PythonServer { process });
            }
        }

        Err("Python server failed to start within 15 seconds".into())
    }

    pub fn stop(mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let _ = self.process.kill();
        let _ = self.process.wait();
        Ok(())
    }

    pub async fn health_check() -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let client = reqwest::Client::new();
        let response = client
            .get(format!("{}/health", SERVER_URL))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await?;
        Ok(response.status().is_success())
    }

    pub async fn run_effect(
        request: RunEffectRequest,
    ) -> Result<RunEffectResponse, Box<dyn std::error::Error + Send + Sync>> {
        let client = reqwest::Client::new();
        let response = client
            .post(format!("{}/run-effect", SERVER_URL))
            .json(&request)
            .timeout(std::time::Duration::from_secs(600)) // 10 min timeout for long effects
            .send()
            .await?;

        let result: RunEffectResponse = response.json().await?;
        Ok(result)
    }

    pub async fn get_status(
        stroke_id: &str,
    ) -> Result<StrokeStatusResponse, Box<dyn std::error::Error + Send + Sync>> {
        let client = reqwest::Client::new();
        let response = client
            .get(format!("{}/status/{}", SERVER_URL, stroke_id))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await?;

        let result: StrokeStatusResponse = response.json().await?;
        Ok(result)
    }
}
