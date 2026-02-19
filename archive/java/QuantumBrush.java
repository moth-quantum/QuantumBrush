import processing.core.*;
import processing.awt.PSurfaceAWT;
import processing.data.*;
import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.util.*;
import java.io.*;

public class QuantumBrush extends PApplet {
    // Managers
    private CanvasManager canvas;
    private EffectManager effects;
    private StrokeManager strokes;
    private FileManager files;
    private UIManager ui;
    
    // UI components
    private JFrame controlFrame;
    private JFrame canvasFrame;
    private JMenuBar menuBar;
    private JComboBox<String> effectsDropdown;
    private JButton createButton;
    private JPanel effectParameterContainer; // Container for effect parameters
    
    // Canvas state
    private PImage currentImage;
    private boolean isDrawing = false;
    private String projectId = null;
    
    // Zoom and Pan state
    private float zoomLevel = 1.0f;
    private float panX = 0;
    private float panY = 0;
    private boolean isPanning = false;
    private float lastMouseX, lastMouseY;
    private static final float MIN_ZOOM = 0.1f;
    private static final float MAX_ZOOM = 10.0f;
    private static final int CANVAS_WIDTH = 800;
    private static final int CANVAS_HEIGHT = 600;
    
    // Project history for undo/redo
    private ArrayList<ProjectState> projectHistory;
    private int projectHistoryIndex;
    private static final int MAX_HISTORY_SIZE = 20;
    
    // Drawing state
    private int strokeColor = color(255, 0, 0); // Red
    private float strokeWeight = 2.0f;
    
    public static void main(String[] args) {
        PApplet.main("QuantumBrush");
    }
    
    public void settings() {
        size(CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    public void setup() {
    	frameRate(90);
        
        canvas = new CanvasManager(this);
        effects = new EffectManager(this);
        files = new FileManager(this);
        ui = new UIManager(this);
        strokes = new StrokeManager(this);
        
        // Load effects
        effects.loadEffects();
        DebugLogger.log("Effects loaded: " + effects.getEffectNames().size() + " effects found");
        
        // Setup UI
        setupUI();
        
        
        stroke(strokeColor);
        strokeWeight(strokeWeight);
        
        // Add shutdown hook to clean up resources
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            if (strokes != null) {
                strokes.shutdown();
            }
        }));
        
        // Clean up any temporary files on startup
        cleanupTempFiles();

