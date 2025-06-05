import processing.core.*;
import processing.data.JSONObject;
import javax.swing.*;
import javax.swing.plaf.basic.BasicButtonUI;
import javax.swing.event.*;
import java.awt.*;
import java.awt.event.*;
import java.io.File;
import java.util.*;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;

public class UIManager {
    private static final long serialVersionUID = 1L;
    
    private QuantumBrush app;
    private JButton createButton;
    private Map<String, JComponent> paramComponents;
    private JFrame activeStrokeManagerFrame = null;
    private JSplitPane activeSplitPane = null;
    private JFrame mainControlFrame = null; // Add reference to main control frame
    private JPanel effectParameterContainer = null; // Container for effect parameters
    
    public UIManager(QuantumBrush app) {
        this.app = app;
        this.paramComponents = new HashMap<>();
    }
    
    // Add method to set the main control frame reference
    public void setMainControlFrame(JFrame frame) {
        this.mainControlFrame = frame;
    }
    
    // Add method to set the effect parameter container
    public void setEffectParameterContainer(JPanel container) {
        this.effectParameterContainer = container;
    }

// Add this method to create an embedded effect parameter panel
public JPanel createEffectParameterPanel(Effect effect, JPanel containerPanel) {
    if (effect == null) return new JPanel();
    
    // Create main panel
    JPanel paramPanel = new JPanel(new BorderLayout(10, 10));
    paramPanel.setBorder(BorderFactory.createEmptyBorder(15, 15, 15, 15));
    
    // Add title panel
    JPanel titlePanel = new JPanel();
    titlePanel.setLayout(new BoxLayout(titlePanel, BoxLayout.Y_AXIS));
    
    JLabel titleLabel = new JLabel("Configure " + effect.getName() + " Effect");
    titleLabel.setFont(new Font("Arial", Font.BOLD, 16));
    titleLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
    
    // Create a scrollable description panel
    String description = effect.getRequirements().getString("description", "");
    JTextArea descArea = new JTextArea(description);
    descArea.setFont(new Font("Arial", Font.ITALIC, 12));
    descArea.setLineWrap(true);
    descArea.setWrapStyleWord(true);
    descArea.setEditable(false);
    descArea.setBackground(titlePanel.getBackground());
    descArea.setMargin(new Insets(5, 5, 5, 5));
    
    JScrollPane descScrollPane = new JScrollPane(descArea);
    descScrollPane.setPreferredSize(new Dimension(400, 60));
    descScrollPane.setBorder(BorderFactory.createEmptyBorder());
    descScrollPane.setAlignmentX(Component.LEFT_ALIGNMENT);
    
    titlePanel.add(titleLabel);
    titlePanel.add(Box.createRigidArea(new Dimension(0, 5)));
    titlePanel.add(descScrollPane);
    
    paramPanel.add(titlePanel, BorderLayout.NORTH);
    
    // Create parameters panel
    JPanel parametersPanel = new JPanel();
    parametersPanel.setLayout(new BoxLayout(parametersPanel, BoxLayout.Y_AXIS));
    parametersPanel.setBorder(BorderFactory.createCompoundBorder(
        BorderFactory.createEmptyBorder(15, 0, 15, 0),
        BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(200, 200, 200)),
            BorderFactory.createEmptyBorder(15, 15, 15, 15)
        )
    ));
    
    // Add parameters from effect requirements
    JSONObject userInputReqs = effect.getUserInputRequirements();
    paramComponents.clear();
    
    for (Object key : userInputReqs.keys()) {
        String paramName = (String) key;
        Object defaultValue = userInputReqs.get(paramName);
        String paramType = determineParamType(paramName, defaultValue);
        
        JPanel singleParamPanel = new JPanel(new BorderLayout(10, 0));
        singleParamPanel.setBorder(BorderFactory.createEmptyBorder(5, 0, 10, 0));
        
        // Parameter label
        JLabel paramLabel = new JLabel(formatParamName(paramName) + ":");
        paramLabel.setToolTipText("Adjust the " + paramName + " parameter");
        singleParamPanel.add(paramLabel, BorderLayout.WEST);
        
        // Create input component based on parameter type
        JComponent inputComponent = createInputComponent(paramName, defaultValue, paramType);
        paramComponents.put(paramName, inputComponent);
        singleParamPanel.add(inputComponent, BorderLayout.CENTER);
        
        parametersPanel.add(singleParamPanel);
    }
    
    JScrollPane paramScrollPane = new JScrollPane(parametersPanel);
    paramScrollPane.setBorder(BorderFactory.createEmptyBorder());
    paramPanel.add(paramScrollPane, BorderLayout.CENTER);
    
    // Add buttons panel
    JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
    
    // Cancel button
    JButton cancelButton = new JButton("Cancel");
    cancelButton.addActionListener(e -> {
        // Remove the parameter panel from the container
        containerPanel.removeAll();
        containerPanel.revalidate();
        containerPanel.repaint();
    });
    
    // Create button
    createButton = new JButton("Create Effect");
    createButton.setEnabled(app.getCanvasManager().hasPath());
    styleButton(createButton, new Color(70, 130, 180));
    
    final StrokeManager strokeManager = app.getStrokeManager();
    
    createButton.addActionListener(e -> {
        // Collect parameter values
        Map<String, Object> parameters = collectParameters(userInputReqs);
        
        // Create the stroke
        try {
            String strokeId = strokeManager.createStroke(effect, parameters);
            
            // Check if the stroke was saved for later processing
            if (strokeId != null && strokeId.startsWith("pending:")) {
                // The stroke was saved for later processing
                // Just clear the canvas paths and close the effect window
                app.getCanvasManager().clearPaths();
                containerPanel.removeAll();
                containerPanel.revalidate();
                containerPanel.repaint();
                return;
            }
            
            // Clear the canvas paths after creating the stroke
            app.getCanvasManager().clearPaths();
            
            // Remove the parameter panel
            containerPanel.removeAll();
            containerPanel.revalidate();
            containerPanel.repaint();
            
            // Show the stroke manager (but don't run automatically)
            strokeManager.showStrokeManager();
        } catch (Exception ex) {
            JOptionPane.showMessageDialog(
                containerPanel,
                "Error creating effect: " + ex.getMessage(),
                "Error",
                JOptionPane.ERROR_MESSAGE
            );
            ex.printStackTrace();
        }
    });
    
    buttonPanel.add(cancelButton);
    buttonPanel.add(createButton);
    
    paramPanel.add(buttonPanel, BorderLayout.SOUTH);
    
    return paramPanel;
}

