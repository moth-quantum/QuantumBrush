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
        size(800, 600);
    }
    
    public void setup() {
        // Initialize managers
        canvas = new CanvasManager(this);
        effects = new EffectManager(this);
        files = new FileManager(this);
        ui = new UIManager(this);
        strokes = new StrokeManager(this);
        
        // Load effects
        effects.loadEffects();
        
        // Setup UI
        setupUI();
        
        // Set default brush color
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
        
        // Add keyboard shortcuts for undo/redo
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
                        }
                    }
                }
                return false;
            }
        });
        
        canvasFrame.setVisible(true);
    }
    
    private void createControlFrame() {
        // Create main control window
        controlFrame = new JFrame("Quantum Brush - Control Panel");
        controlFrame.setSize(600, 800);
        controlFrame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        
        // Position the control frame on the left side of the screen
        Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();
        controlFrame.setLocation(screenSize.width/4, screenSize.height/4);
        
        // Set references for UI manager
        ui.setMainControlFrame(controlFrame);
        
        // Create menu bar
        menuBar = new JMenuBar();
        
        // File menu
        JMenu fileMenu = new JMenu("File");
        JMenuItem newItem = new JMenuItem("New");
        JMenuItem openItem = new JMenuItem("Open");
        JMenuItem saveItem = new JMenuItem("Save");
        JMenuItem exitItem = new JMenuItem("Exit");
        
        // Add keyboard shortcuts
        newItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_N, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx()));
        openItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_O, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx()));
        saveItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_S, 
            Toolkit.getDefaultToolkit().getMenuShortcutKeyMaskEx()));
        
        newItem.addActionListener(e -> newFile());
        openItem.addActionListener(e -> openFile());
        saveItem.addActionListener(e -> saveFile());
        exitItem.addActionListener(e -> exit());
        
        fileMenu.add(newItem);
        fileMenu.add(openItem);
        fileMenu.add(saveItem);
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
        
        // Tools menu
        JMenu toolsMenu = new JMenu("Tools");
        JMenuItem strokeManagerItem = new JMenuItem("Stroke Manager");
        JMenuItem pythonConfigItem = new JMenuItem("Python Configuration");
        
        strokeManagerItem.addActionListener(e -> strokes.showStrokeManager());
        pythonConfigItem.addActionListener(e -> strokes.showPythonConfigDialog());
        
        toolsMenu.add(strokeManagerItem);
        toolsMenu.add(pythonConfigItem);
        
        menuBar.add(fileMenu);
        menuBar.add(editMenu);
        menuBar.add(toolsMenu);
        
        controlFrame.setJMenuBar(menuBar);
        
        // Create main panel with BorderLayout
        JPanel mainPanel = new JPanel(new BorderLayout(10, 10));
        mainPanel.setBorder(BorderFactory.createEmptyBorder(15, 15, 15, 15));
        
        // Create effects panel
        JPanel effectsPanel = new JPanel(new BorderLayout(10, 10));
        effectsPanel.setBorder(BorderFactory.createTitledBorder("Effects"));
        
        // Effects dropdown
        effectsDropdown = new JComboBox<>();
        effectsDropdown.addItem("Select an effect...");
        
        // Populate effects dropdown
        for (String effectName : effects.getEffectNames()) {
            effectsDropdown.addItem(effectName);
        }
        
        effectsDropdown.addActionListener(e -> {
            String selectedEffect = (String) effectsDropdown.getSelectedItem();
            if (selectedEffect != null && !selectedEffect.equals("Select an effect...")) {
                Effect effect = effects.getEffect(selectedEffect);
                if (effect != null) {
                    ui.createEffectWindow(effect);
                }
            }
        });
        
        effectsPanel.add(effectsDropdown, BorderLayout.NORTH);
        
        // Create effect parameter container
        effectParameterContainer = new JPanel(new BorderLayout());
        effectParameterContainer.setBorder(BorderFactory.createTitledBorder("Effect Parameters"));
        ui.setEffectParameterContainer(effectParameterContainer);
        
        effectsPanel.add(effectParameterContainer, BorderLayout.CENTER);
        
        // Add only the effects panel to main panel
        mainPanel.add(effectsPanel, BorderLayout.CENTER);
        
        controlFrame.add(mainPanel);
        controlFrame.setVisible(true);
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
                surface.setSize(loadedImage.width, loadedImage.height);
                
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
        projectDialog.setSize(500, 400);
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
            
            listModel.addElement(new ProjectItem(name, id, timeStr));
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
        JButton cancelButton = new JButton("Cancel");
        
        // Style delete button to indicate danger
        deleteButton.setBackground(new Color(220, 53, 69));
        deleteButton.setForeground(Color.WHITE);
        deleteButton.setFocusPainted(false);
        
        // Add action listeners
        openButton.addActionListener(e -> {
            ProjectItem selectedItem = projectList.getSelectedValue();
            if (selectedItem != null) {
                String selectedProjectId = selectedItem.id;
                
                if (files.loadProject(selectedProjectId)) {
                    projectId = selectedProjectId;
                    println("Project loaded: " + selectedItem.name + " (ID: " + projectId + ")");
                    
                    // Save initial project state (after loading project)
                    saveProjectStateAfterImageChange();
                    
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
        
        public ProjectItem(String name, String id, String timestamp) {
            this.name = name;
            this.id = id;
            this.timestamp = timestamp;
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
    
    private void saveFile() {
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
                        "Image saved successfully to: " + filePath, 
                        "Save Successful", 
                        JOptionPane.INFORMATION_MESSAGE);
                    
                    // Also save project if we have one
                    if (projectId != null) {
                        files.saveProject(projectId, currentImage);
                        files.updateProjectMetadata(projectId);
                    }
                } catch (Exception e) {
                    JOptionPane.showMessageDialog(controlFrame, 
                        "Error saving image: " + e.getMessage(), 
                        "Save Error", 
                        JOptionPane.ERROR_MESSAGE);
                }
            }
        } else {
            JOptionPane.showMessageDialog(controlFrame, "No image to save.", "Error", JOptionPane.WARNING_MESSAGE);
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
            // Resize canvas to match the restored image
            surface.setSize(currentImage.width, currentImage.height);
        }
        canvas.setPaths(state.paths);
        projectId = state.projectId;
        
        // Force a redraw
        redraw();
        
        println("Restored project state - Image: " + (currentImage != null ? "Yes" : "No") + 
                ", Paths: " + (state.paths != null ? state.paths.size() : 0) + 
                ", Project ID: " + projectId);
    }
    
    public void draw() {
        if (currentImage != null) {
            image(currentImage, 0, 0);
        } else {
            background(240); // Light gray to indicate "no image"
            fill(80); // Dark gray text
            textAlign(CENTER, CENTER);
            textSize(18);
            text("Load the image or the project.", width/2, height/2);
        }
        
        canvas.draw();
    }
    
    // Modify the mousePressed() method to track the initial position
    public void mousePressed() {
        if (currentImage == null) {
            return; // Don't allow drawing if no image is loaded
        }
        
        if (mouseButton == LEFT) {
            isDrawing = true;
            canvas.startNewPath();
            canvas.setClickPoint(mouseX, mouseY);
            canvas.addPointToCurrentPath(mouseX, mouseY);
        }
    }
    
    // Add a flag to track if dragging occurred
    private boolean hasDragged = false;

    // Modify the mouseDragged() method to set the drag flag
    public void mouseDragged() {
        if (currentImage == null) {
            return; // Don't allow drawing if no image is loaded
        }
        
        if (isDrawing && mouseButton == LEFT) {
            hasDragged = true;
            canvas.addPointToCurrentPath(mouseX, mouseY);
        }
    }

    // Modify the mouseReleased() method to handle both drag and click cases
    public void mouseReleased() {
        if (currentImage == null) {
            return; // Don't allow drawing if no image is loaded
        }
        
        if (isDrawing && mouseButton == LEFT) {
            // Always finish the current path
            canvas.finishCurrentPath();
            isDrawing = false;
            
            // Reset the drag flag for next interaction
            hasDragged = false;
            
            // Enable create button if there are paths
            if (canvas.hasPath()) {
                ui.enableCreateButton();
            }
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