        // Initialize project history
        projectHistory = new ArrayList<>();
        projectHistoryIndex = -1;
      
    }
    
    private void cleanupTempFiles() {
        try {
            // Clean up temp directory
            File tempDir = new File("temp");
            if (tempDir.exists() && tempDir.isDirectory()) {
                File[] tempFiles = tempDir.listFiles();
                if (tempFiles != null) {
                    for (File file : tempFiles) {
                        file.delete();
                    }
                }
            }
            
            // Clean up any lock files
            File[] lockFiles = new File(".").listFiles((dir, name) -> name.endsWith(".lock"));
            if (lockFiles != null) {
                for (File file : lockFiles) {
                    file.delete();
                }
            }
            
            // Clean up any temp files
            File[] tmpFiles = new File(".").listFiles((dir, name) -> name.endsWith(".tmp"));
            if (tmpFiles != null) {
                for (File file : tmpFiles) {
                    file.delete();
                }
            }
        } catch (Exception e) {
            System.err.println("Error cleaning up temporary files: " + e.getMessage());
        }
    }
    
    private void setupUI() {
        // Get the JFrame from Processing for canvas
        PSurfaceAWT.SmoothCanvas smoothCanvas = (PSurfaceAWT.SmoothCanvas) ((PSurfaceAWT)surface).getNative();
        canvasFrame = (JFrame) smoothCanvas.getFrame();
        canvasFrame.setTitle("Quantum Brush - Canvas");
        
        // Position the canvas frame on the right side of the screen
        Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();
        canvasFrame.setLocation(screenSize.width/2, screenSize.height/4);
        
        // Create control frame
        createControlFrame();
        
        // Add keyboard shortcuts for undo/redo and zoom/pan
        KeyboardFocusManager.getCurrentKeyboardFocusManager().addKeyEventDispatcher(new KeyEventDispatcher() {
            @Override
            public boolean dispatchKeyEvent(KeyEvent e) {
                if (e.getID() == KeyEvent.KEY_PRESSED) {
                    int keyCode = e.getKeyCode();
                    boolean isCtrlDown = (e.getModifiersEx() & InputEvent.CTRL_DOWN_MASK) != 0 ||
                                         (e.getModifiersEx() & InputEvent.META_DOWN_MASK) != 0;
                    boolean isShiftDown = (e.getModifiersEx() & InputEvent.SHIFT_DOWN_MASK) != 0;
                    
                    if (isCtrlDown) {
                        if (keyCode == KeyEvent.VK_Z) {
                            if (isShiftDown) {
                                // Redo (Ctrl/Cmd + Shift + Z)
                                redoProject();
                            } else {
                                // Undo (Ctrl/Cmd + Z)
                                undoProject();
                            }
                            return true;
                        } else if (keyCode == KeyEvent.VK_D) {
                            // Clear drawing paths (Ctrl/Cmd + D)
                            canvas.clearPaths();
                            return true;
                        } else if (keyCode == KeyEvent.VK_0) {
                            // Reset zoom (Ctrl/Cmd + 0)
                            resetZoom();
                            return true;
                        } else if (keyCode == KeyEvent.VK_EQUALS || keyCode == KeyEvent.VK_PLUS) {
                            // Zoom in (Ctrl/Cmd + +)
                            zoomIn();
                            return true;
                        } else if (keyCode == KeyEvent.VK_MINUS) {
                            // Zoom out (Ctrl/Cmd + -)
                            zoomOut();
                            return true;
                        }
                    }
                    
                    // Space bar for panning (when held down)
                    if (keyCode == KeyEvent.VK_SPACE) {
                        // This will be handled in keyPressed/keyReleased
                        return false;
                    }
                }
                return false;
            }
        });
        
        canvasFrame.setVisible(true);
    }
    
    // Zoom and Pan methods
    private void resetZoom() {
        if (currentImage != null) {
            calculateInitialZoomAndPan();
        } else {
            zoomLevel = 1.0f;
            panX = 0;
            panY = 0;
        }
    }
    
    private void zoomIn() {
        float newZoom = zoomLevel * 1.2f;
        setZoom(newZoom, width/2, height/2);
    }
    
    private void zoomOut() {
        float newZoom = zoomLevel / 1.2f;
        setZoom(newZoom, width/2, height/2);
    }
    
    private void setZoom(float newZoom, float centerX, float centerY) {
        newZoom = constrain(newZoom, MIN_ZOOM, MAX_ZOOM);
        
        if (currentImage != null) {
            // Calculate the image point that should remain at the center
            float imageX = (centerX - panX) / zoomLevel;
            float imageY = (centerY - panY) / zoomLevel;
            
            // Update zoom
            zoomLevel = newZoom;
            
            // Recalculate pan to keep the same image point at the center
            panX = centerX - imageX * zoomLevel;
            panY = centerY - imageY * zoomLevel;
        } else {
            zoomLevel = newZoom;
        }
    }
    
    private void calculateInitialZoomAndPan() {
        if (currentImage == null) return;
        
        // Calculate zoom to fit image in canvas with some margin
        float fitZoomX = (width * 0.9f) / currentImage.width;
        float fitZoomY = (height * 0.9f) / currentImage.height;
        zoomLevel = Math.min(fitZoomX, fitZoomY);
        zoomLevel = constrain(zoomLevel, MIN_ZOOM, MAX_ZOOM);
        
        // Center the image
        panX = (width - currentImage.width * zoomLevel) / 2;
        panY = (height - currentImage.height * zoomLevel) / 2;
    }
    
    // Coordinate transformation methods
    private PVector screenToImage(float screenX, float screenY) {
        if (currentImage == null) return new PVector(screenX, screenY);
        
        float imageX = (screenX - panX) / zoomLevel;
        float imageY = (screenY - panY) / zoomLevel;
        
        // Clamp to image bounds
        imageX = constrain(imageX, 0, currentImage.width);
        imageY = constrain(imageY, 0, currentImage.height);
        
        return new PVector(imageX, imageY);
    }
    
    private PVector imageToScreen(float imageX, float imageY) {
        float screenX = imageX * zoomLevel + panX;
        float screenY = imageY * zoomLevel + panY;
        return new PVector(screenX, screenY);
    }
    
    private boolean isPointInImage(float screenX, float screenY) {
        if (currentImage == null) return false;
        
        PVector imagePoint = screenToImage(screenX, screenY);
        return imagePoint.x >= 0 && imagePoint.x <= currentImage.width &&
               imagePoint.y >= 0 && imagePoint.y <= currentImage.height;
    }
    
    private void createControlFrame() {
        // Create main control window
        controlFrame = new JFrame("Quantum Brush - Control Panel");
        Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();
        int controlWidth = Math.min(500, (int)(screenSize.width * 0.4));
        int controlHeight = Math.min(700, (int)(screenSize.height * 0.8));
        controlFrame.setSize(controlWidth, controlHeight);
        controlFrame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        
        // Position the control frame on the left side of the screen
        controlFrame.setLocation(screenSize.width/4, screenSize.height/4);
        
        // Set references for UI manager
        ui.setMainControlFrame(controlFrame);
        
        // Create menu bar
        menuBar = new JMenuBar();
        
        // File menu
        JMenu fileMenu = new JMenu("File");
        JMenuItem newItem = new JMenuItem("New");
        JMenuItem openItem = new JMenuItem("Open");
        JMenuItem exportItem = new JMenuItem("Export");
        JMenuItem exitItem = new JMenuItem("Exit");
        
        // Add keyboard shortcuts
        newItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_N, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx()));
        openItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_O, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx()));
        exportItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_S, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx()));
        
        newItem.addActionListener(e -> newFile());
        openItem.addActionListener(e -> openFile());
        exportItem.addActionListener(e -> exportFile());
        exitItem.addActionListener(e -> exit());
        
        fileMenu.add(newItem);
        fileMenu.add(openItem);
        fileMenu.add(exportItem);
        fileMenu.addSeparator();
        fileMenu.add(exitItem);
        
        // Edit menu
        JMenu editMenu = new JMenu("Edit");
        JMenuItem undoItem = new JMenuItem("Undo");
        JMenuItem redoItem = new JMenuItem("Redo");
        JMenuItem clearItem = new JMenuItem("Clear Drawing Paths");
        
        undoItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_Z, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx()));
        redoItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_Z, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx() | InputEvent.SHIFT_DOWN_MASK));
        
        undoItem.addActionListener(e -> undoProject());
        redoItem.addActionListener(e -> redoProject());
        clearItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_D, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx()));
        clearItem.addActionListener(e -> canvas.clearPaths());
        
        editMenu.add(undoItem);
        editMenu.add(redoItem);
        editMenu.addSeparator();
        editMenu.add(clearItem);
        
        // View menu
        JMenu viewMenu = new JMenu("View");
        JMenuItem zoomInItem = new JMenuItem("Zoom In");
        JMenuItem zoomOutItem = new JMenuItem("Zoom Out");
        JMenuItem resetZoomItem = new JMenuItem("Reset Zoom");
        JMenuItem fitToWindowItem = new JMenuItem("Fit to Window");
        
        zoomInItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_EQUALS, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx()));
        zoomOutItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_MINUS, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx()));
        resetZoomItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_0, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx()));
        
        zoomInItem.addActionListener(e -> zoomIn());
        zoomOutItem.addActionListener(e -> zoomOut());
        resetZoomItem.addActionListener(e -> resetZoom());
        fitToWindowItem.addActionListener(e -> resetZoom());
        
        viewMenu.add(zoomInItem);
        viewMenu.add(zoomOutItem);
        viewMenu.add(resetZoomItem);
        viewMenu.addSeparator();
        viewMenu.add(fitToWindowItem);
        
        // Tools menu
        JMenu toolsMenu = new JMenu("Tools");
        JMenuItem strokeManagerItem = new JMenuItem("Stroke Manager");
        JMenuItem pythonConfigItem = new JMenuItem("Python Configuration");
        JMenuItem debugViewerItem = new JMenuItem("View Live Debug Log");
        JMenuItem testDebugItem = new JMenuItem("Test Debug Logging");
        
        strokeManagerItem.addActionListener(e -> strokes.showStrokeManager());
        pythonConfigItem.addActionListener(e -> strokes.showPythonConfigDialog());
        debugViewerItem.addActionListener(e -> showLiveDebugViewer());
        testDebugItem.addActionListener(e -> {
            DebugLogger.addTestLog();
            JOptionPane.showMessageDialog(controlFrame, 
                "Test logs added! Check the debug viewer to see if they appear.", 
                "Test Debug", 
                JOptionPane.INFORMATION_MESSAGE);
        });
        
        toolsMenu.add(strokeManagerItem);
        toolsMenu.add(pythonConfigItem);
        toolsMenu.addSeparator();
        toolsMenu.add(debugViewerItem);
        toolsMenu.add(testDebugItem);
        
        menuBar.add(fileMenu);
        menuBar.add(editMenu);
        menuBar.add(viewMenu);
        menuBar.add(toolsMenu);
        
        controlFrame.setJMenuBar(menuBar);
        
        // Create main panel with BorderLayout
        JPanel mainPanel = new JPanel(new BorderLayout(10, 10));
        mainPanel.setBorder(BorderFactory.createEmptyBorder(15, 15, 15, 15));
        
        // Create effects panel without titled border
        JPanel effectsPanel = new JPanel(new BorderLayout(10, 10));
        
        // Effects dropdown
        effectsDropdown = new JComboBox<>();
        effectsDropdown.addItem("Select an effect...");
        
        // Populate effects dropdown with NAMES, not IDs
        for (String effectId : effects.getEffectNames()) {
            Effect effect = effects.getEffect(effectId);
            if (effect != null) {
                String displayName = effect.getName(); // Use name instead of ID
                effectsDropdown.addItem(displayName);
            }
        }
        
        effectsDropdown.addActionListener(e -> {
            String selectedName = (String) effectsDropdown.getSelectedItem();
            if (selectedName != null && !selectedName.equals("Select an effect...")) {
                // Find effect by name, not ID
                Effect selectedEffect = null;
                for (String effectId : effects.getEffectNames()) {
                    Effect effect = effects.getEffect(effectId);
                    if (effect != null && effect.getName().equals(selectedName)) {
                        selectedEffect = effect;
                        break;
                    }
                }
                
                if (selectedEffect != null) {
                    DebugLogger.log("User selected effect: " + selectedName + " (ID: " + selectedEffect.getId() + ")");
                    ui.createEffectWindow(selectedEffect);
                }
            }
        });
        
        effectsPanel.add(effectsDropdown, BorderLayout.NORTH);
        
        // Create effect parameter container WITHOUT titled border
        effectParameterContainer = new JPanel(new BorderLayout());
        ui.setEffectParameterContainer(effectParameterContainer);
        
        effectsPanel.add(effectParameterContainer, BorderLayout.CENTER);
        
        // Add zoom info panel
        JPanel zoomInfoPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        zoomInfoPanel.setBorder(BorderFactory.createTitledBorder("Canvas Info"));
        
        JLabel zoomLabel = new JLabel("Zoom: 100% | Pan: (0, 0)");
        zoomInfoPanel.add(zoomLabel);
        
        // Update zoom label periodically
        javax.swing.Timer zoomTimer = new javax.swing.Timer(100, e -> {
            if (currentImage != null) {
                zoomLabel.setText(String.format("Zoom: %.0f%% | Pan: (%.0f, %.0f) | Image: %dx%d", 
                    zoomLevel * 100, panX, panY, currentImage.width, currentImage.height));
            } else {
                zoomLabel.setText("No image loaded");
            }
        });
        zoomTimer.start();
        
        // Add only the effects panel and zoom info to main panel
        mainPanel.add(effectsPanel, BorderLayout.CENTER);
        mainPanel.add(zoomInfoPanel, BorderLayout.SOUTH);
        
        controlFrame.add(mainPanel);
        controlFrame.setVisible(true);
    }
    
    private void showLiveDebugViewer() {
        JDialog debugDialog = new JDialog((Frame)null, "Live Debug Log Viewer", false); // Non-modal
        debugDialog.setSize(600, 400);
        debugDialog.setLocationRelativeTo(controlFrame);
        
        JTextArea debugTextArea = new JTextArea();
        debugTextArea.setFont(new Font("Courier New", Font.PLAIN, 13));
        debugTextArea.setEditable(false);
        debugTextArea.setBackground(new Color(248, 248, 248));
        
        // Load current debug log content
        debugTextArea.setText(DebugLogger.getAllLogs());
        
        // Auto-scroll to bottom
        debugTextArea.setCaretPosition(debugTextArea.getDocument().getLength());
        
        JScrollPane scrollPane = new JScrollPane(debugTextArea);
        scrollPane.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);
        
        // Create control panel
        JPanel controlPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        
        JButton refreshButton = new JButton("Refresh");
        JButton clearButton = new JButton("Clear Log");
        JButton copyButton = new JButton("Copy All");
        JButton testButton = new JButton("Add Test Log");
        JCheckBox autoRefreshBox = new JCheckBox("Auto-refresh", true);
        
        controlPanel.add(refreshButton);
        controlPanel.add(clearButton);
        controlPanel.add(copyButton);
        controlPanel.add(testButton);
        controlPanel.add(autoRefreshBox);
        
        // Add status label
        JLabel statusLabel = new JLabel("Live debug log - " + DebugLogger.getLogCount() + " entries");
        controlPanel.add(Box.createHorizontalStrut(20));
        controlPanel.add(statusLabel);
        
        // Button actions
        refreshButton.addActionListener(e -> {
            String logContent = DebugLogger.getAllLogs();
            debugTextArea.setText(logContent);
            debugTextArea.setCaretPosition(debugTextArea.getDocument().getLength());
            statusLabel.setText("Live debug log - " + DebugLogger.getLogCount() + " entries");
        });
        
        clearButton.addActionListener(e -> {
            DebugLogger.clearLogs();
            debugTextArea.setText("");
            statusLabel.setText("Live debug log - 0 entries");
        });
        
        copyButton.addActionListener(e -> {
            debugTextArea.selectAll();
            debugTextArea.copy();
            debugTextArea.setCaretPosition(debugTextArea.getDocument().getLength());
            JOptionPane.showMessageDialog(debugDialog, "Debug log copied to clipboard!", "Copied", JOptionPane.INFORMATION_MESSAGE);
        });
        
        testButton.addActionListener(e -> {
            DebugLogger.addTestLog();
            // Immediately refresh the display
            debugTextArea.setText(DebugLogger.getAllLogs());
            debugTextArea.setCaretPosition(debugTextArea.getDocument().getLength());
            statusLabel.setText("Live debug log - " + DebugLogger.getLogCount() + " entries");
        });
        
        // Auto-refresh timer
        javax.swing.Timer refreshTimer = new javax.swing.Timer(1000, e -> {
            if (autoRefreshBox.isSelected()) {
                String currentText = debugTextArea.getText();
                String newText = DebugLogger.getAllLogs();
                if (!currentText.equals(newText)) {
                    debugTextArea.setText(newText);
                    debugTextArea.setCaretPosition(debugTextArea.getDocument().getLength());
                    statusLabel.setText("Live debug log - " + DebugLogger.getLogCount() + " entries");
                }
            }
        });
        refreshTimer.start();
        
        // Stop timer when dialog is closed
        debugDialog.addWindowListener(new java.awt.event.WindowAdapter() {
            @Override
            public void windowClosing(java.awt.event.WindowEvent e) {
                refreshTimer.stop();
            }
        });
        
        debugDialog.add(scrollPane, BorderLayout.CENTER);
        debugDialog.add(controlPanel, BorderLayout.SOUTH);
        debugDialog.setVisible(true);
    }
    
    private void newFile() {
        JFileChooser fileChooser = new JFileChooser();
        fileChooser.setFileFilter(new javax.swing.filechooser.FileFilter() {
            public boolean accept(File f) {
                return f.isDirectory() || f.getName().toLowerCase().endsWith(".png") || 
                       f.getName().toLowerCase().endsWith(".jpg") || f.getName().toLowerCase().endsWith(".jpeg");
            }
            public String getDescription() {
                return "Image files (*.png, *.jpg, *.jpeg)";
            }
        });
        
        if (fileChooser.showOpenDialog(controlFrame) == JFileChooser.APPROVE_OPTION) {
            File selectedFile = fileChooser.getSelectedFile();
            PImage loadedImage = loadImage(selectedFile.getAbsolutePath());
            
            if (loadedImage != null) {
                currentImage = loadedImage;
                
                // Calculate initial zoom and pan to fit image nicely
                calculateInitialZoomAndPan();
                
                // Ask user for project name
                String defaultProjectName = selectedFile.getName();
                // Remove file extension from default name
                int lastDotIndex = defaultProjectName.lastIndexOf('.');
                if (lastDotIndex > 0) {
                    defaultProjectName = defaultProjectName.substring(0, lastDotIndex);
                }
                
                String projectName = (String) JOptionPane.showInputDialog(
                    controlFrame,
                    "Enter a name for this project:",
                    "New Project",
                    JOptionPane.QUESTION_MESSAGE,
                    null,
                    null,
                    defaultProjectName
                );
                
                // If user cancels or enters empty name, use default
                if (projectName == null || projectName.trim().isEmpty()) {
                    projectName = defaultProjectName;
                }
                
                // Generate new project ID
                projectId = "project_" + System.currentTimeMillis();
                
                // Save project
                files.saveProject(projectId, currentImage);
                files.createProjectMetadata(projectId, projectName.trim());
                
                // Clear canvas and strokes
                canvas.clearPaths();
                strokes.clearStrokes();
                
                // Save initial project state (after loading new image)
                saveProjectStateAfterImageChange();
                
                DebugLogger.log("New project created: " + projectName + " (ID: " + projectId + ")");
                println("New project created: " + projectName + " (ID: " + projectId + ")");
            } else {
                JOptionPane.showMessageDialog(controlFrame, "Failed to load image.", "Error", JOptionPane.ERROR_MESSAGE);
            }
        }
    }
    
    private void openFile() {
        // Show enhanced project selection dialog with delete option
        showProjectManagerDialog();
    }
    
    private void showProjectManagerDialog() {
        // Get projects metadata
        ArrayList<JSONObject> projects = files.getProjectsMetadata();
        
        if (projects.isEmpty()) {
            JOptionPane.showMessageDialog(controlFrame, "No projects found.", "No Projects", JOptionPane.INFORMATION_MESSAGE);
            return;
        }
        
        // Create a custom dialog for project management
        JDialog projectDialog = new JDialog(controlFrame, "Project Manager", true);
        Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();
        int dialogWidth = Math.min(480, (int)(screenSize.width * 0.5));
        int dialogHeight = Math.min(450, (int)(screenSize.height * 0.6));
        projectDialog.setSize(dialogWidth, dialogHeight);
        projectDialog.setLocationRelativeTo(controlFrame);
        projectDialog.setLayout(new BorderLayout(10, 10));
        projectDialog.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);
        
        // Create project list model and JList
        DefaultListModel<ProjectItem> listModel = new DefaultListModel<>();
        for (JSONObject project : projects) {
            String name = project.getString("project_name", "Unknown");
            String id = project.getString("project_id", "");
            long modified = project.getLong("modified_time", 0);
            String timeStr = files.formatTimestamp(modified);
            String status = project.getString("status", "normal");
            
            // Add status indicator to the name if there are issues
            if ("missing_project_dir".equals(status)) {
                name = "⚠️ " + name + " (Missing Project Files)";
            } else if ("corrupted_metadata".equals(status)) {
                name = "❌ " + name + " (Corrupted Metadata)";
            }
            
            listModel.addElement(new ProjectItem(name, id, timeStr, status));
        }
        
        JList<ProjectItem> projectList = new JList<>(listModel);
        projectList.setCellRenderer(new ProjectListCellRenderer());
        projectList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        
        // Add list to scroll pane
        JScrollPane scrollPane = new JScrollPane(projectList);
        scrollPane.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        // Create buttons panel
        JPanel buttonsPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 10));
        
        JButton openButton = new JButton("Open");
        JButton deleteButton = new JButton("Delete");
        JButton cleanupButton = new JButton("Cleanup Orphaned");
        JButton cancelButton = new JButton("Cancel");

        // ✅ FIXED: Make cleanup button consistent with others
        // Remove special styling to match other buttons

        // Add cleanup action
        cleanupButton.addActionListener(e -> {
            int confirm = JOptionPane.showConfirmDialog(
                projectDialog,
                "This will permanently delete metadata files for projects that don't have corresponding project folders.\n" +
                "This action cannot be undone. Continue?",
                "Confirm Cleanup",
                JOptionPane.YES_NO_OPTION,
                JOptionPane.WARNING_MESSAGE
            );
            
            if (confirm == JOptionPane.YES_OPTION) {
                int cleanedCount = files.cleanupOrphanedMetadata();
                
                JOptionPane.showMessageDialog(
                    projectDialog,
                    "Cleanup completed. Removed " + cleanedCount + " orphaned metadata files.",
                    "Cleanup Complete",
                    JOptionPane.INFORMATION_MESSAGE
                );
                
                // Refresh the project list
                projectDialog.dispose();
                showProjectManagerDialog();
            }
        });

        // Update open button to handle problematic projects
        openButton.addActionListener(e -> {
            ProjectItem selectedItem = projectList.getSelectedValue();
            if (selectedItem != null) {
                if (!"normal".equals(selectedItem.status)) {
                    JOptionPane.showMessageDialog(projectDialog,
                        "Cannot open this project due to issues:\n" +
                        "Status: " + selectedItem.status + "\n\n" +
                        "Please check the project files or use the cleanup function.",
                        "Cannot Open Project",
                        JOptionPane.WARNING_MESSAGE);
                    return;
                }
                
                String selectedProjectId = selectedItem.id;
                
                if (files.loadProject(selectedProjectId)) {
                    projectId = selectedProjectId;
                    
                    // Calculate initial zoom and pan for loaded image
                    calculateInitialZoomAndPan();
                    
                    println("Project loaded: " + selectedItem.name + " (ID: " + projectId + ")");
                    
                    // Don't save project state immediately after loading!
                    // This was overwriting the current.png file with the loaded state
                    // Instead, just initialize the undo history without saving to disk
                    initializeProjectHistoryAfterLoad();
                    
                    projectDialog.dispose();
                } else {
                    JOptionPane.showMessageDialog(projectDialog, 
                        "Failed to load project.", "Error", JOptionPane.ERROR_MESSAGE);
                }
            } else {
                JOptionPane.showMessageDialog(projectDialog, 
                    "Please select a project to open.", "No Selection", JOptionPane.INFORMATION_MESSAGE);
            }
        });
        
        deleteButton.addActionListener(e -> {
            ProjectItem selectedItem = projectList.getSelectedValue();
            if (selectedItem != null) {
                // Confirm deletion
                int confirm = JOptionPane.showConfirmDialog(
                    projectDialog,
                    "Are you sure you want to delete the project \"" + selectedItem.name + "\"?\n" +
                    "This action cannot be undone.",
                    "Confirm Deletion",
                    JOptionPane.YES_NO_OPTION,
                    JOptionPane.WARNING_MESSAGE
                );
                
                if (confirm == JOptionPane.YES_OPTION) {
                    String selectedProjectId = selectedItem.id;
                    
                    // Delete the project
                    boolean success = files.deleteProject(selectedProjectId);
                    
                    if (success) {
                        // Remove from list
                        listModel.removeElement(selectedItem);
                        
                        // Show success message
                        JOptionPane.showMessageDialog(projectDialog, 
                            "Project \"" + selectedItem.name + "\" deleted successfully.", 
                            "Project Deleted", 
                            JOptionPane.INFORMATION_MESSAGE);
                        
                        // If no more projects, close dialog
                        if (listModel.isEmpty()) {
                            JOptionPane.showMessageDialog(projectDialog, 
                                "No more projects available.", 
                                "No Projects", 
                                JOptionPane.INFORMATION_MESSAGE);
                            projectDialog.dispose();
                        }
                    } else {
                        JOptionPane.showMessageDialog(projectDialog, 
                            "Failed to delete project.", 
                            "Error", 
                            JOptionPane.ERROR_MESSAGE);
                    }
                }
            } else {
                JOptionPane.showMessageDialog(projectDialog, 
                    "Please select a project to delete.", 
                    "No Selection", 
                    JOptionPane.INFORMATION_MESSAGE);
            }
        });
        
        cancelButton.addActionListener(e -> projectDialog.dispose());
        
        // Enable open button on double-click
        projectList.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (e.getClickCount() == 2) {
                    openButton.doClick();
                }
            }
        });
        
        // Add buttons to panel
        buttonsPanel.add(openButton);
        buttonsPanel.add(deleteButton);
        buttonsPanel.add(cleanupButton);
        buttonsPanel.add(cancelButton);
        
        // Add components to dialog
        JLabel titleLabel = new JLabel("Select a project:");
        titleLabel.setBorder(BorderFactory.createEmptyBorder(10, 10, 5, 10));
        titleLabel.setFont(new Font("Arial", Font.BOLD, 14));
        
        projectDialog.add(titleLabel, BorderLayout.NORTH);
        projectDialog.add(scrollPane, BorderLayout.CENTER);
        projectDialog.add(buttonsPanel, BorderLayout.SOUTH);
        
        // Show dialog
        projectDialog.setVisible(true);
    }
    
    // Helper class for project items in the list
    private static class ProjectItem {
        public final String name;
        public final String id;
        public final String timestamp;
        public final String status;
        
        public ProjectItem(String name, String id, String timestamp, String status) {
            this.name = name;
            this.id = id;
            this.timestamp = timestamp;
            this.status = status != null ? status : "normal";
        }
        
        @Override
        public String toString() {
            return name + " (" + timestamp + ")";
        }
    }
    
    // Custom cell renderer for project list
    private static class ProjectListCellRenderer extends DefaultListCellRenderer {
        @Override
        public Component getListCellRendererComponent(JList<?> list, Object value, 
                int index, boolean isSelected, boolean cellHasFocus) {
            
            JLabel label = (JLabel) super.getListCellRendererComponent(
                list, value, index, isSelected, cellHasFocus);
            
            if (value instanceof ProjectItem) {
                ProjectItem item = (ProjectItem) value;
                
                // Set text with HTML formatting
                label.setText("<html><b>" + item.name + "</b><br>" +
                             "<font size='2' color='gray'>Last modified: " + item.timestamp + "</font></html>");
                
                // Add more padding
                label.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
            }
            
            return label;
        }
    }
    
    private void exportFile() {
        if (currentImage != null) {
            JFileChooser fileChooser = new JFileChooser();
            fileChooser.setFileFilter(new javax.swing.filechooser.FileFilter() {
                public boolean accept(File f) {
                    return f.isDirectory() || f.getName().toLowerCase().endsWith(".png") || 
                           f.getName().toLowerCase().endsWith(".jpg") || f.getName().toLowerCase().endsWith(".jpeg");
                }
                public String getDescription() {
                    return "Image files (*.png, *.jpg, *.jpeg)";
                }
            });
            
            // Set default filename
            if (projectId != null) {
                fileChooser.setSelectedFile(new File(projectId + ".png"));
            } else {
                fileChooser.setSelectedFile(new File("quantum_brush_image.png"));
            }
            
            if (fileChooser.showSaveDialog(controlFrame) == JFileChooser.APPROVE_OPTION) {
                File selectedFile = fileChooser.getSelectedFile();
                String filePath = selectedFile.getAbsolutePath();
                
                // Add .png extension if not present
                if (!filePath.toLowerCase().endsWith(".png") && 
                    !filePath.toLowerCase().endsWith(".jpg") && 
                    !filePath.toLowerCase().endsWith(".jpeg")) {
                    filePath += ".png";
                    selectedFile = new File(filePath);
                }
                
                try {
                    currentImage.save(filePath);
                    JOptionPane.showMessageDialog(controlFrame, 
                        "Image exported successfully to: " + filePath, 
                        "Export Successful", 
                        JOptionPane.INFORMATION_MESSAGE);
                    
                    // Also save project if we have one
                    if (projectId != null) {
                        files.saveProject(projectId, currentImage); // This will now save both original and current
                        files.updateProjectMetadata(projectId);
                    }
                } catch (Exception e) {
                    JOptionPane.showMessageDialog(controlFrame, 
                        "Error exporting image: " + e.getMessage(), 
                        "Export Error", 
                        JOptionPane.ERROR_MESSAGE);
                }
            }
        } else {
            JOptionPane.showMessageDialog(controlFrame, "No image to export.", "Error", JOptionPane.WARNING_MESSAGE);
        }
    }
    
    // New method that initializes undo history without overwriting current.png
    private void initializeProjectHistoryAfterLoad() {
        if (projectHistory == null) {
            projectHistory = new ArrayList<>();
        }
        
        // Clear existing history
        projectHistory.clear();
        
        // Add the current loaded state to history (but don't save to disk)
        ProjectState state = new ProjectState(currentImage, new ArrayList<Path>(), projectId);
        projectHistory.add(state);
        projectHistoryIndex = 0;
        
        System.out.println("Initialized project history after loading (without overwriting current.png)");
    }
    
    /**
     * ✅ NEW: Centralized method for saving the current image to disk.
     * This ensures consistency for all operations that modify the image.
     */
    private void saveCurrentImageToDisk() {
        if (projectId != null && currentImage != null) {
            String projectPath = "project/" + projectId;
            File projectDir = new File(projectPath);
            if (projectDir.exists()) {
                currentImage.save(projectPath + "/current.png");
                System.out.println("Saved current image state to disk: project/" + projectId + "/current.png");
            }
        }
    }

    // Project state management - only save when image changes, not when drawing
    public void saveProjectStateAfterImageChange() {
        if (projectHistory == null) return;
        
        // Remove any states after current index
        while (projectHistory.size() > projectHistoryIndex + 1) {
            projectHistory.remove(projectHistory.size() - 1);
        }
        
        // Create new project state (only save image, not paths)
        ProjectState state = new ProjectState(currentImage, new ArrayList<Path>(), projectId);
        projectHistory.add(state);
        projectHistoryIndex = projectHistory.size() - 1;
        
        // Limit history size
        while (projectHistory.size() > MAX_HISTORY_SIZE) {
            projectHistory.remove(0);
            projectHistoryIndex--;
        }
        
        // ✅ FIXED: Call the new method to save the image to disk
        saveCurrentImageToDisk();
        
        System.out.println("Saved project state " + projectHistoryIndex + " (image changes only)");
    }
    
    private void undoProject() {
        if (projectHistoryIndex > 0) {
            projectHistoryIndex--;
            ProjectState state = projectHistory.get(projectHistoryIndex);
            restoreProjectState(state);
            println("Undo: Restored to state " + projectHistoryIndex);
        } else {
            println("Undo: No more states to undo");
        }
    }
    
    private void redoProject() {
        if (projectHistoryIndex < projectHistory.size() - 1) {
            projectHistoryIndex++;
            ProjectState state = projectHistory.get(projectHistoryIndex);
            restoreProjectState(state);
            System.out.println("Redo: Restored to state " + projectHistoryIndex);
        } else {
            System.out.println("Redo: No more states to redo (current: " + projectHistoryIndex + ", max: " + (projectHistory.size() - 1) + ")");
        }
    }
    
    private void restoreProjectState(ProjectState state) {
        if (state.image != null) {
            currentImage = state.image.copy();
            // Recalculate zoom and pan for the restored image
            calculateInitialZoomAndPan();
        }
        canvas.setPaths(state.paths);
        projectId = state.projectId;
        
        // ✅ FIXED: Save the restored image state to disk so it persists
        saveCurrentImageToDisk();

        // Force a redraw
        redraw();
        
        println("Restored project state - Image: " + (currentImage != null ? "Yes" : "No") + 
                ", Paths: " + (state.paths != null ? state.paths.size() : 0) + 
                ", Project ID: " + projectId);
    }
    
    public void draw() {
        background(50); // Dark gray background
        
        if (currentImage != null) {
            pushMatrix();
            
            // Apply zoom and pan transformations
            translate(panX, panY);
            scale(zoomLevel);
            
            // Draw the image at original size
            image(currentImage, 0, 0);
            
            popMatrix();
            
            // Draw paths with transformations
            canvas.draw(zoomLevel, panX, panY);
        } else {
            // Show "no image" message
            fill(200);
            textAlign(CENTER, CENTER);
            textSize(18);
            text("Load an image or project to begin", width/2, height/2);
            
            fill(150);
            textSize(14);
            text("Use File > New to load an image", width/2, height/2 + 30);
            text("Use keyboard shortcuts to zoom: Ctrl/Cmd + Plus/Minus", width/2, height/2 + 50);
        }
    }
    
    // Mouse event handling with coordinate transformation
    public void mousePressed() {
        if (currentImage == null) {
            return; // Don't allow drawing if no image is loaded
        }
        
        if (mouseButton == LEFT && !isPanning) {
            // Check if mouse is over the image
            if (isPointInImage(mouseX, mouseY)) {
                isDrawing = true;
                PVector imagePoint = screenToImage(mouseX, mouseY);
                canvas.startNewPath();
                canvas.setClickPoint(imagePoint.x, imagePoint.y);
                
             // Check if Shift is pressed ('keyPressed' and 'keyCode' are built-in PApplet variables)
                boolean isShiftDown = (keyPressed && keyCode == java.awt.event.KeyEvent.VK_SHIFT);
                canvas.addPointToCurrentPath(imagePoint.x, imagePoint.y, isShiftDown);
                // canvas.addPointToCurrentPath(imagePoint.x, imagePoint.y);
            }
        } else if (mouseButton == RIGHT || (mouseButton == LEFT && keyPressed && key == ' ')) {
            // Start panning
            isPanning = true;
            lastMouseX = mouseX;
            lastMouseY = mouseY;
        }
    }
    
    public void mouseDragged() {
        if (currentImage == null) {
            return;
        }
        
        if (isPanning) {
            // Pan the view
            float deltaX = mouseX - lastMouseX;
            float deltaY = mouseY - lastMouseY;
            panX += deltaX;
            panY += deltaY;
            lastMouseX = mouseX;
            lastMouseY = mouseY;
        } else if (isDrawing && mouseButton == LEFT) {
            // Continue drawing stroke
            if (isPointInImage(mouseX, mouseY)) {
                PVector imagePoint = screenToImage(mouseX, mouseY);
                
                // canvas.addPointToCurrentPath(imagePoint.x, imagePoint.y);
                
                // --- ADD THIS LOGIC ---
                // Check if the Shift key is pressed.
                boolean isShiftDown = (keyPressed && keyCode == java.awt.event.KeyEvent.VK_SHIFT);
                
                // --- MODIFY THIS LINE ---
                // Pass the 'isShiftDown' boolean to the manager
                canvas.addPointToCurrentPath(imagePoint.x, imagePoint.y, isShiftDown);
            }
        }
    }
    
    public void mouseReleased() {
        if (currentImage == null) {
            return;
        }
        
        if (isDrawing && mouseButton == LEFT) {
            // Finish drawing stroke
            canvas.finishCurrentPath();
            isDrawing = false;
            
            // Enable create button if there are paths
            if (canvas.hasPath()) {
                ui.enableCreateButton();
            }
        } else if (isPanning) {
            // Stop panning
            isPanning = false;
        }
    }
    
    // Getter methods for managers
    public CanvasManager getCanvasManager() {
        return canvas;
    }
    
    public EffectManager getEffectManager() {
        return effects;
    }
    
    public StrokeManager getStrokeManager() {
        return strokes;
    }
    
    public FileManager getFileManager() {
        return files;
    }
    
    public UIManager getUIManager() {
        return ui;
    }
    
    // Getter methods for state
    public PImage getCurrentImage() {
        return currentImage;
    }
    
    public void setCurrentImage(PImage image) {
        this.currentImage = image;
        if (image != null) {
            calculateInitialZoomAndPan();
        }
    }
    
    public String getProjectId() {
        return projectId;
    }
    
    public void setProjectId(String id) {
        this.projectId = id;
    }
    
    // ProjectState inner class
    private static class ProjectState {
        public final PImage image;
        public final ArrayList<Path> paths;
        public final String projectId;
        
        public ProjectState(PImage image, ArrayList<Path> paths, String projectId) {
            this.image = image != null ? image.copy() : null;
            this.paths = new ArrayList<>();
            if (paths != null) {
                for (Path path : paths) {
                    this.paths.add(path.copy());
                }
            }
            this.projectId = projectId;
        }
    }

    @Override
    public void exit() {
        System.exit(0);
    }
}
