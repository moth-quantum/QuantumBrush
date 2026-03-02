import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { runPythonEffect, loadEffectDefinitions } from './python'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

const APP_ROOT = process.env.APP_ROOT

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Quantum Brush',
webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  registerIpcHandlers()
  buildAppMenu()
})

/**
 * Aggregate all unique Python package names from every effect's _requirements.json.
 * Maps import names to pip names where they differ (e.g. PIL → Pillow).
 */
async function collectEffectDependencies(appRoot: string): Promise<string[]> {
  const pythonDir = path.join(appRoot, 'python')
  const allDeps = new Set<string>()
  try {
    const entries = await fs.readdir(pythonDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const reqPath = path.join(pythonDir, entry.name, `${entry.name}_requirements.json`)
      try {
        const data = JSON.parse(await fs.readFile(reqPath, 'utf-8'))
        if (data.dependencies) {
          for (const dep of Object.keys(data.dependencies)) {
            allDeps.add(dep)
          }
        }
      } catch {
        // skip dirs without requirements
      }
    }
  } catch {
    // fallback
  }
  // Always ensure core packages are checked
  for (const core of ['numpy', 'PIL', 'qiskit', 'qiskit_aer', 'scipy']) {
    allDeps.add(core)
  }
  return Array.from(allDeps)
}

function checkPython(): Promise<{ available: boolean; version?: string; missing?: string[] }> {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
  return new Promise(async (resolve) => {
    execFile(pythonCmd, ['--version'], async (err, stdout) => {
      if (err) {
        resolve({ available: false, missing: ['python3 not found'] })
        return
      }
      const version = stdout.trim()

      // Aggregate dependencies from all effects
      const deps = await collectEffectDependencies(APP_ROOT)
      const depsJson = JSON.stringify(deps)

      const checkScript = `
import sys, json
missing = []
for pkg in json.loads('${depsJson}'):
    try:
        __import__(pkg)
    except ImportError:
        missing.append(pkg)
print(json.dumps(missing))
`
      execFile(pythonCmd, ['-c', checkScript], (pkgErr, pkgOut) => {
        if (pkgErr) {
          resolve({ available: true, version, missing: ['Could not check packages'] })
          return
        }
        try {
          const missingPkgs = JSON.parse(pkgOut.trim()) as string[]
          resolve({ available: true, version, missing: missingPkgs.length > 0 ? missingPkgs : undefined })
        } catch {
          resolve({ available: true, version })
        }
      })
    })
  })
}