// Modified createEffectWindow method to embed in main control panel
    public void createEffectWindow(Effect effect) {
        if (effect == null || effectParameterContainer == null) return;
        
        // Clear any existing effect parameters
        effectParameterContainer.removeAll();
        
        // Create and add the effect parameter panel directly to the main control panel
        JPanel paramPanel = createEffectParameterPanel(effect, effectParameterContainer);
        effectParameterContainer.add(paramPanel, BorderLayout.CENTER);
        
        // Refresh the main control frame
        if (mainControlFrame != null) {
            mainControlFrame.revalidate();
            mainControlFrame.repaint();
        }
    }
    
    private String determineParamType(String paramName, Object defaultValue) {
        String paramType = "";
        
        if (paramName.toLowerCase().contains("alpha") || 
            paramName.toLowerCase().contains("opacity") || 
            paramName.toLowerCase().contains("transparency")) {
            paramType = "alpha";
        } else if (paramName.toLowerCase().contains("color")) {
            paramType = "color";
        } else if (defaultValue instanceof String && ((String)defaultValue).startsWith("#")) {
            paramType = "color";
        }
        
        return paramType;
    }
    
    private JComponent createInputComponent(String paramName, Object defaultValue, String paramType) {
        if (defaultValue instanceof Integer) {
            return createIntegerComponent((Integer)defaultValue);
        } else if (defaultValue instanceof Float || defaultValue instanceof Double) {
            float floatValue = defaultValue instanceof Float ? 
                (Float)defaultValue : ((Double)defaultValue).floatValue();
            return createFloatComponent(floatValue, paramType);
        } else if (defaultValue instanceof Boolean) {
            return createBooleanComponent((Boolean)defaultValue);
        } else if (paramType.equals("color")) {
            return createColorComponent(defaultValue.toString());
        } else {
            return createStringComponent(defaultValue.toString());
        }
    }
    
    private JComponent createIntegerComponent(int intValue) {
        JPanel sliderPanel = new JPanel(new BorderLayout(5, 0));
        JSlider slider = new JSlider(0, Math.max(100, intValue * 2), intValue);
        slider.setPaintTicks(true);
        slider.setMajorTickSpacing(25);
        slider.setMinorTickSpacing(5);
        
        JTextField valueField = new JTextField(String.valueOf(intValue), 4);
        valueField.setHorizontalAlignment(JTextField.CENTER);
        
        slider.addChangeListener(e -> valueField.setText(String.valueOf(slider.getValue())));
        
        valueField.addActionListener(e -> {
            try {
                int value = Integer.parseInt(valueField.getText());
                slider.setValue(value);
            } catch (NumberFormatException ex) {
                valueField.setText(String.valueOf(slider.getValue()));
            }
        });
        
        sliderPanel.add(slider, BorderLayout.CENTER);
        sliderPanel.add(valueField, BorderLayout.EAST);
        return sliderPanel;
    }
    
    private JComponent createFloatComponent(float floatValue, String paramType) {
        JPanel sliderPanel = new JPanel(new BorderLayout(5, 0));
        
        final int sliderMax = 100;
        final float maxValue;
        
        if (paramType.equals("alpha")) {
            maxValue = 1.0f;
        } else if (floatValue > 1.0f) {
            maxValue = Math.max(1.0f, floatValue * 2);
        } else {
            maxValue = 1.0f;
        }
        
        JSlider slider = new JSlider(0, sliderMax, (int)(floatValue * (sliderMax / maxValue)));
        slider.setPaintTicks(true);
        slider.setMajorTickSpacing(sliderMax / 4);
        slider.setMinorTickSpacing(sliderMax / 20);
        
        JTextField valueField = new JTextField(String.format("%.2f", floatValue), 5);
        valueField.setHorizontalAlignment(JTextField.CENTER);
        
        final float finalMaxValue = maxValue;
        slider.addChangeListener(e -> {
            float value = slider.getValue() * (finalMaxValue / sliderMax);
            valueField.setText(String.format("%.2f", value));
        });
        
        valueField.addActionListener(e -> {
            try {
                float value = Float.parseFloat(valueField.getText());
                slider.setValue((int)(value * (sliderMax / finalMaxValue)));
            } catch (NumberFormatException ex) {
                float value = slider.getValue() * (finalMaxValue / sliderMax);
                valueField.setText(String.format("%.2f", value));
            }
        });
        
        sliderPanel.add(slider, BorderLayout.CENTER);
        sliderPanel.add(valueField, BorderLayout.EAST);
        return sliderPanel;
    }
    
    private JComponent createBooleanComponent(boolean boolValue) {
        JCheckBox checkBox = new JCheckBox();
        checkBox.setSelected(boolValue);
        return checkBox;
    }
    
    private JComponent createStringComponent(String stringValue) {
        return new JTextField(stringValue, 15);
    }
    
    private JComponent createColorComponent(String colorStr) {
        Color initialColor;
        try {
            if (colorStr.startsWith("#")) {
                initialColor = Color.decode(colorStr);
            } else {
                initialColor = (Color)Color.class.getField(colorStr.toUpperCase()).get(null);
            }
        } catch (Exception e) {
            initialColor = Color.RED;
        }
        
        JPanel colorPanel = new JPanel();
        colorPanel.setLayout(new BoxLayout(colorPanel, BoxLayout.Y_AXIS));
        
        // Color preview panel
        JPanel currentColorPanel = new JPanel();
        currentColorPanel.setBackground(initialColor);
        currentColorPanel.setPreferredSize(new Dimension(30, 30));
        currentColorPanel.setBorder(BorderFactory.createLineBorder(Color.BLACK));
        
        // Hex color field
        JTextField colorField = new JTextField(colorStr, 7);
        colorField.setHorizontalAlignment(JTextField.CENTER);
        
        // Top panel with preview and hex input
        JPanel topPanel = new JPanel(new BorderLayout(5, 0));
        topPanel.add(currentColorPanel, BorderLayout.WEST);
        topPanel.add(colorField, BorderLayout.CENTER);
        topPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        // RGB sliders
        JPanel rgbPanel = new JPanel(new GridLayout(3, 1, 0, 2));
        rgbPanel.setBorder(BorderFactory.createEmptyBorder(5, 0, 5, 0));
        rgbPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        // Red slider
        JPanel redPanel = createColorSlider("R", Color.RED, initialColor.getRed());
        JSlider redSlider = (JSlider)((BorderLayout)redPanel.getLayout())
            .getLayoutComponent(BorderLayout.CENTER);
        JTextField redField = (JTextField)((BorderLayout)redPanel.getLayout())
            .getLayoutComponent(BorderLayout.EAST);
        
        // Green slider
        JPanel greenPanel = createColorSlider("G", Color.GREEN.darker(), initialColor.getGreen());
        JSlider greenSlider = (JSlider)((BorderLayout)greenPanel.getLayout())
            .getLayoutComponent(BorderLayout.CENTER);
        JTextField greenField = (JTextField)((BorderLayout)greenPanel.getLayout())
            .getLayoutComponent(BorderLayout.EAST);
        
        // Blue slider
        JPanel bluePanel = createColorSlider("B", Color.BLUE, initialColor.getBlue());
        JSlider blueSlider = (JSlider)((BorderLayout)bluePanel.getLayout())
            .getLayoutComponent(BorderLayout.CENTER);
        JTextField blueField = (JTextField)((BorderLayout)bluePanel.getLayout())
            .getLayoutComponent(BorderLayout.EAST);
        
        rgbPanel.add(redPanel);
        rgbPanel.add(greenPanel);
        rgbPanel.add(bluePanel);
        
        // Color swatches
        JPanel swatchPanel = new JPanel(new GridLayout(2, 8, 2, 2));
        swatchPanel.setBorder(BorderFactory.createEmptyBorder(5, 0, 0, 0));
        swatchPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        // Common colors
        Color[] colors = {
            Color.RED, Color.ORANGE, Color.YELLOW, Color.GREEN, 
            Color.CYAN, Color.BLUE, Color.MAGENTA, Color.PINK,
            new Color(128, 0, 0), new Color(128, 64, 0), new Color(128, 128, 0), 
            new Color(0, 128, 0), new Color(0, 128, 128), new Color(0, 0, 128), 
            new Color(128, 0, 128), Color.BLACK
        };
        
        for (Color color : colors) {
            JPanel swatch = new JPanel();
            swatch.setBackground(color);
            swatch.setPreferredSize(new Dimension(15, 15));
            swatch.setBorder(BorderFactory.createLineBorder(Color.BLACK));
            swatch.setCursor(new Cursor(Cursor.HAND_CURSOR));
            
            swatch.addMouseListener(new MouseAdapter() {
                @Override
                public void mouseClicked(MouseEvent e) {
                    currentColorPanel.setBackground(color);
                    redSlider.setValue(color.getRed());
                    greenSlider.setValue(color.getGreen());
                    blueSlider.setValue(color.getBlue());
                    redField.setText(String.valueOf(color.getRed()));
                    greenField.setText(String.valueOf(color.getGreen()));
                    blueField.setText(String.valueOf(color.getBlue()));
                    String hex = String.format("#%02x%02x%02x", 
                        color.getRed(), color.getGreen(), color.getBlue());
                    colorField.setText(hex);
                }
            });
            
            swatchPanel.add(swatch);
        }
        
        // Add components to the color panel
        colorPanel.add(topPanel);
        colorPanel.add(rgbPanel);
        colorPanel.add(swatchPanel);
        
        // Update color when RGB sliders change
        ChangeListener rgbChangeListener = new ChangeListener() {
            @Override
            public void stateChanged(ChangeEvent e) {
                int r = redSlider.getValue();
                int g = greenSlider.getValue();
                int b = blueSlider.getValue();
                Color newColor = new Color(r, g, b);
                currentColorPanel.setBackground(newColor);
                redField.setText(String.valueOf(r));
                greenField.setText(String.valueOf(g));
                blueField.setText(String.valueOf(b));
                String hex = String.format("#%02x%02x%02x", r, g, b);
                colorField.setText(hex);
            }
        };
        
        redSlider.addChangeListener(rgbChangeListener);
        greenSlider.addChangeListener(rgbChangeListener);
        blueSlider.addChangeListener(rgbChangeListener);
        
        // Update sliders when RGB text fields change
        ActionListener rgbTextListener = new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                try {
                    int r = Integer.parseInt(redField.getText());
                    int g = Integer.parseInt(greenField.getText());
                    int b = Integer.parseInt(blueField.getText());
                    
                    r = Math.max(0, Math.min(255, r));
                    g = Math.max(0, Math.min(255, g));
                    b = Math.max(0, Math.min(255, b));
                    
                    redSlider.setValue(r);
                    greenSlider.setValue(g);
                    blueSlider.setValue(b);
                    
                    Color newColor = new Color(r, g, b);
                    currentColorPanel.setBackground(newColor);
                    String hex = String.format("#%02x%02x%02x", r, g, b);
                    colorField.setText(hex);
                } catch (NumberFormatException ex) {
                    redField.setText(String.valueOf(redSlider.getValue()));
                    greenField.setText(String.valueOf(greenSlider.getValue()));
                    blueField.setText(String.valueOf(blueSlider.getValue()));
                }
            }
        };
        
        redField.addActionListener(rgbTextListener);
        greenField.addActionListener(rgbTextListener);
        blueField.addActionListener(rgbTextListener);
        
        // Update color panel when hex field changes
        colorField.addActionListener(e -> {
            try {
                Color newColor = Color.decode(colorField.getText());
                currentColorPanel.setBackground(newColor);
                redSlider.setValue(newColor.getRed());
                greenSlider.setValue(newColor.getGreen());
                blueSlider.setValue(newColor.getBlue());
                redField.setText(String.valueOf(newColor.getRed()));
                greenField.setText(String.valueOf(newColor.getGreen()));
                blueField.setText(String.valueOf(newColor.getBlue()));
            } catch (NumberFormatException ex) {
                Color currentColor = currentColorPanel.getBackground();
                String hex = String.format("#%02x%02x%02x", 
                    currentColor.getRed(),
                    currentColor.getGreen(),
                    currentColor.getBlue());
                colorField.setText(hex);
            }
        });
        
        return colorPanel;
    }
    
    private JPanel createColorSlider(String label, Color labelColor, int initialValue) {
        JPanel panel = new JPanel(new BorderLayout(5, 0));
        JLabel colorLabel = new JLabel(label);
        colorLabel.setForeground(labelColor);
        JSlider slider = new JSlider(0, 255, initialValue);
        slider.setPreferredSize(new Dimension(100, 20));
        JTextField field = new JTextField(String.valueOf(initialValue), 3);
        field.setHorizontalAlignment(JTextField.CENTER);
        panel.add(colorLabel, BorderLayout.WEST);
        panel.add(slider, BorderLayout.CENTER);
        panel.add(field, BorderLayout.EAST);
        return panel;
    }
    
    private Map<String, Object> collectParameters(JSONObject userInputReqs) {
        Map<String, Object> parameters = new HashMap<>();
        
        for (Map.Entry<String, JComponent> entry : paramComponents.entrySet()) {
            String paramName = entry.getKey();
            JComponent component = entry.getValue();
            
            if (component instanceof JPanel) {
                // Check if this is a color panel
                if (paramName.toLowerCase().contains("color") || 
                    userInputReqs.get(paramName).toString().startsWith("#")) {
                    // Handle color panel
                    JPanel colorPanel = (JPanel)component;
                    Component[] components = colorPanel.getComponents();
                    if (components.length > 0 && components[0] instanceof JPanel) {
                        Component[] topComponents = ((JPanel)components[0]).getComponents();
                        for (Component c : topComponents) {
                            if (c instanceof JTextField) {
                                // Get color from text field (hex format)
                                String hexColor = ((JTextField)c).getText();
                                parameters.put(paramName, hexColor);
                                break;
                            }
                        }
                    }
                } else {
                    // Handle panel with slider and text field
                    Component[] components = ((JPanel)component).getComponents();
                    for (Component c : components) {
                        if (c instanceof JTextField) {
                            JTextField textField = (JTextField)c;
                            String value = textField.getText();
                            
                            // Try to determine the type based on the original parameter
                            Object originalValue = userInputReqs.get(paramName);
                            
                            if (originalValue instanceof Integer) {
                                try {
                                    parameters.put(paramName, Integer.parseInt(value));
                                } catch (NumberFormatException ex) {
                                    parameters.put(paramName, 0);
                                }
                            } else if (originalValue instanceof Float) {
                                try {
                                    parameters.put(paramName, Float.parseFloat(value));
                                } catch (NumberFormatException ex) {
                                    parameters.put(paramName, 0.0f);
                                }
                            } else if (originalValue instanceof Double) {
                                try {
                                    parameters.put(paramName, Double.parseDouble(value));
                                } catch (NumberFormatException ex) {
                                    parameters.put(paramName, 0.0);
                                }
                            } else {
                                parameters.put(paramName, value);
                            }
                            break;
                        }
                    }
                }
            } else if (component instanceof JTextField) {
                String value = ((JTextField) component).getText();
                // Try to parse as number if possible
                try {
                    if (value.contains(".")) {
                        parameters.put(paramName, Float.parseFloat(value));
                    } else {
                        parameters.put(paramName, Integer.parseInt(value));
                    }
                } catch (NumberFormatException ex) {
                    parameters.put(paramName, value);
                }
            } else if (component instanceof JCheckBox) {
                parameters.put(paramName, ((JCheckBox) component).isSelected());
            }
        }
        
        return parameters;
    }
    
    // Fixed and simplified updateStrokeManagerContent method
    public void updateStrokeManagerContent(StrokeManager strokeManager) {
        if (activeSplitPane == null || 
            activeStrokeManagerFrame == null || 
            !activeStrokeManagerFrame.isDisplayable()) {
            return;
        }
        
        // Get the current stroke first
        StrokeManager.Stroke currentStroke = strokeManager.getCurrentStroke();

        // Update the title with current stroke information
        if (activeStrokeManagerFrame != null) {
            Component[] components = activeStrokeManagerFrame.getContentPane().getComponents();
            for (Component c : components) {
                if (c instanceof JPanel) {
                    JPanel mainPanel = (JPanel) c;
                    Component[] mainComponents = mainPanel.getComponents();
                    for (Component mc : mainComponents) {
                        if (mc instanceof JPanel && mc == mainPanel.getComponent(0)) { // Title panel is first component
                            JPanel titlePanel = (JPanel) mc;
                            for (Component tc : titlePanel.getComponents()) {
                                if (tc instanceof JLabel) {
                                    JLabel titleLabel = (JLabel) tc;
                                    if (currentStroke != null) {
                                        String effectName = currentStroke.getEffect().getName();
                                        String strokeId = currentStroke.getId();
                                        // Extract timestamp from stroke ID for display
                                        String timestamp = strokeId.substring(strokeId.indexOf('_') + 1);
                                        long timestampLong = Long.parseLong(timestamp);
                                        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("MMM dd, HH:mm:ss");
                                        String timeStr = sdf.format(new java.util.Date(timestampLong));
                                        
                                        titleLabel.setText("Stroke: " + effectName + " (" + timeStr + ") - ID: " + strokeId);
                                    } else {
                                        titleLabel.setText("No stroke selected");
                                    }
                                    break;
                                }
                            }
                            break;
                        }
                    }
                    break;
                }
            }
        }
        
        // Store the current divider location to restore it later
        int dividerLocation = activeSplitPane.getDividerLocation();
        
        // Store the current window size
        Dimension frameSize = activeStrokeManagerFrame.getSize();
        
        // Clear the split pane
        activeSplitPane.setLeftComponent(null);
        activeSplitPane.setRightComponent(null);
        
        // Get the current stroke
        if (currentStroke != null) {
            String projectId = app.getProjectId();
            String strokeId = currentStroke.getId();
            
            // Left panel - Input image with paths
            JPanel leftPanel = new JPanel(new BorderLayout());
            leftPanel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createEmptyBorder(0, 0, 0, 5),
                BorderFactory.createTitledBorder("Input Image with Paths")
            ));

            // Get the specific input image for this stroke
            String inputImagePath = "project/" + projectId + "/stroke/" + strokeId + "_input.png";
            File inputImageFile = new File(inputImagePath);
            PImage strokeInputImage = null;

            if (inputImageFile.exists()) {
                strokeInputImage = app.loadImage(inputImagePath);
            }

            // If we couldn't load the specific input image, fall back to the current image
            if (strokeInputImage == null) {
                strokeInputImage = app.getCurrentImage();
            }

            if (strokeInputImage != null) {
                // Create a custom panel that draws the input image and the paths
                final PImage finalStrokeInputImage = strokeInputImage;
                JPanel customImagePanel = new JPanel() {
                    private static final long serialVersionUID = 1L;
                    
                    @Override
                    protected void paintComponent(Graphics g) {
                        super.paintComponent(g);
                        
                        // Draw the input image
                        g.drawImage(finalStrokeInputImage.getImage(), 0, 0, null);
                        
                        // Draw the paths
                        Graphics2D g2d = (Graphics2D) g;
                        g2d.setColor(Color.RED);
                        g2d.setStroke(new BasicStroke(2));
                        
                        ArrayList<Path> paths = currentStroke.getPaths();
                        if (paths != null) {
                            for (Path path : paths) {
                                ArrayList<PVector> points = path.getPoints();
                                if (points != null && points.size() >= 2) {
                                    for (int i = 0; i < points.size() - 1; i++) {
                                        PVector p1 = points.get(i);
                                        PVector p2 = points.get(i + 1);
                                        g2d.drawLine((int)p1.x, (int)p1.y, (int)p2.x, (int)p2.y);
                                    }
                                }
                            }
                        }
                    }
                    
                    @Override
                    public Dimension getPreferredSize() {
                        return new Dimension(finalStrokeInputImage.width, finalStrokeInputImage.height);
                    }
                    
                    @Override
                    public Dimension getMinimumSize() {
                        return getPreferredSize();
                    }
                    
                    @Override
                    public Dimension getMaximumSize() {
                        return getPreferredSize();
                    }
                };

                // Create a scroll pane for the image
                JScrollPane leftScrollPane = new JScrollPane(customImagePanel);
                leftScrollPane.setBorder(BorderFactory.createEmptyBorder());
                leftScrollPane.setViewportBorder(null);
                
                leftPanel.add(leftScrollPane, BorderLayout.CENTER);
            } else {
                // No image available, show a message
                leftPanel.add(
                    createMessagePanel(
                        "Input Image", 
                        "No input image available for this stroke."
                    ), 
                    BorderLayout.CENTER
                );
            }
            
            // Right panel - Parameters and Output image
            JPanel rightPanel = new JPanel(new BorderLayout());
            rightPanel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createEmptyBorder(0, 5, 0, 0),
                BorderFactory.createTitledBorder("Effect Parameters & Output")
            ));

            // Create parameter display panel
            JPanel parameterDisplayPanel = new JPanel();
            parameterDisplayPanel.setLayout(new BoxLayout(parameterDisplayPanel, BoxLayout.Y_AXIS));
            parameterDisplayPanel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createTitledBorder("Parameters Used"),
                BorderFactory.createEmptyBorder(5, 5, 5, 5)
            ));

            // Display the parameters for this stroke
            System.out.println("=== DEBUG: Displaying parameters for stroke " + strokeId + " ===");
            Map<String, Object> strokeParams = currentStroke.getParameters();
            System.out.println("Parameters map: " + strokeParams);
            System.out.println("Parameters map size: " + (strokeParams != null ? strokeParams.size() : "null"));
            
            if (strokeParams != null && !strokeParams.isEmpty()) {
                for (Map.Entry<String, Object> entry : strokeParams.entrySet()) {
                    System.out.println("Parameter: " + entry.getKey() + " = " + entry.getValue() + " (type: " + entry.getValue().getClass().getSimpleName() + ")");
                    
                    JPanel paramRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 5, 2));
                    JLabel paramLabel = new JLabel(formatParamName(entry.getKey()) + ":");
                    paramLabel.setFont(new Font("Arial", Font.BOLD, 12));
                    JLabel paramValue = new JLabel(entry.getValue().toString());
                    paramValue.setFont(new Font("Arial", Font.PLAIN, 12));
                    paramValue.setForeground(new Color(0, 0, 150));
                    
                    paramRow.add(paramLabel);
                    paramRow.add(paramValue);
                    parameterDisplayPanel.add(paramRow);
                }
            } else {
                System.out.println("No parameters found - trying to load from JSON");
                
                // Try to get parameters from the JSON file as fallback
                String instructionsPath = "project/" + projectId + "/stroke/" + strokeId + "_instructions.json";
                File instructionsFile = new File(instructionsPath);
                
                if (instructionsFile.exists()) {
                    try {
                        JSONObject instructions = app.loadJSONObject(instructionsPath);
                        if (instructions.hasKey("user_input")) {
                            JSONObject userInput = instructions.getJSONObject("user_input");
                            System.out.println("Found user_input in JSON: " + userInput);
                            
                            for (Object key : userInput.keys()) {
                                String paramName = (String) key;
                                Object value = userInput.get(paramName);
                                System.out.println("JSON Parameter: " + paramName + " = " + value);
                                
                                JPanel paramRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 5, 2));
                                JLabel paramLabel = new JLabel(formatParamName(paramName) + ":");
                                paramLabel.setFont(new Font("Arial", Font.BOLD, 12));
                                JLabel paramValue = new JLabel(value.toString());
                                paramValue.setFont(new Font("Arial", Font.PLAIN, 12));
                                paramValue.setForeground(new Color(0, 0, 150));
                                
                                paramRow.add(paramLabel);
                                paramRow.add(paramValue);
                                parameterDisplayPanel.add(paramRow);
                            }
                        } else {
                            System.out.println("No user_input found in JSON");
                        }
                    } catch (Exception e) {
                        System.err.println("Error reading parameters from JSON: " + e.getMessage());
                        e.printStackTrace();
                    }
                } else {
                    System.out.println("Instructions file does not exist: " + instructionsPath);
                }
                
                // If still no parameters, show default message
                if (parameterDisplayPanel.getComponentCount() == 0) {
                    JLabel noParamsLabel = new JLabel("No parameters found for this effect");
                    noParamsLabel.setFont(new Font("Arial", Font.ITALIC, 12));
                    noParamsLabel.setForeground(Color.GRAY);
                    parameterDisplayPanel.add(noParamsLabel);
                }
            }

            // Create a main content panel that will hold parameters and output
            JPanel rightContentPanel = new JPanel(new BorderLayout());
            rightContentPanel.add(parameterDisplayPanel, BorderLayout.NORTH);
            
            // Check processing status
            boolean isProcessing = strokeManager.isStrokeProcessing(strokeId);
            String processingStatus = strokeManager.getStrokeProcessingStatus(strokeId);
            
            // Check if effect was successful
            String instructionsPath = "project/" + projectId + "/stroke/" + strokeId + "_instructions.json";
            File instructionsFile = new File(instructionsPath);
            boolean effectSuccess = false;
            
            if (instructionsFile.exists()) {
                try {
                    JSONObject instructions = app.loadJSONObject(instructionsPath);
                    effectSuccess = "true".equals(
                        instructions.getString("effect_success", "false")
                    );
                } catch (Exception e) {
                    System.err.println("Error reading instructions file: " + e.getMessage());
                }
            }
            
            // Check if output image exists
            String outputPath = "project/" + projectId + "/stroke/" + strokeId + "_output.png";
            File outputFile = new File(outputPath);

            System.out.println("=== DEBUG: Output image check ===");
            System.out.println("Stroke ID: " + strokeId);
            System.out.println("Effect success: " + effectSuccess);
            System.out.println("Output file exists: " + outputFile.exists());
            System.out.println("Output file path: " + outputPath);
            System.out.println("Is processing: " + isProcessing);
            System.out.println("Processing status: " + processingStatus);
            
            if (isProcessing) {
                // Show processing indicator
                JPanel processingPanel = createMessagePanel(
                    "Processing", 
                    "Effect is currently being processed..."
                );
                
                // Add a progress indicator
                JProgressBar progressBar = new JProgressBar();
                progressBar.setIndeterminate(true);
                progressBar.setPreferredSize(new Dimension(200, 20));
                
                JPanel progressPanel = new JPanel(new FlowLayout(FlowLayout.CENTER));
                progressPanel.add(progressBar);
                
                JPanel statusPanel = new JPanel(new BorderLayout());
                statusPanel.add(processingPanel, BorderLayout.CENTER);
                statusPanel.add(progressPanel, BorderLayout.SOUTH);
                
                rightContentPanel.add(statusPanel, BorderLayout.CENTER);
            }
            else if (effectSuccess && outputFile.exists()) {
                // Simplified image loading and display
                try {
                    System.out.println("=== Loading and displaying output image ===");
                    
                    // Use Processing's loadImage for simplicity
                    PImage outputImage = app.loadImage(outputPath);
                    
                    if (outputImage != null) {
                        System.out.println("Successfully loaded output image: " + outputImage.width + "x" + outputImage.height);
                        
                        // Create a simple image display panel
                        JPanel imageDisplayPanel = new JPanel(new BorderLayout());
                        imageDisplayPanel.setBorder(BorderFactory.createTitledBorder("Output Image"));
                        
                        // Convert PImage to displayable format
                        final BufferedImage bufferedImage = new BufferedImage(
                            outputImage.width, outputImage.height, BufferedImage.TYPE_INT_ARGB);
                        
                        outputImage.loadPixels();
                        for (int y = 0; y < outputImage.height; y++) {
                            for (int x = 0; x < outputImage.width; x++) {
                                int pixel = outputImage.pixels[y * outputImage.width + x];
                                bufferedImage.setRGB(x, y, pixel);
                            }
                        }
                        
                        // Create image panel with proper scaling
                        JPanel imagePanel = new JPanel() {
                            @Override
                            protected void paintComponent(Graphics g) {
                                super.paintComponent(g);
                                setBackground(Color.WHITE);
                                
                                if (bufferedImage != null) {
                                    Graphics2D g2d = (Graphics2D) g;
                                    g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, 
                                                       RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                                    
                                    // Calculate scaling to fit panel
                                    int panelWidth = getWidth();
                                    int panelHeight = getHeight();
                                    
                                    if (panelWidth > 0 && panelHeight > 0) {
                                        double scaleX = (double) panelWidth / bufferedImage.getWidth();
                                        double scaleY = (double) panelHeight / bufferedImage.getHeight();
                                        double scale = Math.min(scaleX, scaleY);
                                        scale = Math.min(scale, 1.0); // Don't upscale
                                        
                                        int scaledWidth = (int) (bufferedImage.getWidth() * scale);
                                        int scaledHeight = (int) (bufferedImage.getHeight() * scale);
                                        
                                        // Center the image
                                        int x = (panelWidth - scaledWidth) / 2;
                                        int y = (panelHeight - scaledHeight) / 2;
                                        
                                        // Draw the scaled image
                                        g2d.drawImage(bufferedImage, x, y, scaledWidth, scaledHeight, this);
                                        
                                        // Draw border
                                        g2d.setColor(Color.LIGHT_GRAY);
                                        g2d.drawRect(x-1, y-1, scaledWidth+1, scaledHeight+1);
                                    }
                                }
                            }
                            
                            @Override
                            public Dimension getPreferredSize() {
                                if (bufferedImage != null) {
                                    // Scale down for UI if too large
                                    int maxSize = 300;
                                    int width = bufferedImage.getWidth();
                                    int height = bufferedImage.getHeight();
                                    
                                    if (width > maxSize || height > maxSize) {
                                        double scale = Math.min((double)maxSize / width, (double)maxSize / height);
                                        return new Dimension((int)(width * scale), (int)(height * scale));
                                    }
                                    return new Dimension(width, height);
                                }
                                return new Dimension(200, 200);
                            }
                        };
                        
                        imagePanel.setBackground(Color.WHITE);
                        imagePanel.setOpaque(true);
                        
                        // Add to scroll pane
                        JScrollPane imageScrollPane = new JScrollPane(imagePanel);
                        imageScrollPane.setPreferredSize(new Dimension(300, 300));
                        imageScrollPane.getViewport().setBackground(Color.WHITE);
                        
                        imageDisplayPanel.add(imageScrollPane, BorderLayout.CENTER);
                        rightContentPanel.add(imageDisplayPanel, BorderLayout.CENTER);
                        
                        // Add success status
                        JLabel statusLabel = new JLabel("Effect applied successfully!");
                        statusLabel.setForeground(new Color(0, 150, 0));
                        statusLabel.setHorizontalAlignment(JLabel.CENTER);
                        statusLabel.setBorder(BorderFactory.createEmptyBorder(5, 0, 5, 0));
                        rightContentPanel.add(statusLabel, BorderLayout.SOUTH);
                        
                        System.out.println("Successfully displayed output image");
                    } else {
                        System.err.println("Failed to load output image");
                        rightContentPanel.add(
                            createMessagePanel("Output Image", "Failed to load output image"), 
                            BorderLayout.CENTER
                        );
                    }
                } catch (Exception e) {
                    System.err.println("Exception loading output image: " + e.getMessage());
                    e.printStackTrace();
                    rightContentPanel.add(
                        createMessagePanel("Output Image", "Error loading image: " + e.getMessage()), 
                        BorderLayout.CENTER
                    );
                }
            }
            else {
                // No output yet or failed
                String message = "Click 'Run' to process the effect";
                
                if ("failed".equals(processingStatus)) {
                    message = "Effect processing failed";
                } else if ("canceled".equals(processingStatus)) {
                    message = "Effect processing was canceled";
                } else if (!effectSuccess && instructionsFile.exists()) {
                    message = "Effect processing completed but failed";
                }
                
                rightContentPanel.add(
                    createMessagePanel("Output Image", message), 
                    BorderLayout.CENTER
                );
            }
            
            // Add the right content panel to the right panel
            rightPanel.add(rightContentPanel, BorderLayout.CENTER);
            
            // Update the split pane components
            activeSplitPane.setLeftComponent(leftPanel);
            activeSplitPane.setRightComponent(rightPanel);
            
            // Update button states
            updatePasteButton(effectSuccess && outputFile.exists());
            updateButtonStates(strokeManager, strokeId, isProcessing);
            
        } else {
            // No current stroke to display
            JPanel leftPanel = createMessagePanel(
                "Input Image with Paths", 
                "No stroke selected or available"
            );
            JPanel rightPanel = createMessagePanel(
                "Parameters & Output", 
                "No stroke selected or available"
            );
            
            activeSplitPane.setLeftComponent(leftPanel);
            activeSplitPane.setRightComponent(rightPanel);
            updatePasteButton(false);
        }
        
        // Restore the divider location and refresh
        activeSplitPane.setDividerLocation(dividerLocation);
        activeSplitPane.revalidate();
        activeSplitPane.repaint();
        
        // Ensure the frame size is maintained
        activeStrokeManagerFrame.setSize(frameSize);
        activeStrokeManagerFrame.revalidate();
        activeStrokeManagerFrame.repaint();
    }
    
    private void updateButtonStates(StrokeManager strokeManager, String strokeId, boolean isProcessing) {
        Component[] components = activeStrokeManagerFrame.getContentPane().getComponents();
        for (Component c : components) {
            if (c instanceof JPanel) {
                JPanel mainPanel = (JPanel) c;
                Component[] mainComponents = mainPanel.getComponents();
                for (Component mc : mainComponents) {
                    if (mc instanceof JPanel && "navPanel".equals(((JPanel) mc).getName())) {
                        JPanel navPanel = (JPanel) mc;
                        Component[] navComponents = navPanel.getComponents();
                        for (Component nc : navComponents) {
                            if (nc instanceof JButton) {
                                JButton button = (JButton) nc;
                                String buttonText = button.getText();
                                
                                if ("Run".equals(buttonText) || "Re-Run".equals(buttonText)) {
                                    // Disable run buttons if processing
                                    button.setEnabled(!isProcessing);
                                } else if ("Cancel".equals(buttonText)) {
                                    // Enable cancel button only if processing
                                    button.setEnabled(isProcessing);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    private void updatePasteButton(boolean enabled) {
        Component[] components = activeStrokeManagerFrame.getContentPane().getComponents();
        for (Component c : components) {
            if (c instanceof JPanel) {
                JPanel mainPanel = (JPanel) c;
                Component[] mainComponents = mainPanel.getComponents();
                for (Component mc : mainComponents) {
                    if (mc instanceof JPanel && "navPanel".equals(((JPanel) mc).getName())) {
                        JPanel navPanel = (JPanel) mc;
                        Component[] navComponents = navPanel.getComponents();
                        for (Component nc : navComponents) {
                            if (nc instanceof JButton && "Paste".equals(((JButton) nc).getText())) {
                                JButton pasteButton = (JButton) nc;
                                pasteButton.setEnabled(enabled);
                            }
                        }
                    }
                }
            }
        }
    }
    
    public void enableCreateButton() {
        if (createButton != null) {
            createButton.setEnabled(true);
        }
    }
    
    private void styleButton(JButton button, Color bgColor) {
        button.setBackground(bgColor);
        button.setForeground(Color.WHITE);
        button.setFocusPainted(false);
        button.setBorderPainted(true);
        button.setContentAreaFilled(false);
        button.setOpaque(true);
        
        button.setUI(new BasicButtonUI() {
            @Override
            public void update(Graphics g, JComponent c) {
                if (c.isOpaque()) {
                    if (c.isEnabled()) {
                        g.setColor(c.getBackground());
                    } else {
                        g.setColor(new Color(150, 150, 150));
                    }
                    g.fillRect(0, 0, c.getWidth(), c.getHeight());
                }
                paint(g, c);
            }
        });
    }
    
    private String formatParamName(String paramName) {
        // Convert camelCase or snake_case to Title Case with spaces
        String result = paramName.replaceAll("([a-z])([A-Z])", "$1 $2")
                              .replaceAll("_", " ");
        return result.substring(0, 1).toUpperCase() + result.substring(1);
    }

    private JPanel createMessagePanel(String title, String message) {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createEmptyBorder(0, 5, 0, 5),
            BorderFactory.createTitledBorder(title)
        ));
        
        JPanel messagePanel = new JPanel();
        messagePanel.setLayout(new BoxLayout(messagePanel, BoxLayout.Y_AXIS));
        messagePanel.setBackground(Color.WHITE);
        
        JLabel messageLabel = new JLabel(message);
        messageLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        messageLabel.setFont(new Font("Arial", Font.ITALIC, 14));
        messageLabel.setForeground(Color.GRAY);
        
        messagePanel.add(Box.createVerticalGlue());
        messagePanel.add(messageLabel);
        messagePanel.add(Box.createVerticalGlue());
        
        panel.add(messagePanel, BorderLayout.CENTER);
        return panel;
    }
    
    public void createStrokeManagerWindow(StrokeManager strokeManager) {
        // Close any existing Stroke Manager window
        if (activeStrokeManagerFrame != null && activeStrokeManagerFrame.isDisplayable()) {
            activeStrokeManagerFrame.dispose();
        }
        
        JFrame strokeFrame = new JFrame("Stroke Manager");
        strokeFrame.setSize(1000, 600);
        strokeFrame.setLocationRelativeTo(null);
        strokeFrame.setMinimumSize(new Dimension(800, 500));
        strokeFrame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
        
        // Store reference to the active frame
        activeStrokeManagerFrame = strokeFrame;
        
        JPanel mainPanel = new JPanel(new BorderLayout(0, 10));
        mainPanel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        // Add title panel
        JPanel titlePanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        JLabel titleLabel = new JLabel("Loading stroke information...");
        titleLabel.setFont(new Font("Arial", Font.BOLD, 16));
        titlePanel.add(titleLabel);
        mainPanel.add(titlePanel, BorderLayout.NORTH);
        
        // Create a split pane for input and output images
        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
        splitPane.setResizeWeight(0.5);
        splitPane.setBorder(null);
        
        // Store reference to the active split pane
        activeSplitPane = splitPane;
        
        // Create initial panels with messages
        JPanel leftPanel = createMessagePanel(
            "Input Image with Paths", 
            "Click 'Run' to process the effect and see input image"
        );
        JPanel rightPanel = createMessagePanel(
            "Parameters & Output", 
            "Parameters and output will appear here"
        );
        
        // Add panels to split pane
        splitPane.setLeftComponent(leftPanel);
        splitPane.setRightComponent(rightPanel);
        
        mainPanel.add(splitPane, BorderLayout.CENTER);
        
        // Create navigation panel
        JPanel navPanel = new JPanel(new FlowLayout(FlowLayout.CENTER, 15, 0));
        navPanel.setBorder(BorderFactory.createEmptyBorder(10, 0, 0, 0));
        navPanel.setName("navPanel");
        
        JButton prevButton = new JButton("< Previous");
        JButton runButton = new JButton("Run");
        JButton cancelButton = new JButton("Cancel");
        JButton pasteButton = new JButton("Paste");
        JButton nextButton = new JButton("Next >");
        
        // Style the buttons
        styleButton(runButton, new Color(70, 130, 180));
        styleButton(cancelButton, new Color(220, 20, 60));
        styleButton(pasteButton, new Color(46, 139, 87));
        
        prevButton.addActionListener(e -> {
            strokeManager.previousStroke();
            updateStrokeManagerContent(strokeManager);
        });
        
        nextButton.addActionListener(e -> {
            strokeManager.nextStroke();
            updateStrokeManagerContent(strokeManager);
        });
        
        runButton.addActionListener(e -> {
            strokeManager.runCurrentStroke();
            updateStrokeManagerContent(strokeManager);
        });
        
        cancelButton.addActionListener(e -> {
            StrokeManager.Stroke activeStroke = strokeManager.getCurrentStroke();
            if (activeStroke != null) {
                boolean canceled = strokeManager.cancelStrokeProcessing(activeStroke.getId());
                if (canceled) {
                    JOptionPane.showMessageDialog(
                        strokeFrame,
                        "Processing canceled successfully.",
                        "Processing Canceled",
                        JOptionPane.INFORMATION_MESSAGE
                    );
                    updateStrokeManagerContent(strokeManager);
                } else {
                    JOptionPane.showMessageDialog(
                        strokeFrame,
                        "No active processing to cancel for this stroke.",
                        "Nothing to Cancel",
                        JOptionPane.INFORMATION_MESSAGE
                    );
                }
            }
        });

        pasteButton.addActionListener(e -> {
            StrokeManager.Stroke activeStroke = strokeManager.getCurrentStroke();
            if (activeStroke != null) {
                boolean success = strokeManager.applyEffectToCanvas(activeStroke.getId());
                if (success) {
                    updateStrokeManagerContent(strokeManager);
                    JOptionPane.showMessageDialog(
                        strokeFrame,
                        "Effect applied to canvas successfully!",
                        "Success",
                        JOptionPane.INFORMATION_MESSAGE
                    );
                }
            }
        });
    
        // Initially disable paste button until output exists
        pasteButton.setEnabled(false);
    
        navPanel.add(prevButton);
        navPanel.add(runButton);
        navPanel.add(cancelButton);
        navPanel.add(pasteButton);
        navPanel.add(nextButton);
    
        mainPanel.add(navPanel, BorderLayout.SOUTH);
        strokeFrame.add(mainPanel);
        strokeFrame.setVisible(true);
    
        // Update the content after the window is visible
        updateStrokeManagerContent(strokeManager);
    }
}
