import processing.core.*;
import processing.data.*;
import java.util.*;
import java.io.*;
import javax.swing.*;
import java.awt.*;
import java.nio.file.Files;
import java.util.concurrent.*;

public class StrokeManager {
  private QuantumBrush app;
  private ArrayList<Stroke> strokes;
  private int currentStrokeIndex = -1;
  private String pythonCommand = null;
  private File pythonExecutable = null;
  
  // Thread pool for asynchronous processing
  private ExecutorService executorService;
  
  // Map to track which strokes are currently being processed
  private Map<String, Future<?>> processingStrokes;
  
  // Callback interface for UI updates
  public interface ProcessingCallback {
      void onProcessingComplete(String strokeId, boolean success);
  }
  
  private java.util.List<ProcessingCallback> callbacks;
  
  public StrokeManager(QuantumBrush app) {
      this.app = app;
      this.strokes = new ArrayList<>();
      this.executorService = Executors.newFixedThreadPool(3); // Allow up to 3 concurrent processes
      this.processingStrokes = new ConcurrentHashMap<>();
      this.callbacks = new ArrayList<>();
      
      // Initialize Python command on startup
      initializePythonCommand();
  }
  
  private void initializePythonCommand() {
      try {
          // First check if there's a saved custom Python path
          String customPath = loadCustomPythonPath();
          if (customPath != null && !customPath.isEmpty()) {
              File customPython = new File(customPath);
              if (customPython.exists() && customPython.canExecute()) {
                  pythonExecutable = customPython;
                  pythonCommand = customPython.getAbsolutePath();
                  System.out.println("Using custom Python path: " + pythonCommand);
                  return;
              } else {
                  System.err.println("Custom Python path is invalid: " + customPath);
              }
          }
          
          // If no custom path or it's invalid, try to find Python automatically
          boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
          
          // Try python3 command first (for macOS/Linux)
          if (!isWindows) {
              if (findPythonExecutable("python3")) {
                  return;
              }
          }
          
          // Try python command (for Windows or as fallback)
          if (findPythonExecutable("python")) {
              return;
          }
          
          // Try specific python3.10+ commands as last resort
          String[] pythonCommands = {
              "python3.12", "python3.11", "python3.10", 
              "python312", "python311", "python310"
          };
          
          for (String cmd : pythonCommands) {
              if (findPythonExecutable(cmd)) {
                  return;
              }
          }
          
          // If we get here, we couldn't find a suitable Python version
          System.err.println(
              "WARNING: Could not find Python 3.10 or higher. " +
              "The application may not work correctly."
          );
          pythonCommand = isWindows ? "python" : "python3"; // Default fallback
          
      } catch (Exception e) {
          System.err.println("Error initializing Python command: " + e.getMessage());
          e.printStackTrace();
          pythonCommand = System.getProperty("os.name").toLowerCase().contains("win") ? 
              "python" : "python3";
      }
  }
  
  private boolean findPythonExecutable(String command) {
      try {
          // First try to find the full path of the executable
          ProcessBuilder whichBuilder;
          boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
          
          if (isWindows) {
              whichBuilder = new ProcessBuilder("where", command);
          } else {
              whichBuilder = new ProcessBuilder("which", command);
          }
          
          whichBuilder.redirectErrorStream(true);
          Process whichProcess = whichBuilder.start();
          BufferedReader whichReader = new BufferedReader(
              new InputStreamReader(whichProcess.getInputStream())
          );
          String executablePath = whichReader.readLine(); // Get the first result
          whichProcess.waitFor();
          
          if (executablePath != null && !executablePath.isEmpty()) {
              File executable = new File(executablePath);
              if (executable.exists() && executable.canExecute()) {
                  System.out.println("Found Python executable: " + executablePath);
                  
                  // Now check the version
                  ProcessBuilder versionBuilder = new ProcessBuilder(executablePath, "--version");
                  versionBuilder.redirectErrorStream(true);
                  Process versionProcess = versionBuilder.start();
                  BufferedReader versionReader = new BufferedReader(
                      new InputStreamReader(versionProcess.getInputStream())
                  );
                  String versionLine = versionReader.readLine();
                  versionProcess.waitFor();
                  
                  if (versionLine != null && versionLine.toLowerCase().contains("python")) {
                      System.out.println("Python version: " + versionLine);
                      
                      // Extract version numbers
                      String[] parts = versionLine.split(" ")[1].split("\\.");
                      if (parts.length >= 2) {
                          int major = Integer.parseInt(parts[0]);
                          int minor = Integer.parseInt(parts[1]);
                          
                          boolean isCompatible = (major > 3) || 
                                                (major == 3 && minor >= 10);
                          
                          if (isCompatible) {
                              System.out.println(
                                  "Using compatible Python: " + executablePath + 
                                  " (" + versionLine + ")"
                              );
                              pythonExecutable = executable;
                              pythonCommand = executablePath;
                              return true;
                          } else {
                              System.out.println(
                                  "Python version too old: " + versionLine + 
                                  " (need 3.10 or higher)"
                              );
                          }
                      }
                  }
              }
          }
          
          return false;
      } catch (Exception e) {
          System.out.println(
              "Error finding Python executable for " + command + ": " + e.getMessage()
          );
          return false;
      }
  }
  
