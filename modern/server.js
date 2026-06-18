const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Config paths
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.PROJECT_DIR || path.join(WORKSPACE_DIR, 'project');
const METADATA_DIR = process.env.METADATA_DIR || path.join(WORKSPACE_DIR, 'metadata');
const EFFECT_DIR = process.env.EFFECT_DIR || path.join(WORKSPACE_DIR, 'effect');
const LOG_DIR = process.env.LOG_DIR || path.join(WORKSPACE_DIR, 'log');

// Make temp relative to User Data if available
const TEMP_DIR = process.env.PROJECT_DIR ? path.join(process.env.PROJECT_DIR, '../temp') : path.join(__dirname, 'temp');

// Ensure necessary directories exist
[PROJECT_DIR, METADATA_DIR, LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// In-memory hardware configuration
let hardwareConfig = {
  provider: 'IQM',
  device: 'garnet',
  shots: 1000,
  optimization_level: 2,
  max_qpu_seconds: 10,
  token: ''
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static project files
app.use('/project', express.static(PROJECT_DIR));
// Serve static effects files (for requirements and info)
app.use('/effect', express.static(EFFECT_DIR));

// Configure upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 1. Projects API
app.get('/api/projects', (req, res) => {
  try {
    if (!fs.existsSync(METADATA_DIR)) {
      return res.json([]);
    }

    const files = fs.readdirSync(METADATA_DIR).filter(f => f.endsWith('.json'));
    const projects = [];

    files.forEach(file => {
      try {
        const filePath = path.join(METADATA_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Validate project directory
        const projDir = path.join(PROJECT_DIR, data.project_id);
        if (fs.existsSync(projDir)) {
          data.status = 'normal';
        } else {
          data.status = 'missing_project_dir';
        }
        projects.push(data);
      } catch (err) {
        console.error('Error reading metadata file:', file, err);
      }
    });

    // Sort by modified time (most recent first)
    projects.sort((a, b) => b.modified_time - a.modified_time);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', upload.single('image'), (req, res) => {
  try {
    const { name } = req.body;
    const file = req.file;

    if (!name || !file) {
      return res.status(400).json({ error: 'Project name and image file are required' });
    }

    const projectId = `project_${Date.now()}`;
    const projDir = path.join(PROJECT_DIR, projectId);
    const strokeDir = path.join(projDir, 'stroke');
    fs.mkdirSync(strokeDir, { recursive: true });

    // Save image files
    const originalDest = path.join(projDir, 'original.png');
    const currentDest = path.join(projDir, 'current.png');
    
    fs.copyFileSync(file.path, originalDest);
    fs.copyFileSync(file.path, currentDest);
    
    // Remove temp file
    fs.unlinkSync(file.path);

    // Save metadata
    const currentTime = Date.now();
    const metadata = {
      project_name: name,
      project_id: projectId,
      created_time: currentTime,
      modified_time: currentTime
    };

    fs.writeFileSync(
      path.join(METADATA_DIR, `${projectId}.json`),
      JSON.stringify(metadata, null, 2)
    );

    res.json({ success: true, projectId, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id', (req, res) => {
  try {
    const projectId = req.params.id;
    const metadataPath = path.join(METADATA_DIR, `${projectId}.json`);
    
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    // Load strokes list
    const strokeDir = path.join(PROJECT_DIR, projectId, 'stroke');
    const strokes = [];

    if (fs.existsSync(strokeDir)) {
      const files = fs.readdirSync(strokeDir).filter(f => f.endsWith('_instructions.json'));
      files.forEach(file => {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(strokeDir, file), 'utf8'));
          strokes.push(content);
        } catch (err) {
          console.error('Error parsing stroke instructions:', file, err);
        }
      });
    }

    // Sort strokes by timestamp in id
    strokes.sort((a, b) => {
      const timeA = parseInt(a.stroke_id.split('_')[1]) || 0;
      const timeB = parseInt(b.stroke_id.split('_')[1]) || 0;
      return timeA - timeB;
    });

    res.json({
      metadata,
      strokes,
      originalUrl: `/project/${projectId}/original.png`,
      currentUrl: `/project/${projectId}/current.png`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', (req, res) => {
  try {
    const projectId = req.params.id;
    const metadataPath = path.join(METADATA_DIR, `${projectId}.json`);
    const projDir = path.join(PROJECT_DIR, projectId);

    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }

    if (fs.existsSync(projDir)) {
      fs.rmSync(projDir, { recursive: true, force: true });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update canvas image directly (uploaded from frontend after drawing/apply)
app.post('/api/projects/:id/current', (req, res) => {
  try {
    const projectId = req.params.id;
    const { image } = req.body; // Base64 data url

    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const projDir = path.join(PROJECT_DIR, projectId);
    if (!fs.existsSync(projDir)) {
      return res.status(404).json({ error: 'Project directory does not exist' });
    }

    const base64Data = image.replace(/^data:image\/png;base64,/, '');
    const currentDest = path.join(projDir, 'current.png');
    
    fs.writeFileSync(currentDest, base64Data, 'base64');

    // Update metadata time
    const metadataPath = path.join(METADATA_DIR, `${projectId}.json`);
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      metadata.modified_time = Date.now();
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Effects API
app.get('/api/effects', (req, res) => {
  try {
    if (!fs.existsSync(EFFECT_DIR)) {
      return res.json([]);
    }

    const dirs = fs.readdirSync(EFFECT_DIR).filter(file => {
      return fs.statSync(path.join(EFFECT_DIR, file)).isDirectory() && !file.startsWith('.') && file !== '__pycache__';
    });

    const effects = [];

    dirs.forEach(dirName => {
      const reqPath = path.join(EFFECT_DIR, dirName, `${dirName}_requirements.json`);
      if (fs.existsSync(reqPath)) {
        try {
          const reqData = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
          effects.push(reqData);
        } catch (err) {
          console.error('Error reading requirements file for:', dirName, err);
        }
      }
    });

    res.json(effects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Strokes API
app.post('/api/projects/:projectId/strokes', (req, res) => {
  try {
    const { projectId } = req.params;
    const { strokeId, effectId, userInput, pathData, clicksData, inputImageBase64 } = req.body;

    const strokeDir = path.join(PROJECT_DIR, projectId, 'stroke');
    if (!fs.existsSync(strokeDir)) {
      fs.mkdirSync(strokeDir, { recursive: true });
    }

    // --- Issue #47: in-memory transport ---
    // Strip the data URL prefix to get the raw base64 string.
    // We embed it directly into the instruction JSON as `image_b64`.
    // Python's apply_effect.py detects this key and decodes the image
    // in memory without ever writing a PNG to disk.
    const rawBase64 = inputImageBase64.replace(/^data:image\/png;base64,/, '');

    // Create hardware snapshot if provider is IQM
    let hardwareSnapshot = null;
    if (hardwareConfig.provider) {
      hardwareSnapshot = {
        provider: hardwareConfig.provider,
        device: hardwareConfig.device,
        shots: hardwareConfig.shots,
        optimization_level: hardwareConfig.optimization_level,
        max_qpu_seconds: hardwareConfig.max_qpu_seconds
      };
    }

    // Build instructions JSON (exact structure expected by apply_effect.py)
    const instructions = {
      stroke_id: strokeId,
      project_id: projectId,
      effect_id: effectId,
      // Embed raw base64 PNG — Python decodes in memory (Issue #47)
      image_b64: rawBase64,
      user_input: userInput,
      stroke_input: {
        real_hardware: hardwareConfig.provider !== 'local_simulator',
        path: pathData,
        clicks: clicksData
      },
      created: true,
      effect_received: 'null',
      effect_processed: 'null',
      effect_success: 'null',
      processing_status: 'pending'
    };

    if (hardwareSnapshot) {
      instructions.hardware = hardwareSnapshot;
    }

    const instPath = path.join(strokeDir, `${strokeId}_instructions.json`);
    fs.writeFileSync(instPath, JSON.stringify(instructions, null, 2));

    res.json({ success: true, strokeId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Run python effect via Server-Sent Events (SSE) to stream live terminal stdout/stderr
app.get('/api/projects/:projectId/strokes/:strokeId/run', (req, res) => {
  const { projectId, strokeId } = req.params;
  const instPath = path.join(PROJECT_DIR, projectId, 'stroke', `${strokeId}_instructions.json`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  if (!fs.existsSync(instPath)) {
    sendEvent('error', { message: 'Instructions file not found.' });
    return res.end();
  }

  // Update status in JSON to running
  try {
    const inst = JSON.parse(fs.readFileSync(instPath, 'utf8'));
    inst.processing_status = 'running';
    fs.writeFileSync(instPath, JSON.stringify(inst, null, 2));
  } catch (err) {
    sendEvent('error', { message: 'Failed to update instructions status.' });
    return res.end();
  }

  sendEvent('log', { text: `Starting effect script execution for ${strokeId}...\n` });

  // Spawn Python child process
  // Path to apply_effect.py relative to WORKSPACE_DIR (root) is effect/apply_effect.py
  // Pass the absolute path to the instructions file so it works in both dev and packaged modes.
  
  const env = { ...process.env };
  if (hardwareConfig.provider === 'iqm' && hardwareConfig.token) {
    env.IQM_TOKEN = hardwareConfig.token;
  } else {
    delete env.IQM_TOKEN;
  }

  const isPackaged = process.env.IS_PACKAGED === 'true';
  let pyProcess;

  if (isPackaged) {
    // In production, execute the standalone PyInstaller binary
    const exeName = process.platform === 'win32' ? 'apply_effect.exe' : 'apply_effect';
    const exePath = path.join(process.env.EFFECT_DIR, exeName);
    
    // Fallback to python if exe is missing (just in case)
    if (fs.existsSync(exePath)) {
      pyProcess = spawn(exePath, [instPath], {
        cwd: WORKSPACE_DIR,
        env
      });
    } else {
      pyProcess = spawn('python', ['effect/apply_effect.py', instPath], {
        cwd: WORKSPACE_DIR,
        env
      });
    }
  } else {
    // In development, run via python interpreter
    pyProcess = spawn('python', ['effect/apply_effect.py', instPath], {
      cwd: WORKSPACE_DIR,
      env
    });
  }

  // Keep a buffer of logs
  pyProcess.stdout.on('data', (data) => {
    const text = data.toString();
    sendEvent('log', { text });
  });

  pyProcess.stderr.on('data', (data) => {
    const text = data.toString();
    sendEvent('log', { text, error: true });
  });

  pyProcess.on('close', (code) => {
    try {
      // Reload instructions to check outcome
      const inst = JSON.parse(fs.readFileSync(instPath, 'utf8'));

      // --- Issue #47: prefer result_b64 from JSON (in-memory transport) ---
      // If Python encoded the result in-memory, `result_b64` is present.
      // Otherwise fall back to the legacy _output.png file on disk.
      const hasResultB64 = typeof inst.result_b64 === 'string' && inst.result_b64.length > 0;
      const outputPath = path.join(PROJECT_DIR, projectId, 'stroke', `${strokeId}_output.png`);
      const outputFileExists = fs.existsSync(outputPath);

      const isSuccess = code === 0 && inst.effect_success === true && (hasResultB64 || outputFileExists);

      if (isSuccess) {
        inst.processing_status = 'completed';
        inst.effect_received = 'true';
        inst.effect_processed = 'true';
        inst.effect_success = 'true';
        fs.writeFileSync(instPath, JSON.stringify(inst, null, 2));

        if (hasResultB64) {
          // Return base64 output directly — no URL needed
          sendEvent('complete', {
            success: true,
            message: 'Effect completed successfully (in-memory).',
            outputDataUrl: `data:image/png;base64,${inst.result_b64}`
          });
        } else {
          // Legacy: serve the output PNG from disk
          sendEvent('complete', {
            success: true,
            message: 'Effect completed successfully.',
            outputUrl: `/project/${projectId}/stroke/${strokeId}_output.png?t=${Date.now()}`
          });
        }
      } else {
        inst.processing_status = 'failed';
        inst.effect_success = 'false';
        fs.writeFileSync(instPath, JSON.stringify(inst, null, 2));

        sendEvent('complete', {
          success: false,
          message: `Effect script failed with exit code ${code}.`
        });
      }
    } catch (err) {
      sendEvent('complete', { success: false, message: `Failed after close: ${err.message}` });
    }
    res.end();
  });

  // Handle connection closure
  req.on('close', () => {
    if (pyProcess && !pyProcess.killed) {
      pyProcess.kill();
      console.log(`Process killed for stroke ${strokeId} due to client disconnect.`);
    }
  });
});


app.delete('/api/projects/:projectId/strokes/:strokeId', (req, res) => {
  try {
    const { projectId, strokeId } = req.params;
    const strokeDir = path.join(PROJECT_DIR, projectId, 'stroke');
    
    const instFile = path.join(strokeDir, `${strokeId}_instructions.json`);
    const inputFile = path.join(strokeDir, `${strokeId}_input.png`);
    const outputFile = path.join(strokeDir, `${strokeId}_output.png`);

    [instFile, inputFile, outputFile].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Hardware Settings API
app.get('/api/hardware', (req, res) => {
  res.json({
    provider: hardwareConfig.provider,
    device: hardwareConfig.device,
    shots: hardwareConfig.shots,
    optimization_level: hardwareConfig.optimization_level,
    max_qpu_seconds: hardwareConfig.max_qpu_seconds,
    token_configured: !!hardwareConfig.token
  });
});

app.post('/api/hardware', (req, res) => {
  try {
    const { provider, device, shots, optimization_level, max_qpu_seconds, token } = req.body;
    
    hardwareConfig.provider = provider || hardwareConfig.provider;
    hardwareConfig.device = device || hardwareConfig.device;
    hardwareConfig.shots = shots !== undefined ? parseInt(shots) : hardwareConfig.shots;
    hardwareConfig.optimization_level = optimization_level !== undefined ? parseInt(optimization_level) : hardwareConfig.optimization_level;
    hardwareConfig.max_qpu_seconds = max_qpu_seconds !== undefined ? parseInt(max_qpu_seconds) : hardwareConfig.max_qpu_seconds;
    
    if (token !== undefined) {
      hardwareConfig.token = token; // Stored in RAM
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/hardware/clear-token', (req, res) => {
  hardwareConfig.token = '';
  res.json({ success: true });
});

// Export final image to file system
app.post('/api/projects/:id/export', (req, res) => {
  try {
    const projectId = req.params.id;
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Save output in parent workspace directory under exports/ or project/{projectId}/export.png
    const exportsDir = path.join(WORKSPACE_DIR, 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const base64Data = image.replace(/^data:image\/png;base64,/, '');
    const filename = `quantumbrush_${projectId}_${Date.now()}.png`;
    const exportPath = path.join(exportsDir, filename);

    fs.writeFileSync(exportPath, base64Data, 'base64');

    res.json({ success: true, filename, exportPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start listening

// Serve frontend static files
const frontendDist = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

function startServer(port = 0) {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Quantum Brush Modern Express server running on port ${server.address().port}`);
      resolve(server.address().port);
    });
  });
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = startServer;