function registerIpcHandlers() {
  // ─── Python Environment ────────────────────────────────────
  ipcMain.handle('check-python', async () => {
    try {
      const result = await checkPython()
      return { success: true, data: result }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  // ─── Install Python Packages ─────────────────────────────────
  ipcMain.handle('install-packages', async (_event, packages: string[]) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
    // Map import names to pip install names where they differ
    const importToPip: Record<string, string> = {
      PIL: 'Pillow',
      qiskit_aer: 'qiskit-aer',
      cv2: 'opencv-python',
    }
    const pipNames = packages.map((pkg) => importToPip[pkg] || pkg)

    return new Promise((resolve) => {
      const proc = spawn(pythonCmd, ['-m', 'pip', 'install', ...pipNames], {
        cwd: APP_ROOT,
      })

      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (d) => { stdout += d.toString() })
      proc.stderr.on('data', (d) => { stderr += d.toString() })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({ success: false, error: stderr || `pip exited with code ${code}` })
        }
      })

      proc.on('error', (err) => {
        resolve({ success: false, error: `Failed to run pip: ${err.message}` })
      })
    })
  })

  // ─── Effects ───────────────────────────────────────────────
  ipcMain.handle('load-effects', async () => {
    try {
      const effects = await loadEffectDefinitions(APP_ROOT)
      return { success: true, data: effects }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('load-effects error:', msg)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('run-effect', async (_event, payload) => {
    try {
      const outputDataUrl = await runPythonEffect(APP_ROOT, payload)
      return { success: true, data: { outputImageDataUrl: outputDataUrl } }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('run-effect error:', msg)
      return { success: false, error: msg }
    }
  })

  // ─── Projects ──────────────────────────────────────────────
  const projectsBase = path.join(APP_ROOT, 'project')

  ipcMain.handle('create-project', async (_event, name: string, width: number, height: number) => {
    try {
      const id = `proj_${Date.now()}`
      const projectDir = path.join(projectsBase, id)
      await fs.mkdir(path.join(projectDir, 'stroke'), { recursive: true })

      const meta = {
        id,
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        canvasWidth: width,
        canvasHeight: height,
      }
      await fs.writeFile(path.join(projectDir, 'metadata.json'), JSON.stringify(meta, null, 2))
      return { success: true, data: meta }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('list-projects', async () => {
    try {
      await fs.mkdir(projectsBase, { recursive: true })
      const entries = await fs.readdir(projectsBase, { withFileTypes: true })
      const projects = []

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const metaPath = path.join(projectsBase, entry.name, 'metadata.json')
        try {
          const data = JSON.parse(await fs.readFile(metaPath, 'utf-8'))
          projects.push(data)
        } catch {
          // skip invalid project dirs
        }
      }

      projects.sort((a, b) => b.updatedAt - a.updatedAt)
      return { success: true, data: projects }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('open-project', async (_event, projectId: string) => {
    try {
      const projectDir = path.join(projectsBase, projectId)
      const meta = JSON.parse(await fs.readFile(path.join(projectDir, 'metadata.json'), 'utf-8'))
      let canvasJson: string | undefined
      try {
        canvasJson = await fs.readFile(path.join(projectDir, 'canvas.json'), 'utf-8')
      } catch {
        // no saved canvas state yet
      }
      return { success: true, data: { meta, canvasJson } }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('save-project', async (_event, projectId: string, canvasJson: string) => {
    try {
      const projectDir = path.join(projectsBase, projectId)
      await fs.writeFile(path.join(projectDir, 'canvas.json'), canvasJson)

      // Update timestamp
      const metaPath = path.join(projectDir, 'metadata.json')
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'))
      meta.updatedAt = Date.now()
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2))
      return { success: true }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('delete-project', async (_event, projectId: string) => {
    try {
      const projectDir = path.join(projectsBase, projectId)
      await fs.rm(projectDir, { recursive: true, force: true })
      return { success: true }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  // ─── File Dialogs ──────────────────────────────────────────
  ipcMain.handle('import-image', async () => {
    try {
      const result = await dialog.showOpenDialog(win!, {
        title: 'Import Image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] }],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'cancelled' }
      }

      const filePath = result.filePaths[0]
      const buffer = await fs.readFile(filePath)
      const ext = path.extname(filePath).slice(1).toLowerCase()
      const mime = ext === 'jpg' ? 'jpeg' : ext
      const dataUrl = `data:image/${mime};base64,${buffer.toString('base64')}`
      return { success: true, data: { dataUrl, name: path.basename(filePath) } }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('export-image', async (_event, dataUrl: string) => {
    try {
      const result = await dialog.showSaveDialog(win!, {
        title: 'Export Image',
        defaultPath: 'quantum-brush-export.png',
        filters: [
          { name: 'PNG', extensions: ['png'] },
          { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
        ],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'cancelled' }
      }

      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      await fs.writeFile(result.filePath, Buffer.from(base64, 'base64'))
      return { success: true }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  // ─── Save As (new copy of project — internal) ──────────────
  ipcMain.handle('save-project-as', async (_event, sourceProjectId: string, newName: string, canvasJson: string) => {
    try {
      const newId = `proj_${Date.now()}`
      const newDir = path.join(projectsBase, newId)
      await fs.mkdir(path.join(newDir, 'stroke'), { recursive: true })

      const meta = {
        id: newId,
        name: newName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        canvasWidth: 1200,
        canvasHeight: 800,
      }

      if (sourceProjectId) {
        try {
          const srcMeta = JSON.parse(
            await fs.readFile(path.join(projectsBase, sourceProjectId, 'metadata.json'), 'utf-8')
          )
          meta.canvasWidth = srcMeta.canvasWidth
          meta.canvasHeight = srcMeta.canvasHeight
        } catch {
          // use defaults
        }
      }

      await fs.writeFile(path.join(newDir, 'metadata.json'), JSON.stringify(meta, null, 2))
      await fs.writeFile(path.join(newDir, 'canvas.json'), canvasJson)
      return { success: true, data: meta }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  // ─── File-based Save (native dialog → .qbrush file) ────────
  ipcMain.handle('save-to-file', async (_event, projectName: string, canvasJson: string, canvasWidth: number, canvasHeight: number) => {
    try {
      const result = await dialog.showSaveDialog(win!, {
        title: 'Save Project',
        defaultPath: `${projectName || 'Untitled'}.qbrush`,
        filters: [{ name: 'Quantum Brush Project', extensions: ['qbrush'] }],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'cancelled' }
      }

      const fileData = {
        version: 1,
        name: projectName || path.basename(result.filePath, '.qbrush'),
        canvasWidth: canvasWidth || 1200,
        canvasHeight: canvasHeight || 800,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        canvasJson,
      }
      await fs.writeFile(result.filePath, JSON.stringify(fileData, null, 2))
      return { success: true, data: { filePath: result.filePath, name: fileData.name } }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  // ─── File-based Save to known path (no dialog) ─────────────
  ipcMain.handle('save-to-file-path', async (_event, filePath: string, projectName: string, canvasJson: string, canvasWidth: number, canvasHeight: number) => {
    try {
      // Read existing file to preserve createdAt
      let createdAt = Date.now()
      try {
        const existing = JSON.parse(await fs.readFile(filePath, 'utf-8'))
        createdAt = existing.createdAt || createdAt
      } catch {
        // new file
      }

      const fileData = {
        version: 1,
        name: projectName,
        canvasWidth: canvasWidth || 1200,
        canvasHeight: canvasHeight || 800,
        createdAt,
        updatedAt: Date.now(),
        canvasJson,
      }
      await fs.writeFile(filePath, JSON.stringify(fileData, null, 2))
      return { success: true }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  // ─── File-based Open (.qbrush file from disk) ──────────────
  ipcMain.handle('open-from-file', async () => {
    try {
      const result = await dialog.showOpenDialog(win!, {
        title: 'Open Project',
        filters: [{ name: 'Quantum Brush Project', extensions: ['qbrush'] }],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'cancelled' }
      }

      const filePath = result.filePaths[0]
      const raw = await fs.readFile(filePath, 'utf-8')
      const fileData = JSON.parse(raw)

      const meta = {
        id: `file_${Date.now()}`,
        name: fileData.name || path.basename(filePath, '.qbrush'),
        createdAt: fileData.createdAt || Date.now(),
        updatedAt: fileData.updatedAt || Date.now(),
        canvasWidth: fileData.canvasWidth || 1200,
        canvasHeight: fileData.canvasHeight || 800,
      }

      return {
        success: true,
        data: { meta, canvasJson: fileData.canvasJson, filePath },
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  // ─── SVG ───────────────────────────────────────────────────
  ipcMain.handle(
    'save-stroke-svg',
    async (_event, projectId: string, strokeId: string, svgData: string) => {
      try {
        const strokeDir = path.join(projectsBase, projectId, 'stroke')
        await fs.mkdir(strokeDir, { recursive: true })
        await fs.writeFile(path.join(strokeDir, `${strokeId}.svg`), svgData)
        return { success: true }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        return { success: false, error: msg }
      }
    }
  )

  // ─── SVG Export (canvas → .svg file) ────────────────────────
  ipcMain.handle('export-svg', async (_event, svgString: string) => {
    try {
      const result = await dialog.showSaveDialog(win!, {
        title: 'Export as SVG',
        defaultPath: 'quantum-brush-export.svg',
        filters: [{ name: 'SVG', extensions: ['svg'] }],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'cancelled' }
      }

      await fs.writeFile(result.filePath, svgString, 'utf-8')
      return { success: true }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  // ─── SVG Import (.svg file → canvas) ────────────────────────
  ipcMain.handle('import-svg', async () => {
    try {
      const result = await dialog.showOpenDialog(win!, {
        title: 'Import SVG',
        filters: [{ name: 'SVG Files', extensions: ['svg'] }],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'cancelled' }
      }

      const filePath = result.filePaths[0]
      const svgString = await fs.readFile(filePath, 'utf-8')
      return { success: true, data: { svgString, name: path.basename(filePath) } }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),

    // File
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => win?.webContents.send('menu-action', 'new-project'),
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => win?.webContents.send('menu-action', 'open-project'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          registerAccelerator: false,
          click: () => win?.webContents.send('menu-action', 'save'),
        },
        { type: 'separator' },
        {
          label: 'Import Image',
          click: () => win?.webContents.send('menu-action', 'import-image'),
        },
        {
          label: 'Import SVG',
          click: () => win?.webContents.send('menu-action', 'import-svg'),
        },
        {
          label: 'Export Image',
          click: () => win?.webContents.send('menu-action', 'export-image'),
        },
        {
          label: 'Export as SVG',
          click: () => win?.webContents.send('menu-action', 'export-svg'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    // Edit
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          registerAccelerator: false,
          click: () => win?.webContents.send('menu-action', 'undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          registerAccelerator: false,
          click: () => win?.webContents.send('menu-action', 'redo'),
        },
      ],
    },

    // Window (no zoom)
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
            ]
          : [
              { role: 'close' as const },
            ]),
      ],
    },

    // Help
    {
      label: 'Help',
      submenu: [
        {
          label: 'Quantum Brush Documentation',
          click: () => shell.openExternal('https://github.com/moth-quantum/QuantumBrush'),
        },
        {
          label: 'Report an Issue',
          click: () => shell.openExternal('https://github.com/moth-quantum/QuantumBrush/issues'),
        },
        { type: 'separator' },
        {
          label: 'About Quantum Brush',
          click: () => {
            dialog.showMessageBox(win!, {
              type: 'info',
              title: 'About Quantum Brush',
              message: 'Quantum Brush',
              detail: 'A quantum-powered digital art application.\n\nhttps://github.com/moth-quantum/QuantumBrush',
            })
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