  public void showPythonConfigDialog() {
      JDialog dialog = new JDialog((Frame)null, "Python Configuration", true);
      dialog.setSize(600, 300);
      dialog.setLocationRelativeTo(null);
      
      JPanel mainPanel = new JPanel(new BorderLayout(10, 10));
      mainPanel.setBorder(BorderFactory.createEmptyBorder(15, 15, 15, 15));
      
      // Current Python info
      JPanel infoPanel = new JPanel(new GridLayout(3, 1, 5, 5));
      infoPanel.setBorder(BorderFactory.createTitledBorder("Current Python Information"));
      
      String currentPath = pythonExecutable != null ? 
          pythonExecutable.getAbsolutePath() : pythonCommand;
      JLabel pathLabel = new JLabel("Path: " + currentPath);
      
      String versionInfo = "Unknown";
      try {
          ProcessBuilder pb = new ProcessBuilder(pythonCommand, "--version");
          pb.redirectErrorStream(true);
          Process process = pb.start();
          BufferedReader reader = new BufferedReader(
              new InputStreamReader(process.getInputStream())
          );
          versionInfo = reader.readLine();
          process.waitFor();
      } catch (Exception e) {
          versionInfo = "Error: " + e.getMessage();
      }
      
      JLabel versionLabel = new JLabel("Version: " + versionInfo);
      
      boolean isCompatible = versionInfo.matches(".*Python 3\\.1[0-9].*") || 
                            versionInfo.matches(".*Python 3\\.[2-9][0-9].*");
      String compatibilityMsg = isCompatible ? 
          "✓ Compatible with match-case syntax" : 
          "✗ Not compatible with match-case syntax (needs Python 3.10+)";
      JLabel compatLabel = new JLabel(compatibilityMsg);
      compatLabel.setForeground(isCompatible ? new Color(0, 150, 0) : Color.RED);
      
      infoPanel.add(pathLabel);
      infoPanel.add(versionLabel);
      infoPanel.add(compatLabel);
      
      // Custom path selection
      JPanel customPanel = new JPanel(new BorderLayout(5, 5));
      customPanel.setBorder(BorderFactory.createTitledBorder("Custom Python Path"));
      
      JTextField pathField = new JTextField(20);
      if (pythonExecutable != null) {
          pathField.setText(pythonExecutable.getAbsolutePath());
      }
      
      JButton browseButton = new JButton("Browse...");
      browseButton.addActionListener(e -> {
          JFileChooser fileChooser = new JFileChooser();
          fileChooser.setDialogTitle("Select Python Executable");
          
          // Set file filter based on OS
          boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
          if (isWindows) {
              fileChooser.setFileFilter(new javax.swing.filechooser.FileFilter() {
                  public boolean accept(File f) {
                      return f.isDirectory() || f.getName().toLowerCase().endsWith(".exe");
                  }
                  public String getDescription() {
                      return "Executable files (*.exe)";
                  }
              });
          } else {
              fileChooser.setFileSelectionMode(JFileChooser.FILES_ONLY);
          }
          
          if (fileChooser.showOpenDialog(dialog) == JFileChooser.APPROVE_OPTION) {
              File selectedFile = fileChooser.getSelectedFile();
              pathField.setText(selectedFile.getAbsolutePath());
          }
      });
      
      JPanel pathPanel = new JPanel(new BorderLayout(5, 0));
      pathPanel.add(pathField, BorderLayout.CENTER);
      pathPanel.add(browseButton, BorderLayout.EAST);
      
      JButton testButton = new JButton("Test Selected Python");
      testButton.addActionListener(e -> {
          String path = pathField.getText().trim();
          if (path.isEmpty()) {
              JOptionPane.showMessageDialog(
                  dialog, 
                  "Please enter a Python path first.", 
                  "No Path", 
                  JOptionPane.WARNING_MESSAGE
              );
              return;
          }
          
          File pythonFile = new File(path);
          if (!pythonFile.exists()) {
              JOptionPane.showMessageDialog(
                  dialog, 
                  "The specified file does not exist: " + path, 
                  "File Not Found", 
                  JOptionPane.ERROR_MESSAGE
              );
              return;
          }
          
          if (!pythonFile.canExecute()) {
              JOptionPane.showMessageDialog(
                  dialog, 
                  "The specified file is not executable: " + path, 
                  "Not Executable", 
                  JOptionPane.ERROR_MESSAGE
              );
              return;
          }
          
          try {
              ProcessBuilder pb = new ProcessBuilder(path, "--version");
              pb.redirectErrorStream(true);
              Process process = pb.start();
              BufferedReader reader = new BufferedReader(
                  new InputStreamReader(process.getInputStream())
              );
              String version = reader.readLine();
              int exitCode = process.waitFor();
              
              if (exitCode == 0 && version != null && version.toLowerCase().contains("python")) {
                  boolean pythonCompatible = version.matches(".*Python 3\\.1[0-9].*") || 
                                            version.matches(".*Python 3\\.[2-9][0-9].*");
                  
                  if (pythonCompatible) {
                      JOptionPane.showMessageDialog(
                          dialog, 
                          "Python test successful!\n" + version + 
                          "\n\nThis version is compatible with match-case syntax.", 
                          "Test Successful", 
                          JOptionPane.INFORMATION_MESSAGE
                      );
                  } else {
                      JOptionPane.showMessageDialog(
                          dialog, 
                          "Python test successful, but version may be incompatible.\n" + 
                          version + 
                          "\n\nThis version may NOT support match-case syntax (needs Python 3.10+).", 
                          "Version Warning", 
                          JOptionPane.WARNING_MESSAGE
                      );
                  }
              } else {
                  JOptionPane.showMessageDialog(
                      dialog, 
                      "Failed to get Python version. Output: " + version, 
                      "Test Failed", 
                      JOptionPane.ERROR_MESSAGE
                  );
              }
          } catch (Exception ex) {
              JOptionPane.showMessageDialog(
                  dialog, 
                  "Error testing Python: " + ex.getMessage(), 
                  "Test Error", 
                  JOptionPane.ERROR_MESSAGE
              );
          }
      });
      
      customPanel.add(pathPanel, BorderLayout.NORTH);
      customPanel.add(testButton, BorderLayout.SOUTH);
      
      // Button panel
      JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
      
      JButton cancelButton = new JButton("Cancel");
      cancelButton.addActionListener(e -> dialog.dispose());
      
      JButton saveButton = new JButton("Save");
      saveButton.addActionListener(e -> {
          String path = pathField.getText().trim();
          if (path.isEmpty()) {
              JOptionPane.showMessageDialog(
                  dialog, 
                  "Please enter a Python path first.", 
                  "No Path", 
                  JOptionPane.WARNING_MESSAGE
              );
              return;
          }
          
          File pythonFile = new File(path);
          if (!pythonFile.exists() || !pythonFile.canExecute()) {
              JOptionPane.showMessageDialog(
                  dialog, 
                  "The specified file is not a valid executable: " + path, 
                  "Invalid Path", 
                  JOptionPane.ERROR_MESSAGE
              );
              return;
          }
          
          // Save the custom path
          saveCustomPythonPath(path);
          
          // Update the current Python command
          pythonExecutable = pythonFile;
          pythonCommand = path;
          
          JOptionPane.showMessageDialog(
              dialog, 
              "Python path saved successfully. It will be used for all future operations.", 
              "Path Saved", 
              JOptionPane.INFORMATION_MESSAGE
          );
          
          dialog.dispose();
      });
      
      buttonPanel.add(cancelButton);
      buttonPanel.add(saveButton);
      
      // Add all panels to main panel
      mainPanel.add(infoPanel, BorderLayout.NORTH);
      mainPanel.add(customPanel, BorderLayout.CENTER);
      mainPanel.add(buttonPanel, BorderLayout.SOUTH);
      
      dialog.add(mainPanel);
      dialog.setVisible(true);
  }
  
  private String loadCustomPythonPath() {
      try {
          File configFile = new File("config/python_path.txt");
          if (configFile.exists()) {
              return new String(Files.readAllBytes(configFile.toPath())).trim();
          }
      } catch (Exception e) {
          System.err.println("Error loading custom Python path: " + e.getMessage());
      }
      return null;
  }
  
  private void saveCustomPythonPath(String path) {
      try {
          File configDir = new File("config");
          if (!configDir.exists()) {
              configDir.mkdirs();
          }
          
          File configFile = new File("config/python_path.txt");
          Files.write(configFile.toPath(), path.getBytes());
          System.out.println("Saved custom Python path: " + path);
      } catch (Exception e) {
          System.err.println("Error saving custom Python path: " + e.getMessage());
      }
  }
  
  public String createStroke(Effect effect, Map<String, Object> parameters) {
        // Generate stroke ID
        String strokeId = "stroke_" + System.currentTimeMillis();
        
        // ✅ FIXED: Create stroke with EXACT paths from canvas (not connected)
        ArrayList<Path> canvasPaths = app.getCanvasManager().getPaths();
        
        // Create stroke and add to list
        Stroke stroke = new Stroke(
            strokeId, 
            effect, 
            parameters, 
            canvasPaths  // Use exact paths from canvas
        );

        // DEBUG: Show what parameters the stroke received
        DebugLogger.log("\n=== STROKE CREATION DEBUG ===");
        DebugLogger.log("Stroke ID: " + strokeId);
        DebugLogger.log("Effect: " + effect.getName());
        DebugLogger.log("Number of separate paths: " + canvasPaths.size());
        for (int i = 0; i < canvasPaths.size(); i++) {
            Path path = canvasPaths.get(i);
            DebugLogger.log("  Path " + i + ": " + path.getPoints().size() + " points, click at " + path.getClickPoint());
        }
        DebugLogger.log("Parameters received by Stroke:");
        for (Map.Entry<String, Object> entry : parameters.entrySet()) {
            Object value = entry.getValue();
            DebugLogger.log("  " + entry.getKey() + " = " + value + " (" + (value != null ? value.getClass().getSimpleName() : "null") + ")");
        }
        DebugLogger.log("=== END STROKE CREATION DEBUG ===\n");

        strokes.add(stroke);
        
        // Get project ID
        String projectId = app.getProjectId();
        if (projectId == null) {
            System.err.println("Error: No project ID available");
            return null;
        }
        
        // Create project directory structure
        File projectDir = new File("project/" + projectId);
        if (!projectDir.exists()) {
            projectDir.mkdirs();
            
            // Save original image
            if (app.getCurrentImage() != null) {
                String originalPath = projectDir.getPath() + "/original.png";
                app.getCurrentImage().save(originalPath);
            }
        }
        
        // Create stroke directory
        File strokeDir = new File(projectDir, "stroke");
        if (!strokeDir.exists()) {
            strokeDir.mkdirs();
        }
        
        // Generate and save JSON instructions
        String instructionsPath = strokeDir.getPath() + "/" + strokeId + "_instructions.json";
        JSONObject instructions = stroke.generateJSON(projectId);
        app.saveJSONObject(instructions, instructionsPath);

        // DEBUG: Show the final JSON that was saved
        DebugLogger.log("\n=== FINAL SAVED JSON DEBUG ===");
        DebugLogger.log("JSON saved to: " + instructionsPath);
        DebugLogger.log("Final JSON content (user_input section):");
        if (instructions.hasKey("user_input")) {
            JSONObject savedUserInput = instructions.getJSONObject("user_input");
            for (Object key : savedUserInput.keys()) {
                String paramName = (String) key;
                Object savedValue = savedUserInput.get(paramName);
                DebugLogger.log("  " + paramName + " = " + savedValue + " (" + (savedValue != null ? savedValue.getClass().getSimpleName() : "null") + ")");
            }
        } else {
            DebugLogger.log("  No user_input section found in JSON!");
        }
        DebugLogger.log("=== END FINAL SAVED JSON DEBUG ===\n");
        
        // Save input image
        if (app.getCurrentImage() != null) {
            String inputPath = strokeDir.getPath() + "/" + strokeId + "_input.png";
            app.getCurrentImage().save(inputPath);
            
            // Update JSON with image paths
            instructions = app.loadJSONObject(instructionsPath);
            JSONObject strokeInput = instructions.getJSONObject("stroke_input");
            strokeInput.setString("input_location", inputPath);
            strokeInput.setString(
            "output_location", 
            strokeDir.getPath() + "/" + strokeId + "_output.png"
            );
            instructions.setJSONObject("stroke_input", strokeInput);
            app.saveJSONObject(instructions, instructionsPath);
        }
        
        // Set current stroke index
        currentStrokeIndex = strokes.size() - 1;
        
        return strokeId;
    }
  
  // ✅ FIXED: Completely rewrite path loading to preserve separate strokes
  public void loadExistingStrokes() {
        if (app.getProjectId() == null) {
            return;
        }
        
        String projectId = app.getProjectId();
        File strokeDir = new File("project/" + projectId + "/stroke");
        
        if (!strokeDir.exists() || !strokeDir.isDirectory()) {
            return;
        }
        
        // Get all instruction JSON files
        File[] instructionFiles = strokeDir.listFiles((dir, name) -> 
            name.endsWith("_instructions.json"));
        
        if (instructionFiles == null || instructionFiles.length == 0) {
            return;
        }
        
        // Clear existing strokes if we're reloading
        if (!strokes.isEmpty()) {
            strokes.clear();
        }
        
        // Process each instruction file
        for (File file : instructionFiles) {
            try {
                JSONObject instructions = app.loadJSONObject(file.getAbsolutePath());
                String strokeId = instructions.getString("stroke_id", "");
                String effectId = instructions.getString("effect_id", "");
                
                if (strokeId.isEmpty() || effectId.isEmpty()) {
                    continue;
                }
                
                // Get the effect
                Effect effect = app.getEffectManager().getEffect(effectId);
                if (effect == null) {
                    System.err.println("Effect not found: " + effectId);
                    continue;
                }
                
                // ✅ FIXED: Extract parameters with ORIGINAL types from requirements, not JSON types
                JSONObject userInput = instructions.getJSONObject("user_input");
                Map<String, Object> parameters = new HashMap<>();
                
                System.out.println("\n=== LOADING STROKE PARAMETERS DEBUG ===");
                System.out.println("Loading stroke: " + strokeId);
                System.out.println("Effect: " + effect.getName());
                
                for (Object key : userInput.keys()) {
                    String paramName = (String) key;
                    Object jsonValue = userInput.get(paramName);
                    
                    // ✅ CRITICAL FIX: Convert JSON types back to the ORIGINAL requirement types
                    String originalType = effect.getParamType(paramName);
                    Object convertedValue = jsonValue;
                    
                    if (originalType != null) {
                        switch (originalType) {
                            case "int":
                                // Convert Integer/Double back to int
                                if (jsonValue instanceof Number) {
                                    convertedValue = ((Number) jsonValue).intValue();
                                }
                                break;
                            case "float":
                                // Convert Integer/Double back to float
                                if (jsonValue instanceof Number) {
                                    convertedValue = ((Number) jsonValue).floatValue();
                                }
                                break;
                            case "bool":
                            case "boolean":
                                // Keep boolean as-is
                                convertedValue = jsonValue;
                                break;
                            default:
                                // Keep string/color as-is
                                convertedValue = jsonValue;
                                break;
                        }
                    }
                    
                    parameters.put(paramName, convertedValue);
                    
                    System.out.println("  Loaded parameter: " + paramName + " = " + convertedValue + 
                                     " (JSON type: " + (jsonValue != null ? jsonValue.getClass().getSimpleName() : "null") + 
                                     ", converted to: " + (convertedValue != null ? convertedValue.getClass().getSimpleName() : "null") + ")");
                }
                System.out.println("=== END LOADING PARAMETERS DEBUG ===\n");
                
                // ✅ FIXED: Extract path data correctly - preserve separate paths
                // ✅ CRITICAL FIX: Reconstruct SEPARATE paths correctly
                JSONObject strokeInput = instructions.getJSONObject("stroke_input");
                JSONArray pathArray = strokeInput.getJSONArray("path");
                JSONArray clicksArray = strokeInput.getJSONArray("clicks");

                ArrayList<Path> paths = new ArrayList<>();

                System.out.println("\n=== LOADING PATH DATA DEBUG ===");
                System.out.println("Path array size: " + (pathArray != null ? pathArray.size() : 0));
                System.out.println("Clicks array size: " + (clicksArray != null ? clicksArray.size() : 0));

                // ✅ CRITICAL FIX: We need to reconstruct the ORIGINAL separate paths
                // The issue is that the JSON stores all points in one array, but we need to 
                // figure out where each separate path begins and ends

                if (pathArray != null && pathArray.size() > 0 && clicksArray != null && clicksArray.size() > 0) {
                    // For now, create separate paths based on click points
                    // Each click point represents the start of a new path
                    
                    int currentPointIndex = 0;
                    
                    for (int clickIndex = 0; clickIndex < clicksArray.size(); clickIndex++) {
                        JSONArray clickPoint = clicksArray.getJSONArray(clickIndex);
                        if (clickPoint != null && clickPoint.size() >= 2) {
                            float clickX = clickPoint.getFloat(0);
                            float clickY = clickPoint.getFloat(1);
                            
                            Path newPath = new Path();
                            newPath.setClickPoint(clickX, clickY);
                            
                            System.out.println("Creating path " + clickIndex + " with click at (" + clickX + ", " + clickY + ")");
                            
                            // Find all points that belong to this path
                            // We'll take points until we find the next click point or reach the end
                            int pointsAdded = 0;
                            while (currentPointIndex < pathArray.size()) {
                                JSONArray point = pathArray.getJSONArray(currentPointIndex);
                                if (point != null && point.size() >= 2) {
                                    float x = point.getFloat(0);
                                    float y = point.getFloat(1);
                                    
                                    // Check if this point is close to the current click point (start of path)
                                    // or if it's a continuation of the current path
                                    if (pointsAdded == 0) {
                                        // First point should be close to click point
                                        float distance = (float)Math.sqrt((x - clickX) * (x - clickX) + (y - clickY) * (y - clickY));
                                        if (distance < 50) { // Within 50 pixels of click
                                            // newPath.addPoint(x, y);
                                        	newPath.addPoint(x, y, false); // Add 'false'
                                            // pointsAdded++;
                                            pointsAdded++;
                                            currentPointIndex++;
                                            System.out.println("  Added first point " + pointsAdded + ": (" + x + ", " + y + ")");
                                        } else {
                                            // This point doesn't belong to this path
                                            break;
                                        }
                                    } else {
                                        // Check if we've reached the next click point
                                        boolean isNextClickPoint = false;
                                        if (clickIndex + 1 < clicksArray.size()) {
                                            JSONArray nextClick = clicksArray.getJSONArray(clickIndex + 1);
                                            if (nextClick != null && nextClick.size() >= 2) {
                                                float nextClickX = nextClick.getFloat(0);
                                                float nextClickY = nextClick.getFloat(1);
                                                float distanceToNextClick = (float)Math.sqrt(
                                                    (x - nextClickX) * (x - nextClickX) + (y - nextClickY) * (y - nextClickY)
                                                );
                                                if (distanceToNextClick < 20) { // Very close to next click point
                                                    isNextClickPoint = true;
                                                }
                                            }
                                        }
                                        
                                        if (isNextClickPoint) {
                                            // This point belongs to the next path
                                            break;
                                        } else {
                                            // This point belongs to current path
                                            newPath.addPoint(x, y, false);
                                            pointsAdded++;
                                            currentPointIndex++;
                                            System.out.println("  Added point " + pointsAdded + ": (" + x + ", " + y + ")");
                                        }
                                    }
                                } else {
                                    currentPointIndex++;
                                }
                            }
                            
                            if (newPath.hasPoints()) {
                                paths.add(newPath);
                                System.out.println("  Created path with " + newPath.getPoints().size() + " points");
                            }
                        }
                    }
                } else if (pathArray != null && pathArray.size() > 0) {
                    // Fallback: if no clicks, create one path with all points
                    Path singlePath = new Path();
                    for (int i = 0; i < pathArray.size(); i++) {
                        JSONArray point = pathArray.getJSONArray(i);
                        if (point != null && point.size() >= 2) {
                            float x = point.getFloat(0);
                            float y = point.getFloat(1);
                            singlePath.addPoint(x, y, false);
                        }
                    }
                    if (singlePath.hasPoints()) {
                        paths.add(singlePath);
                    }
                }

                System.out.println("Total paths reconstructed: " + paths.size());
                System.out.println("=== END LOADING PATH DATA DEBUG ===\n");
                
                // Create the stroke object and add it to the list
                Stroke stroke = new Stroke(strokeId, effect, parameters, paths);
                strokes.add(stroke);
                
            } catch (Exception e) {
                System.err.println("Error loading stroke from " + file.getName() + ": " + e.getMessage());
                e.printStackTrace();
            }
        }
        
        // After loading all strokes, sort them by timestamp (most recent last)
        if (!strokes.isEmpty()) {
            strokes.sort((a, b) -> {
              // Extract timestamp from stroke ID (format: stroke_timestamp)
              long timeA = Long.parseLong(a.getId().substring(a.getId().indexOf('_') + 1));
              long timeB = Long.parseLong(b.getId().substring(b.getId().indexOf('_') + 1));
              return Long.compare(timeA, timeB);
            });
            
            // Set current stroke index to the most recent stroke
            currentStrokeIndex = strokes.size() - 1;
        }
    }

  // Modify the showStrokeManager method to load existing strokes
  public void showStrokeManager() {
        // Load existing strokes first
        loadExistingStrokes();
        
        if (!strokes.isEmpty()) {
            app.getUIManager().createStrokeManagerWindow(this);
        } else {
            // Instead of showing a message that blocks interaction, show a non-modal dialog
            JOptionPane optionPane = new JOptionPane(
                "No strokes available. Create a stroke first by drawing a path and clicking 'Create'.",
                JOptionPane.INFORMATION_MESSAGE
            );
            JDialog dialog = optionPane.createDialog("No Strokes");
            dialog.setModal(false);
            dialog.setVisible(true);
            
            // Auto-close the dialog after 3 seconds
            javax.swing.Timer timer = new javax.swing.Timer(3000, e -> dialog.dispose());
            timer.setRepeats(false);
            timer.start();
        }
    }
  
  public Stroke getCurrentStroke() {
      if (currentStrokeIndex >= 0 && currentStrokeIndex < strokes.size()) {
          return strokes.get(currentStrokeIndex);
      }
      return null;
  }
  
  public void nextStroke() {
      if (currentStrokeIndex < strokes.size() - 1) {
          currentStrokeIndex++;
      }
  }
  
  public void previousStroke() {
      if (currentStrokeIndex > 0) {
          currentStrokeIndex--;
      }
  }
  
  public void runCurrentStroke() {
      Stroke stroke = getCurrentStroke();
      if (stroke != null) {
          runStroke(stroke);
      } else {
          JOptionPane.showMessageDialog(
              null, 
              "No stroke selected or available.", 
              "No Stroke", 
              JOptionPane.WARNING_MESSAGE
          );
      }
  }
  
  /**
   * Runs the effect processing for a stroke asynchronously.
   * This method will not block the UI thread.
   */
public void runStroke(Stroke stroke) {
    try {
        final String strokeId = stroke.getId();
        
        // Check if this stroke is already being processed
        if (processingStrokes.containsKey(strokeId)) {
            JOptionPane.showMessageDialog(
                null, 
                "This stroke is already being processed. Please wait for it to complete.", 
                "Processing in Progress", 
                JOptionPane.INFORMATION_MESSAGE
            );
            return;
        }
        
        Effect effect = stroke.getEffect();
        String effectId = effect.getId();
        String folderName = effect.getFolderName();
        final String projectId = app.getProjectId();
        
        // Define instructionsPath once here to use throughout the method
        final String instructionsPath = "project/" + projectId + "/stroke/" + strokeId + "_instructions.json";
        File instructionsFile = new File(instructionsPath);
        
        // Check if the stroke is in a failed state and needs cleanup
        if (instructionsFile.exists()) {
            JSONObject instructions = app.loadJSONObject(instructionsPath);
            String processingStatus = instructions.getString("processing_status", "");
            
            // If the stroke is in a "running" state but not in our processing map,
            // it means the previous run crashed or was interrupted
            if ("running".equals(processingStatus) && !processingStrokes.containsKey(strokeId)) {
                // Reset the status to allow reprocessing
                instructions.setString("processing_status", "pending");
                app.saveJSONObject(instructions, instructionsPath);
            }
        }
        
        // Check if Python script exists
        File pythonScript = new File("effect/" + folderName + "/" + effectId + ".py");
        if (!pythonScript.exists()) {
            // Try with folder name as fallback
            pythonScript = new File("effect/" + folderName + "/" + folderName + ".py");
            if (!pythonScript.exists()) {
                JOptionPane.showMessageDialog(
                    null, 
                    "Python script not found: " + pythonScript.getAbsolutePath(), 
                    "Error", 
                    JOptionPane.ERROR_MESSAGE
                );
                return;
            }
        }
        
        // Ensure directories exist
        File projectDir = new File("project/" + projectId);
        File strokeDir = new File(projectDir, "stroke");
        if (!projectDir.exists()) projectDir.mkdirs();
        if (!strokeDir.exists()) strokeDir.mkdirs();
        
        // Ensure instructions file exists
        if (!instructionsFile.exists()) {
            JSONObject instructions = stroke.generateJSON(projectId);
            app.saveJSONObject(instructions, instructionsPath);
        }
        
        // Update status fields to indicate processing has started
        JSONObject instructions = app.loadJSONObject(instructionsPath);
        instructions.setBoolean("created", true);
        instructions.setString("effect_received", "null");
        instructions.setString("effect_processed", "null");
        instructions.setString("effect_success", "null");
        instructions.setString("processing_status", "running");
        app.saveJSONObject(instructions, instructionsPath);
        
        // Create a task to execute the Python script asynchronously
        Runnable task = () -> {
            boolean success = false;
            
            try {
                // Execute Python script with absolute path
                success = executeApplyEffectScript(instructionsFile.getAbsolutePath());
                
                // Update status based on result
                JSONObject updatedInstructions = app.loadJSONObject(instructionsPath);
                if (success) {
                    updatedInstructions.setString("effect_received", "true");
                    updatedInstructions.setString("effect_processed", "true");
                    updatedInstructions.setString("effect_success", "true");
                    updatedInstructions.setString("processing_status", "completed");
                    app.saveJSONObject(updatedInstructions, instructionsPath);
                    
                    // Notify on the Event Dispatch Thread
                    SwingUtilities.invokeLater(() -> {
                        notifyProcessingComplete(strokeId, true);
                    });
                } else {
                    updatedInstructions.setString("effect_received", "true");
                    updatedInstructions.setString("effect_processed", "true");
                    updatedInstructions.setString("effect_success", "false");
                    updatedInstructions.setString("processing_status", "failed");
                    app.saveJSONObject(updatedInstructions, instructionsPath);
                    
                    // Notify on the Event Dispatch Thread
                    SwingUtilities.invokeLater(() -> {
                        notifyProcessingComplete(strokeId, false);
                    });
                }
            } catch (InterruptedException e) {
                // This exception is thrown when the thread is interrupted (e.g., when cancelling)
                System.err.println("Process execution interrupted");
                
                // Update the instructions file to reflect cancellation
                try {
                    JSONObject updatedInstructions = app.loadJSONObject(instructionsPath);
                    updatedInstructions.setString("effect_success", "false");
                    updatedInstructions.setString("processing_status", "canceled");
                    updatedInstructions.setString("error_message", "Process was cancelled by user");
                    app.saveJSONObject(updatedInstructions, instructionsPath);
                } catch (Exception ex) {
                    System.err.println("Error updating instructions file after cancellation: " + ex.getMessage());
                }
                
                // Notify on the Event Dispatch Thread
                SwingUtilities.invokeLater(() -> {
                    notifyProcessingComplete(strokeId, false);
                });
                
                // Preserve interrupt status
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                System.err.println("Error in background processing: " + e.getMessage());
                e.printStackTrace();
                
                try {
                    JSONObject updatedInstructions = app.loadJSONObject(instructionsPath);
                    updatedInstructions.setString("effect_success", "false");
                    updatedInstructions.setString("processing_status", "failed");
                    updatedInstructions.setString("error_message", e.getMessage());
                    app.saveJSONObject(updatedInstructions, instructionsPath);
                } catch (Exception ex) {
                    System.err.println("Error updating instructions file: " + ex.getMessage());
                }
                
                // Notify on the Event Dispatch Thread
                SwingUtilities.invokeLater(() -> {
                    notifyProcessingComplete(strokeId, false);
                });
            }
        };
        
        // Submit the task to the executor service
        Future<?> future = executorService.submit(task);
        
        // Store the future for potential cancellation
        processingStrokes.put(strokeId, future);
        
        // Show simple, non-dramatic processing notification
        SwingUtilities.invokeLater(() -> {
            // ✅ FIXED: Call the correct renamed method
            app.getUIManager().refreshStrokeManagerContent(this);
            
            // Show a simple toast notification
            JWindow notification = new JWindow();
            notification.setSize(200, 50);
            notification.setLocationRelativeTo(null);
            
            JPanel notificationPanel = new JPanel(new BorderLayout());
            notificationPanel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(Color.BLUE, 2),
                BorderFactory.createEmptyBorder(8, 12, 8, 12)
            ));
            notificationPanel.setBackground(new Color(240, 248, 255));
            
            JLabel messageLabel = new JLabel("Processing...");
            messageLabel.setHorizontalAlignment(JLabel.CENTER);
            messageLabel.setFont(new Font("Arial", Font.PLAIN, 12));
            notificationPanel.add(messageLabel, BorderLayout.CENTER);
            
            notification.add(notificationPanel);
            notification.setVisible(true);
            
            // Auto-close after 1.5 seconds
            javax.swing.Timer timer = new javax.swing.Timer(1500, evt -> notification.dispose());
            timer.setRepeats(false);
            timer.start();
        });
        
    } catch (Exception e) {
        System.err.println("Error starting effect processing: " + e.getMessage());
        e.printStackTrace();
        JOptionPane.showMessageDialog(
            null, 
            "Error starting effect processing: " + e.getMessage(), 
            "Error", 
            JOptionPane.ERROR_MESSAGE
        );
    }
}
    
    /**
     * Cancels the processing of a stroke if it's currently running.
     * * @param strokeId The ID of the stroke to cancel
     * @return true if the stroke was canceled, false if it wasn't running or couldn't be canceled
     */
    public boolean cancelStrokeProcessing(String strokeId) {
        Future<?> future = processingStrokes.get(strokeId);
        if (future != null && !future.isDone()) {
            // Cancel the future with interruption
            boolean canceled = future.cancel(true);
        
            if (canceled) {
                // Remove from processing map immediately to prevent race conditions
                processingStrokes.remove(strokeId);
            
                // Update the status in the instructions file
                try {
                    String projectId = app.getProjectId();
                    String instructionsPath = "project/" + projectId + "/stroke/" + strokeId + "_instructions.json";
                    JSONObject instructions = app.loadJSONObject(instructionsPath);
                    instructions.setString("processing_status", "canceled");
                    instructions.setString("effect_success", "false");
                    instructions.setString("error_message", "Process was cancelled by user");
                    app.saveJSONObject(instructions, instructionsPath);
                } catch (Exception e) {
                    System.err.println("Error updating instructions file: " + e.getMessage());
                }
            
                // Notify the UI
                SwingUtilities.invokeLater(() -> {
                    // ✅ FIXED: Call the correct renamed method
                    app.getUIManager().refreshStrokeManagerContent(this);
                
                    // Show a non-blocking notification
                    JOptionPane optionPane = new JOptionPane(
                        "Effect processing has been cancelled.",
                        JOptionPane.INFORMATION_MESSAGE
                    );
                    JDialog dialog = optionPane.createDialog("Processing Cancelled");
                    dialog.setModal(false);
                    dialog.setVisible(true);
                
                    // Auto-close after 2 seconds
                    javax.swing.Timer timer = new javax.swing.Timer(2000, e -> dialog.dispose());
                    timer.setRepeats(false);
                    timer.start();
                });
            }
            return canceled;
        }
        return false;
    }
    
    /**
     * Adds a callback to be notified when stroke processing completes.
     */
    public void addProcessingCallback(ProcessingCallback callback) {
        if (!callbacks.contains(callback)) {
            callbacks.add(callback);
        }
    }
    
    /**
     * Removes a processing callback.
     */
    public void removeProcessingCallback(ProcessingCallback callback) {
        callbacks.remove(callback);
    }
    
    /**
     * ✅ NEW: Enhanced notification with auto-refresh and focus
     * Notifies all registered callbacks that processing has completed.
     */
    private void notifyProcessingComplete(String strokeId, boolean success) {
        // Remove from processing map before notifying callbacks
        processingStrokes.remove(strokeId);
        
        // ✅ NEW: Auto-refresh Stroke Manager and focus on the completed stroke
        SwingUtilities.invokeLater(() -> {
            app.getUIManager().refreshStrokeManagerAndFocus(strokeId);
        });
        
        // Only show success notification, not failure (to avoid spam)
        if (success) {
            // Show a single, non-blocking success notification
            SwingUtilities.invokeLater(() -> {
                // Create a simple toast notification that doesn't block
                JWindow notification = new JWindow();
                notification.setSize(280, 60);
                notification.setLocationRelativeTo(null);
                
                JPanel notificationPanel = new JPanel(new BorderLayout());
                notificationPanel.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(new Color(0, 150, 0), 2),
                    BorderFactory.createEmptyBorder(8, 12, 8, 12)
                ));
                notificationPanel.setBackground(new Color(240, 255, 240));
                
                JLabel messageLabel = new JLabel("Processing completed successfully!");
                messageLabel.setHorizontalAlignment(JLabel.CENTER);
                messageLabel.setForeground(new Color(0, 100, 0));
                messageLabel.setFont(new Font("Arial", Font.BOLD, 12));
                notificationPanel.add(messageLabel, BorderLayout.CENTER);
                
                notification.add(notificationPanel);
                notification.setVisible(true);
                
                // Auto-close after 2.5 seconds
                javax.swing.Timer timer = new javax.swing.Timer(2500, evt -> notification.dispose());
                timer.setRepeats(false);
                timer.start();
            });
        }
        
        // Now notify all registered callbacks (but don't show additional dialogs)
        for (ProcessingCallback callback : callbacks) {
            try {
                callback.onProcessingComplete(strokeId, success);
            } catch (Exception e) {
                System.err.println("Error in processing callback: " + e.getMessage());
            }
        }
    }
    
    /**
     * Checks if a stroke is currently being processed.
     */
    public boolean isStrokeProcessing(String strokeId) {
        Future<?> future = processingStrokes.get(strokeId);
        return future != null && !future.isDone();
    }
    
    /**
     * Gets the processing status of a stroke from its instructions file.
     */
    public String getStrokeProcessingStatus(String strokeId) {
        try {
            String projectId = app.getProjectId();
            String instructionsPath = "project/" + projectId + "/stroke/" + strokeId + "_instructions.json";
            File instructionsFile = new File(instructionsPath);
            
            if (instructionsFile.exists()) {
                JSONObject instructions = app.loadJSONObject(instructionsFile);
                return instructions.getString("processing_status", "unknown");
            }
        } catch (Exception e) {
            System.err.println("Error getting stroke status: " + e.getMessage());
        }
        return "unknown";
    }
    
    private boolean executeApplyEffectScript(String instructionsFilePath) throws InterruptedException, IOException {
        Process process = null;
        try {
            // Check if we need to re-initialize Python command
            if (pythonCommand == null) {
                initializePythonCommand();
            }
            
            // Create log directory if it doesn't exist
            File logDir = new File("log");
            if (!logDir.exists()) {
                logDir.mkdirs();
            }
            
            // Create log files for stdout and stderr
            File stdoutLog = new File("log/python_stdout.log");
            File stderrLog = new File("log/python_stderr.log");
            
            // Display Python version information
            ProcessBuilder versionProcessBuilder = new ProcessBuilder(pythonCommand, "--version");
            versionProcessBuilder.redirectErrorStream(true);
            
            Process versionProcess = versionProcessBuilder.start();
            BufferedReader versionReader = new BufferedReader(
                new InputStreamReader(versionProcess.getInputStream())
            );
            String versionLine;
            while ((versionLine = versionReader.readLine()) != null) {
                System.out.println(
                    "Using Python: " + versionLine + " (from: " + pythonCommand + ")"
                );
                
                // Check if version is compatible with match-case syntax (Python 3.10+)
                if (versionLine.matches(".*Python 3\\.[0-9](\\..*)?")) {
                    String minorVersionStr = versionLine.replaceAll(
                        ".*Python 3\\.([0-9])(\\..*)?", "$1"
                    );
                    try {
                        int minorVersion = Integer.parseInt(minorVersionStr);
                        if (minorVersion < 10) {
                            System.err.println(
                                "WARNING: Python version is " + versionLine + 
                                " but match-case syntax requires Python 3.10 or higher!"
                            );
                            
                            // Don't show dialog in background thread
                            return false;
                        }
                    } catch (NumberFormatException e) {
                        System.err.println("Could not parse Python version: " + versionLine);
                    }
                }
            }
            versionProcess.waitFor();
            
            // Create command to execute Python script
            ProcessBuilder processBuilder = new ProcessBuilder(
                pythonCommand, "effect/apply_effect.py", instructionsFilePath
            );
            processBuilder.redirectOutput(ProcessBuilder.Redirect.appendTo(stdoutLog));
            processBuilder.redirectError(ProcessBuilder.Redirect.appendTo(stderrLog));
            
            // Execute process
            process = processBuilder.start();
            
            // ✅ FIXED: NO TIMEOUT - wait indefinitely for completion
            // This allows quantum operations and high-resolution processing to complete
            System.out.println("Starting effect processing...");
            process.waitFor(); // Wait indefinitely
            
            // Get exit code
            int exitCode = process.exitValue();
            
            // Check the effect_success flag in the JSON file
            JSONObject instructions = app.loadJSONObject(instructionsFilePath);
            String projectId = instructions.getString("project_id", "");
            String strokeId = instructions.getString("stroke_id", "");
            String outputPath = "project/" + projectId + "/stroke/" + strokeId + "_output.png";
            File outputFile = new File(outputPath);
            String effectSuccess = instructions.getString("effect_success", "false");
            
            boolean success = exitCode == 0 && "true".equals(effectSuccess) && outputFile.exists();
            
            if (!success) {
                System.err.println("Python script execution failed with exit code: " + exitCode);
                System.err.println("Effect success flag: " + effectSuccess);
                System.err.println("Output file exists: " + outputFile.exists());
                
                // Read error log
                if (stderrLog.exists()) {
                    try (BufferedReader reader = new BufferedReader(new FileReader(stderrLog))) {
                        String line;
                        System.err.println("Python error log:");
                        while ((line = reader.readLine()) != null) {
                            System.err.println("  " + line);
                        }
                    } catch (IOException e) {
                        System.err.println("Could not read error log: " + e.getMessage());
                    }
                }
            }
            
            return success;
            
        } catch (InterruptedException e) {
            // Handle cancellation properly
            System.err.println("Process execution interrupted");
            
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
                System.out.println("Forcibly terminated process due to cancellation");
            }
            
            // Update the instructions file to reflect cancellation
            try {
                JSONObject instructions = app.loadJSONObject(instructionsFilePath);
                instructions.setString("effect_success", "false");
                instructions.setString("processing_status", "canceled");
                instructions.setString("error_message", "Process was cancelled by user");
                app.saveJSONObject(instructions, instructionsFilePath);
            } catch (Exception ex) {
                System.err.println("Error updating instructions file after cancellation: " + ex.getMessage());
            }
            
            throw e;
        }
    }
    
    /**
     * FIXED: Apply effect to canvas by properly layering on top of current image
     * This method now correctly preserves previous effects and creates proper undo states
     */
    public boolean applyEffectToCanvas(String strokeId) {
        String projectId = app.getProjectId();
        if (projectId == null || strokeId == null) {
            System.err.println("Error: Project ID or Stroke ID is null");
            return false;
        }
        
        // Check if the effect was successful
        String instructionsPath = "project/" + projectId + "/stroke/" + 
                                 strokeId + "_instructions.json";
        File instructionsFile = new File(instructionsPath);
        
        if (!instructionsFile.exists()) {
            JOptionPane.showMessageDialog(
                null, 
                "Effect instructions not found. The stroke may be corrupted.", 
                "Error", 
                JOptionPane.ERROR_MESSAGE
            );
            return false;
        }
        
        JSONObject instructions = app.loadJSONObject(instructionsPath);
        String effectSuccess = instructions.getString("effect_success", "false");
        
        if (!"true".equals(effectSuccess)) {
            JOptionPane.showMessageDialog(
                null, 
                "Effect was not successfully processed. Please run the effect first.", 
                "Error", 
                JOptionPane.ERROR_MESSAGE
            );
            return false;
        }
        
        // Get the effect output image (just the effect, not layered)
        String outputPath = "project/" + projectId + "/stroke/" + strokeId + "_output.png";
        PImage effectImage = app.loadImage(outputPath);
        
        if (effectImage == null) {
            System.err.println("Failed to load effect output image: " + outputPath);
            JOptionPane.showMessageDialog(
                null, 
                "Failed to load effect output image.", 
                "Error", 
                JOptionPane.ERROR_MESSAGE
            );
            return false;
        }
        
        // Get the current image (which may already have previous effects applied)
        PImage currentImage = app.getCurrentImage();
        if (currentImage == null) {
            System.err.println("No current image available");
            JOptionPane.showMessageDialog(
                null, 
                "No current image available.", 
                "Error", 
                JOptionPane.ERROR_MESSAGE
            );
            return false;
        }
        
        // IMPORTANT: Create a new image by blending the effect on top of the current image
        // This preserves all previous effects and changes
        PImage resultImage = app.createImage(
            currentImage.width, 
            currentImage.height, 
            PConstants.ARGB
        );
        
        // Copy the current image as the base (this preserves all previous effects)
        resultImage.copy(
            currentImage, 
            0, 0, currentImage.width, currentImage.height, 
            0, 0, resultImage.width, resultImage.height
        );
        
        // Blend the new effect image on top of the existing image
        // This adds the new effect while preserving everything underneath
        resultImage.blend(
            effectImage, 
            0, 0, effectImage.width, effectImage.height, 
            0, 0, resultImage.width, resultImage.height, 
            PConstants.BLEND
        );
        
        // Set the result as the new current image
        app.setCurrentImage(resultImage);
        
        // CRITICAL: Save project state AFTER applying the effect
        // This creates a new undo point with the combined result
        // The user can now undo to the state before this effect was applied
        app.saveProjectStateAfterImageChange();
        
        // Update project metadata to reflect the change
        app.getFileManager().updateProjectMetadata(projectId);

        // IMPORTANT: Save the current state to disk
        if (projectId != null) {
            String projectPath = "project/" + projectId;
            File projectDir = new File(projectPath);
            if (projectDir.exists()) {
                resultImage.save(projectPath + "/current.png");
                System.out.println("Saved current state after applying effect");
            }
        }

        // Clear drawing paths (but don't save this as a project state)
        app.getCanvasManager().clearPaths();
        
        System.out.println("Effect applied to canvas successfully! New undo state created.");
        
        return true;
    }
    
    // ✅ FIXED: Add delete stroke functionality
    public boolean deleteStroke(String strokeId) {
        if (strokeId == null || strokeId.isEmpty()) {
            return false;
        }
        
        try {
            String projectId = app.getProjectId();
            if (projectId == null) {
                return false;
            }
            
            // Cancel processing if the stroke is currently running
            if (isStrokeProcessing(strokeId)) {
                cancelStrokeProcessing(strokeId);
            }
            
            // Remove from strokes list
            strokes.removeIf(stroke -> stroke.getId().equals(strokeId));
            
            // Delete stroke files
            String strokeDir = "project/" + projectId + "/stroke/";
            File instructionsFile = new File(strokeDir + strokeId + "_instructions.json");
            File inputFile = new File(strokeDir + strokeId + "_input.png");
            File outputFile = new File(strokeDir + strokeId + "_output.png");
            
            boolean success = true;
            if (instructionsFile.exists()) {
                success &= instructionsFile.delete();
            }
            if (inputFile.exists()) {
                success &= inputFile.delete();
            }
            if (outputFile.exists()) {
                success &= outputFile.delete();
            }
            
            // Update current stroke index if needed
            if (currentStrokeIndex >= strokes.size()) {
                currentStrokeIndex = strokes.size() - 1;
            }
            
            return success;
            
        } catch (Exception e) {
            System.err.println("Error deleting stroke: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
    
    // ✅ FIXED: Add methods to support UIManager
    public int getStrokeCount() {
        return strokes.size();
    }
    
    public Stroke getStroke(int index) {
        if (index >= 0 && index < strokes.size()) {
            return strokes.get(index);
        }
        return null;
    }
    
    public boolean hasStrokes() {
        return !strokes.isEmpty();
    }
    
    public void clearStrokes() {
        strokes.clear();
        currentStrokeIndex = -1;
        processingStrokes.clear();
    }
    
    /**
     * Cleans up resources when the application is closing.
     * This should be called when the application is shutting down.
     */
    public void shutdown() {
        // Cancel all running tasks
        for (Map.Entry<String, Future<?>> entry : processingStrokes.entrySet()) {
            entry.getValue().cancel(true);
        }
        
        // Shutdown the executor service
        executorService.shutdownNow();
        try {
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                System.err.println("Executor service did not terminate in the specified time.");
            }
        } catch (InterruptedException e) {
            System.err.println("Executor service shutdown interrupted: " + e.getMessage());
        }
    }
    
    /**
     * ✅ NEW: Updates a stroke's parameters and saves the changes to its JSON file.
     * This allows parameters to be edited from the Stroke Manager UI.
     *
     * @param strokeId The ID of the stroke to update.
     * @param newParameters A map containing the new parameters.
     * @return true if the update was successful, false otherwise.
     */
    public boolean updateStroke(String strokeId, Map<String, Object> newParameters) {
        Stroke strokeToUpdate = null;
        for (Stroke s : strokes) {
            if (s.getId().equals(strokeId)) {
                strokeToUpdate = s;
                break;
            }
        }

        if (strokeToUpdate != null) {
            try {
                // Update the parameters in the stroke object
                strokeToUpdate.setParameters(newParameters);

                // Regenerate and save the JSON
                String projectId = app.getProjectId();
                JSONObject instructions = strokeToUpdate.generateJSON(projectId);
                String instructionsPath = "project/" + projectId + "/stroke/" + strokeId + "_instructions.json";
                
                // Mark the stroke as pending again, as its parameters have changed.
                // This is important so it can be re-run.
                instructions.setString("processing_status", "pending");
                instructions.setString("effect_success", "null"); // Reset success flag
                
                app.saveJSONObject(instructions, instructionsPath);

                System.out.println("Stroke " + strokeId + " updated successfully. Its status has been reset to 'pending'.");
                return true;
            } catch (Exception e) {
                System.err.println("Failed to update stroke " + strokeId + ": " + e.getMessage());
                e.printStackTrace();
                return false;
            }
        } else {
            System.err.println("Could not find stroke to update with ID: " + strokeId);
            return false;
        }
    }

    public static class Stroke {
        private String id;
        private Effect effect;
        private Map<String, Object> parameters;
        private ArrayList<Path> paths;
        
        public Stroke(
            String id, 
            Effect effect, 
            Map<String, Object> parameters, 
            ArrayList<Path> paths
        ) {
            this.id = id;
            this.effect = effect;
            this.parameters = parameters;
            this.paths = new ArrayList<>(paths); // Make a copy of the paths
        }
        
        public String getId() {
            return id;
        }
        
        public Effect getEffect() {
            return effect;
        }
        
        public Map<String, Object> getParameters() {
            return parameters;
        }
        
        /**
         * ✅ NEW: Sets the parameters for the stroke.
         * @param parameters The new map of parameters.
         */
        public void setParameters(Map<String, Object> parameters) {
            this.parameters = new HashMap<>(parameters); // Store a copy to prevent external modification
        }
        
        public ArrayList<Path> getPaths() {
            return paths;
        }
        
        public JSONObject generateJSON(String projectId) {
            DebugLogger.log("\n=== JSON GENERATION DEBUG START ===");
            DebugLogger.log("Generating JSON for stroke: " + id);
            DebugLogger.log("Effect: " + effect.getName() + " (ID: " + effect.getId() + ")");
            DebugLogger.log("Project ID: " + projectId);
            
            DebugLogger.log("\nParameters to convert to JSON:");
            for (Map.Entry<String, Object> entry : parameters.entrySet()) {
                Object value = entry.getValue();
                DebugLogger.log("  " + entry.getKey() + " = " + value + " (" + (value != null ? value.getClass().getSimpleName() : "null") + ")");
            }
            
            JSONObject json = new JSONObject();
            
            // Add basic info
            json.setString("stroke_id", id);
            json.setString("project_id", projectId);
            json.setString("effect_id", effect.getId());
            
            // ✅ FIXED: Use the AUTOMATIC requirements from the loaded JSON files
            // The Effect class already loads these automatically from effect/{name}/{name}_requirements.json
            JSONObject userInput = new JSONObject();
            
            DebugLogger.log("\nProcessing parameters using AUTOMATIC requirements:");
            
            for (Map.Entry<String, Object> entry : parameters.entrySet()) {
                String paramName = entry.getKey();
                Object value = entry.getValue();
                
                DebugLogger.log("\n--- Processing parameter: " + paramName + " ---");
                DebugLogger.log("Input value: " + value + " (" + (value != null ? value.getClass().getSimpleName() : "null") + ")");
                
                // ✅ Use the AUTOMATIC type detection from the loaded requirements
                String paramType = effect.getParamType(paramName);
                DebugLogger.log("Automatic type from requirements: " + paramType);
                
                if (paramType != null) {
                    switch (paramType) {
                        case "bool":
                        case "boolean":
                            boolean boolValue = false;
                            if (value instanceof Boolean) {
                                boolValue = (Boolean) value;
                            } else if (value instanceof String) {
                                String strValue = value.toString().toLowerCase().trim();
                                boolValue = "true".equals(strValue) || "on".equals(strValue);
                            } else {
                                boolValue = Boolean.parseBoolean(value.toString());
                            }
                            userInput.setBoolean(paramName, boolValue);
                            DebugLogger.log("Set as boolean: " + boolValue);
                            
                            // ✅ CRITICAL DEBUG: Check what was actually stored
                            Object storedValue = userInput.get(paramName);
                            DebugLogger.log("CRITICAL: What was actually stored in JSON: " + storedValue + " (type: " + (storedValue != null ? storedValue.getClass().getSimpleName() : "null") + ")");
                            
                            break;
                            
                        case "int":
                            int intValue = 0;
                            if (value instanceof Number) {
                                intValue = ((Number) value).intValue();
                            } else {
                                try {
                                    intValue = Integer.parseInt(value.toString());
                                } catch (NumberFormatException e) {
                                    Object defaultValue = effect.getParamDefault(paramName);
                                    intValue = defaultValue instanceof Number ? ((Number)defaultValue).intValue() : 0;
                                }
                            }
                            userInput.setInt(paramName, intValue);
                            DebugLogger.log("Set as int: " + intValue);
                            break;
                            
                        case "float":
                            float floatValue = 0.0f;
                            if (value instanceof Number) {
                                floatValue = ((Number) value).floatValue();
                            } else {
                                try {
                                    floatValue = Float.parseFloat(value.toString());
                                } catch (NumberFormatException e) {
                                    Object defaultValue = effect.getParamDefault(paramName);
                                    floatValue = defaultValue instanceof Number ? ((Number)defaultValue).floatValue() : 0.0f;
                                }
                            }
                            userInput.setFloat(paramName, floatValue);
                            DebugLogger.log("Set as float: " + floatValue);
                            break;
                            
                        case "color":
                        case "string":
                        default:
                            String stringValue = value.toString();
                            userInput.setString(paramName, stringValue);
                            DebugLogger.log("Set as string: " + stringValue);
                            break;
                    }
                } else {
                    // Fallback if type not found in requirements
                    DebugLogger.log("No type found in requirements, using fallback");
                    if (value instanceof Boolean) {
                        userInput.setBoolean(paramName, (Boolean) value);
                    } else if (value instanceof Integer) {
                        userInput.setInt(paramName, (Integer) value);
                    } else if (value instanceof Float) {
                        userInput.setFloat(paramName, (Float) value);
                    } else {
                        userInput.setString(paramName, value.toString());
                    }
                }
            }

            json.setJSONObject("user_input", userInput);

            DebugLogger.log("\nFinal JSON user_input object:");
            for (Object key : userInput.keys()) {
                String paramName = (String) key;
                Object jsonValue = userInput.get(paramName);
                DebugLogger.log("  " + paramName + " = " + jsonValue + " (" + (jsonValue != null ? jsonValue.getClass().getSimpleName() : "null") + ")");
            }

            // ✅ FIXED: Add stroke input with SEPARATE paths (not connected)
            JSONObject strokeInput = new JSONObject();
            strokeInput.setBoolean("real_hardware", false);

            // ✅ CRITICAL FIX: Create path array preserving SEPARATE paths
            JSONArray pathArray = new JSONArray();
            JSONArray clicksArray = new JSONArray();
            
            DebugLogger.log("\n=== PATH SERIALIZATION DEBUG ===");
            DebugLogger.log("Number of separate paths to serialize: " + paths.size());
            
            for (int pathIndex = 0; pathIndex < paths.size(); pathIndex++) {
                Path path = paths.get(pathIndex);
                DebugLogger.log("Processing path " + pathIndex + " with " + path.getPoints().size() + " points");
                
                // Add click point for this path
                PVector clickPoint = path.getClickPoint();
                if (clickPoint != null) {
                    JSONArray clickArray = new JSONArray();
                    clickArray.append(Math.round(clickPoint.x));
                    clickArray.append(Math.round(clickPoint.y));
                    clicksArray.append(clickArray);
                    DebugLogger.log("  Added click point: (" + clickPoint.x + ", " + clickPoint.y + ")");
                }
                
                // Add all points from this path
                ArrayList<PVector> points = path.getPoints();
                for (PVector point : points) {
                    JSONArray pointArray = new JSONArray();
                    pointArray.append(Math.round(point.x));
                    pointArray.append(Math.round(point.y));
                    pathArray.append(pointArray);
                }
                DebugLogger.log("  Added " + points.size() + " points from path " + pathIndex);
            }
            
            strokeInput.setJSONArray("path", pathArray);
            strokeInput.setJSONArray("clicks", clicksArray);
            
            DebugLogger.log("Total points in path array: " + pathArray.size());
            DebugLogger.log("Total click points: " + clicksArray.size());
            DebugLogger.log("=== END PATH SERIALIZATION DEBUG ===");
            
            json.setJSONObject("stroke_input", strokeInput);
            
            // Add status fields
            json.setBoolean("created", true);
            json.setString("effect_received", "null");
            json.setString("effect_processed", "null");
            json.setString("effect_success", "null");
            json.setString("processing_status", "pending");

            DebugLogger.log("\n=== JSON GENERATION DEBUG END ===");
            DebugLogger.log("Complete JSON structure created for stroke: " + id);
            
            DebugLogger.log("\n=== FINAL JSON STRING DEBUG ===");
            DebugLogger.log("Complete JSON as string:");
            DebugLogger.log(json.toString());
            DebugLogger.log("=== END FINAL JSON STRING DEBUG ===\n");

            return json;
        }
    }
}
