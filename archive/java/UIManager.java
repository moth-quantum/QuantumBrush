import processing.core.*;
import processing.data.*;
import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.image.BufferedImage;
import java.util.*;

public class UIManager {
    private QuantumBrush app;
    private JFrame mainControlFrame;
    private JPanel effectParameterContainer;
    private JButton createButton;
    private Map<String, Object> currentEffectParameters;
    private Effect currentEffect;
    
    // ✅ NEW: Track single Stroke Manager instance
    private JFrame strokeManagerFrame = null;
    private DefaultListModel<StrokeItem> strokeListModel = null;
    private JList<StrokeItem> strokeList = null;
    private JPanel strokeDetailsContent = null;
    private JScrollPane strokeDetailsScrollPane = null;
    
    public UIManager(QuantumBrush app) {
        this.app = app;
        this.currentEffectParameters = new HashMap<>();
    }
    
    public void setMainControlFrame(JFrame frame) {
        this.mainControlFrame = frame;
    }
    
    public void setEffectParameterContainer(JPanel container) {
        this.effectParameterContainer = container;
    }
    
    public void createEffectWindow(Effect effect) {
        this.currentEffect = effect;
        
        // Clear parameters completely when switching effects
        currentEffectParameters.clear();
        
        effectParameterContainer.removeAll();
        
        JPanel contentPanel = new JPanel();
        contentPanel.setLayout(new BoxLayout(contentPanel, BoxLayout.Y_AXIS));
        
        // Add effect name and description
        JLabel nameLabel = new JLabel(effect.getName());
        nameLabel.setFont(new Font("Arial", Font.BOLD, 16));
        nameLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
        contentPanel.add(nameLabel);
        
        String description = getEffectDescription(effect);
        if (description != null && !description.trim().isEmpty()) {
            JTextArea descriptionArea = new JTextArea(description);
            descriptionArea.setFont(new Font("Arial", Font.PLAIN, 12));
            descriptionArea.setLineWrap(true);
            descriptionArea.setWrapStyleWord(true);
            descriptionArea.setEditable(false);
            descriptionArea.setOpaque(false);
            descriptionArea.setAlignmentX(Component.LEFT_ALIGNMENT);
            descriptionArea.setBorder(BorderFactory.createEmptyBorder(5, 0, 10, 0));
            contentPanel.add(descriptionArea);
        }
        
        contentPanel.add(Box.createVerticalStrut(10));
        
        // Get ONLY the parameters that exist in THIS effect's JSON
        JSONObject userInputReqs = effect.getUserInputRequirements();
        
        // Create UI components ONLY for parameters that exist in the JSON
        for (Object key : userInputReqs.keys()) {
            String paramName = (String) key;
            JSONObject paramSpec = effect.getParamSpec(paramName);
            
            if (paramSpec != null) {
                // ✅ REFACTORED: Use the generic panel creation method
                JPanel paramPanel = createGenericParameterPanel(paramName, paramSpec, effect, currentEffectParameters, this::updateCreateButtonState);
                if (paramPanel != null) {
                    contentPanel.add(paramPanel);
                    contentPanel.add(Box.createVerticalStrut(8));
                }
            }
        }
        
        // Create button
        createButton = new JButton("Create");
        createButton.setEnabled(false);
        createButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        createButton.addActionListener(e -> {
            String strokeId = app.getStrokeManager().createStroke(effect, currentEffectParameters);
            if (strokeId != null && !strokeId.startsWith("pending:")) {
                JOptionPane.showMessageDialog(
                    mainControlFrame,
                    "Stroke created successfully! Use Tools > Stroke Manager to run it.",
                    "Stroke Created",
                    JOptionPane.INFORMATION_MESSAGE
                );
                
                // NEW: Auto-refresh Stroke Manager if it's open
                refreshStrokeManagerIfOpen();
            }
        });
        
        contentPanel.add(Box.createVerticalStrut(10));
        contentPanel.add(createButton);
        
        // Add content to the parameter container
        effectParameterContainer.add(contentPanel, BorderLayout.CENTER);
        
        // Update button state
        updateCreateButtonState();
        
        // Refresh the UI
        effectParameterContainer.revalidate();
        effectParameterContainer.repaint();
        
        System.out.println("Effect window created for: " + effect.getName());
    }
    
    private String getEffectDescription(Effect effect) {
        JSONObject requirements = effect.getRequirements();
        if (requirements != null && requirements.hasKey("description")) {
            return requirements.getString("description");
        }
        return null;
    }
    
    /**
     * REFACTORED: Creates a generic UI panel for a single parameter.
     * This method is now used by both the main Control Panel and the Stroke Manager.
     *
     * @param paramName The name of the parameter.
     * @param paramSpec The JSON specification for the parameter.
     * @param effect The effect the parameter belongs to.
     * @param parametersMap The map where the parameter's value is stored and updated.
     * @param onUpdateCallback A runnable to execute when the parameter's value changes (can be null).
     * @return A JPanel containing the UI controls for the parameter.
     */
    private JPanel createGenericParameterPanel(String paramName, JSONObject paramSpec, Effect effect, Map<String, Object> parametersMap, Runnable onUpdateCallback) {
        String type = paramSpec.getString("type", "string");
        
        JPanel panel = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        panel.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        // Create label
        JLabel label = new JLabel(paramName + ":");
        label.setPreferredSize(new Dimension(120, 25));
        panel.add(label);
        
        // Get initial value: use value from map if it exists, otherwise use effect default
        Object initialValue = parametersMap.get(paramName);
        if (initialValue == null) {
            initialValue = effect.getParamDefault(paramName);
            parametersMap.put(paramName, initialValue); // Ensure map is populated with default
        }

        try {
            switch (type) {
                case "bool":
                case "boolean":
                    JCheckBox checkBox = new JCheckBox();
                    boolean boolValue = false;
                    if (initialValue instanceof Boolean) {
                        boolValue = (Boolean) initialValue;
                    } else if (initialValue != null) {
                        boolValue = Boolean.parseBoolean(initialValue.toString());
                    }
                    checkBox.setSelected(boolValue);
                    checkBox.addActionListener(e -> {
                        parametersMap.put(paramName, checkBox.isSelected());
                        if (onUpdateCallback != null) onUpdateCallback.run();
                    });
                    panel.add(checkBox);
                    break;
                    
                case "int":
                    float minInt = effect.getParamMin(paramName, 0);
                    float maxInt = effect.getParamMax(paramName, 100);
                    int intValue = 0;
                    if (initialValue instanceof Number) {
                        intValue = ((Number) initialValue).intValue();
                    } else if (initialValue != null) {
                        try {
                            intValue = Integer.parseInt(initialValue.toString());
                        } catch (NumberFormatException ex) {
                            intValue = (int) minInt;
                        }
                    }
                    
                    JSlider intSlider = new JSlider((int) minInt, (int) maxInt, intValue);
                    intSlider.setPreferredSize(new Dimension(200, 25));
                    JLabel intValueLabel = new JLabel(String.valueOf(intValue));
                    intValueLabel.setPreferredSize(new Dimension(50, 25));
                    
                    intSlider.addChangeListener(e -> {
                        int value = intSlider.getValue();
                        intValueLabel.setText(String.valueOf(value));
                        parametersMap.put(paramName, value);
                        if (onUpdateCallback != null) onUpdateCallback.run();
                    });
                    
                    panel.add(intSlider);
                    panel.add(intValueLabel);
                    break;
                    
                case "float":
                    float minFloat = effect.getParamMin(paramName, 0.0f);
                    float maxFloat = effect.getParamMax(paramName, 1.0f);
                    float floatValue = 0.0f;
                    if (initialValue instanceof Number) {
                        floatValue = ((Number) initialValue).floatValue();
                    } else if (initialValue != null) {
                        try {
                            floatValue = Float.parseFloat(initialValue.toString());
                        } catch (NumberFormatException ex) {
                            floatValue = minFloat;
                        }
                    }
                    
                    int sliderMax = 1000;
                    int sliderValue = (int) ((floatValue - minFloat) / (maxFloat - minFloat) * sliderMax);
                    
                    JSlider floatSlider = new JSlider(0, sliderMax, sliderValue);
                    floatSlider.setPreferredSize(new Dimension(200, 25));
                    JLabel floatValueLabel = new JLabel(String.format("%.3f", floatValue));
                    floatValueLabel.setPreferredSize(new Dimension(60, 25));
                    
                    floatSlider.addChangeListener(e -> {
                        float value = minFloat + (floatSlider.getValue() / (float) sliderMax) * (maxFloat - minFloat);
                        floatValueLabel.setText(String.format("%.3f", value));
                        parametersMap.put(paramName, value);
                        if (onUpdateCallback != null) onUpdateCallback.run();
                    });
                    
                    panel.add(floatSlider);
                    panel.add(floatValueLabel);
                    break;
                    
                case "color":
                    String colorValue = initialValue != null ? initialValue.toString() : "#FF0000";
                    JTextField colorField = new JTextField(colorValue, 8);
                    JButton colorButton = new JButton("Choose");

                    JPanel colorPreview = new JPanel();
                    colorPreview.setPreferredSize(new Dimension(25, 20));
                    colorPreview.setBorder(BorderFactory.createLineBorder(Color.BLACK, 1));
                    try {
                        colorPreview.setBackground(Color.decode(colorValue));
                    } catch (Exception ex) {
                        colorPreview.setBackground(Color.WHITE);
                    }

                    ActionListener updateColor = e -> {
                        String hexColor = colorField.getText();
                        try {
                            colorPreview.setBackground(Color.decode(hexColor));
                            parametersMap.put(paramName, hexColor);
                            if (onUpdateCallback != null) onUpdateCallback.run();
                        } catch (Exception ex) {
                            // handle invalid color string if necessary
                        }
                    };
                    colorField.addActionListener(updateColor);

                    colorButton.addActionListener(e -> {
                        Color currentColor = Color.RED;
                        try {
                            currentColor = Color.decode(colorField.getText());
                        } catch (NumberFormatException ex) { /* use default */ }
                        
                        Color newColor = JColorChooser.showDialog(panel, "Choose Color", currentColor);
                        if (newColor != null) {
                            String hexColor = String.format("#%02X%02X%02X", newColor.getRed(), newColor.getGreen(), newColor.getBlue());
                            colorField.setText(hexColor);
                            updateColor.actionPerformed(null); // Trigger update
                        }
                    });

                    panel.add(colorField);
                    panel.add(colorPreview);
                    panel.add(colorButton);
                    break;
                    
                case "string":
                default:
                    String stringValue = initialValue != null ? initialValue.toString() : "";
                    JTextField textField = new JTextField(stringValue, 15);
                    textField.getDocument().addDocumentListener(new javax.swing.event.DocumentListener() {
                        public void insertUpdate(javax.swing.event.DocumentEvent e) { update(); }
                        public void removeUpdate(javax.swing.event.DocumentEvent e) { update(); }
                        public void changedUpdate(javax.swing.event.DocumentEvent e) { update(); }
                        private void update() {
                            parametersMap.put(paramName, textField.getText());
                            if (onUpdateCallback != null) onUpdateCallback.run();
                        }
                    });
                    panel.add(textField);
                    break;
            }
            return panel;
        } catch (Exception e) {
            System.err.println("Error creating parameter panel for " + paramName + ": " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    private void updateCreateButtonState() {
        if (createButton != null) {
            boolean hasPath = app.getCanvasManager().hasPath();
            createButton.setEnabled(hasPath);
        }
    }
    
    public void enableCreateButton() {
        if (createButton != null) {
            updateCreateButtonState();
        }
    }
    
    public void createStrokeManagerWindow(StrokeManager strokeManager) {
        if (strokeManagerFrame != null && strokeManagerFrame.isDisplayable()) {
            strokeManagerFrame.toFront();
            strokeManagerFrame.requestFocus();
            refreshStrokeManagerContent(strokeManager);
            return;
        }
        
        strokeManagerFrame = new JFrame("Stroke Manager");
        strokeManagerFrame.setSize(1200, 700);
        strokeManagerFrame.setLocationRelativeTo(mainControlFrame);
        strokeManagerFrame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
        
        strokeManagerFrame.addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosed(WindowEvent e) {
                strokeManagerFrame = null;
                strokeListModel = null;
                strokeList = null;
                strokeDetailsContent = null;
                strokeDetailsScrollPane = null;
            }
        });
        
        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
        splitPane.setDividerLocation(350);

        JPanel leftPanel = new JPanel(new BorderLayout());
        strokeListModel = new DefaultListModel<>();
        strokeList = new JList<>(strokeListModel);
        strokeList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        strokeList.setCellRenderer(new StrokeListCellRenderer());
        updateStrokeList(strokeListModel, strokeManager);
        JScrollPane strokeScrollPane = new JScrollPane(strokeList);
        leftPanel.add(strokeScrollPane, BorderLayout.CENTER);

        strokeDetailsContent = new JPanel();
        strokeDetailsContent.setLayout(new BoxLayout(strokeDetailsContent, BoxLayout.Y_AXIS));
        strokeDetailsContent.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        strokeDetailsScrollPane = new JScrollPane(strokeDetailsContent);
        
        splitPane.setLeftComponent(leftPanel);
        splitPane.setRightComponent(strokeDetailsScrollPane);

        strokeList.addListSelectionListener(e -> {
            if (!e.getValueIsAdjusting()) {
                StrokeItem selectedItem = strokeList.getSelectedValue();
                if (selectedItem != null) {
                    updateStrokeDetails(strokeDetailsContent, selectedItem.stroke, strokeManager);
                } else {
                    strokeDetailsContent.removeAll();
                    strokeDetailsContent.revalidate();
                    strokeDetailsContent.repaint();
                }
            }
        });

        strokeManagerFrame.add(splitPane, BorderLayout.CENTER);
        strokeManagerFrame.setVisible(true);
        
        if (strokeListModel.getSize() > 0) {
            strokeList.setSelectedIndex(strokeListModel.getSize() - 1); // Select most recent
        }
    }
    
    /**
     * ✅ FIXED: Changed visibility from private to public.
     * This allows the StrokeManager to call this method to refresh the UI.
     */
    public void refreshStrokeManagerContent(StrokeManager strokeManager) {
        if (strokeListModel != null && strokeList != null) {
            StrokeItem selectedItem = strokeList.getSelectedValue();
            String selectedId = selectedItem != null ? selectedItem.stroke.getId() : null;
            
            updateStrokeList(strokeListModel, strokeManager);
            
            if (selectedId != null) {
                for (int i = 0; i < strokeListModel.getSize(); i++) {
                    if (strokeListModel.getElementAt(i).stroke.getId().equals(selectedId)) {
                        strokeList.setSelectedIndex(i);
                        return;
                    }
                }
            }
            
            if (strokeListModel.getSize() > 0) {
                strokeList.setSelectedIndex(strokeListModel.getSize() - 1);
            }
        }
    }
    
    private void refreshStrokeManagerIfOpen() {
        if (strokeManagerFrame != null && strokeManagerFrame.isDisplayable()) {
            SwingUtilities.invokeLater(() -> refreshStrokeManagerContent(app.getStrokeManager()));
        }
    }
    
    public void refreshStrokeManagerAndFocus(String strokeId) {
        if (strokeManagerFrame != null && strokeManagerFrame.isDisplayable()) {
            SwingUtilities.invokeLater(() -> {
                updateStrokeList(strokeListModel, app.getStrokeManager());
                for (int i = 0; i < strokeListModel.getSize(); i++) {
                    if (strokeListModel.getElementAt(i).stroke.getId().equals(strokeId)) {
                        strokeList.setSelectedIndex(i);
                        strokeList.ensureIndexIsVisible(i);
                        strokeManagerFrame.toFront();
                        strokeManagerFrame.requestFocus();
                        break;
                    }
                }
            });
        }
    }
    
    private void updateStrokeList(DefaultListModel<StrokeItem> listModel, StrokeManager strokeManager) {
        listModel.clear();
        strokeManager.loadExistingStrokes();
        for (int i = 0; i < strokeManager.getStrokeCount(); i++) {
            StrokeManager.Stroke stroke = strokeManager.getStroke(i);
            if (stroke != null) {
                String status = strokeManager.getStrokeProcessingStatus(stroke.getId());
                listModel.addElement(new StrokeItem(stroke, status));
            }
        }
    }
    
    /**
     * ✅ UPDATED: Renders the details of a selected stroke, now with editable parameters and image previews.
     */
    private void updateStrokeDetails(JPanel detailsPanel, StrokeManager.Stroke stroke, StrokeManager strokeManager) {
        detailsPanel.removeAll();
        
        // --- Static Info Panel ---
        JPanel infoPanel = new JPanel();
        infoPanel.setLayout(new BoxLayout(infoPanel, BoxLayout.Y_AXIS));
        infoPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        JLabel idLabel = new JLabel("ID: " + stroke.getId());
        idLabel.setFont(new Font("Monospaced", Font.PLAIN, 12));
        infoPanel.add(idLabel);
        
        JLabel effectLabel = new JLabel("Effect: " + stroke.getEffect().getName());
        effectLabel.setFont(new Font("Arial", Font.BOLD, 14));
        infoPanel.add(effectLabel);
        
        String status = strokeManager.getStrokeProcessingStatus(stroke.getId());
        JLabel statusLabel = new JLabel("Status: " + status);
        statusLabel.setFont(new Font("Arial", Font.PLAIN, 12));
        switch (status) {
            case "completed": statusLabel.setForeground(new Color(0, 150, 0)); break;
            case "failed": case "canceled": statusLabel.setForeground(Color.RED); break;
            case "running": statusLabel.setForeground(new Color(255, 140, 0)); break;
            default: statusLabel.setForeground(Color.GRAY); break;
        }
        infoPanel.add(statusLabel);
        detailsPanel.add(infoPanel);
        detailsPanel.add(Box.createVerticalStrut(10));

        // --- Buttons Panel ---
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        buttonPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        JButton runButton = new JButton("Run");
        JButton applyButton = new JButton("Apply to Canvas");
        JButton deleteButton = new JButton("Delete");
        
        runButton.addActionListener(e -> strokeManager.runStroke(stroke));
        applyButton.addActionListener(e -> {
            if (strokeManager.applyEffectToCanvas(stroke.getId())) {
                JOptionPane.showMessageDialog(detailsPanel, "Effect applied!", "Success", JOptionPane.INFORMATION_MESSAGE);
            }
        });
        deleteButton.addActionListener(e -> {
            int confirm = JOptionPane.showConfirmDialog(detailsPanel, "Delete this stroke?", "Confirm", JOptionPane.YES_NO_OPTION);
            if (confirm == JOptionPane.YES_OPTION && strokeManager.deleteStroke(stroke.getId())) {
                refreshStrokeManagerContent(strokeManager);
            }
        });
        
        buttonPanel.add(runButton);
        buttonPanel.add(applyButton);
        buttonPanel.add(deleteButton);
        
        if ("running".equals(status)) {
            JButton cancelButton = new JButton("Cancel");
            cancelButton.addActionListener(e -> strokeManager.cancelStrokeProcessing(stroke.getId()));
            buttonPanel.add(cancelButton);
        }
        detailsPanel.add(buttonPanel);
        detailsPanel.add(Box.createVerticalStrut(10));

        // --- Image Previews Panel ---
        JPanel imagesPanel = new JPanel(new GridLayout(1, 2, 10, 10));
        imagesPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        String projectId = app.getProjectId();
        if (projectId != null) {
            // Input Image
            String inputPath = "project/" + projectId + "/stroke/" + stroke.getId() + "_input.png";
            addImageWithOverlay(imagesPanel, inputPath, "Input", stroke);

            // Output Image
            String outputPath = "project/" + projectId + "/stroke/" + stroke.getId() + "_output.png";
            addImageWithOverlay(imagesPanel, outputPath, "Output", null);
        }
        detailsPanel.add(imagesPanel);
        detailsPanel.add(Box.createVerticalStrut(10));

        // --- Editable Parameters Panel ---
        JPanel paramsContainer = new JPanel();
        paramsContainer.setLayout(new BoxLayout(paramsContainer, BoxLayout.Y_AXIS));
        paramsContainer.setBorder(BorderFactory.createTitledBorder("Editable Parameters"));
        paramsContainer.setAlignmentX(Component.LEFT_ALIGNMENT);

        Map<String, Object> modifiedParameters = new HashMap<>(stroke.getParameters());
        Effect effect = stroke.getEffect();
        JSONObject userInputReqs = effect.getUserInputRequirements();

        for (Object key : userInputReqs.keys()) {
            String paramName = (String) key;
            JSONObject paramSpec = effect.getParamSpec(paramName);
            if (paramSpec != null) {
                JPanel paramPanel = createGenericParameterPanel(paramName, paramSpec, effect, modifiedParameters, null);
                if (paramPanel != null) {
                    paramsContainer.add(paramPanel);
                }
            }
        }
        
        JButton updateButton = new JButton("Save Parameter Changes");
        updateButton.addActionListener(e -> {
            if (strokeManager.updateStroke(stroke.getId(), modifiedParameters)) {
                JOptionPane.showMessageDialog(detailsPanel, "Parameters updated and saved.", "Success", JOptionPane.INFORMATION_MESSAGE);
                refreshStrokeManagerAndFocus(stroke.getId());
            } else {
                JOptionPane.showMessageDialog(detailsPanel, "Failed to update parameters.", "Error", JOptionPane.ERROR_MESSAGE);
            }
        });
        paramsContainer.add(Box.createVerticalStrut(10));
        paramsContainer.add(updateButton);
        detailsPanel.add(paramsContainer);

        detailsPanel.add(Box.createVerticalGlue());
        detailsPanel.revalidate();
        detailsPanel.repaint();
    }

    private void addImageWithOverlay(JPanel container, String imagePath, String title, StrokeManager.Stroke stroke) {
        java.io.File imageFile = new java.io.File(imagePath);
        if (imageFile.exists()) {
            try {
                BufferedImage bImg = javax.imageio.ImageIO.read(imageFile);
                if (stroke != null) { // Add path overlay only for input image
                     bImg = createImageWithExactPathOverlay(bImg, stroke);
                }
                
                // Scale image for display
                int maxSize = 300;
                float scale = Math.min(1, (float)maxSize / Math.max(bImg.getWidth(), bImg.getHeight()));
                int displayWidth = (int)(bImg.getWidth() * scale);
                int displayHeight = (int)(bImg.getHeight() * scale);
                
                ImageIcon icon = new ImageIcon(bImg.getScaledInstance(displayWidth, displayHeight, Image.SCALE_SMOOTH));
                JLabel label = new JLabel(icon);
                label.setBorder(BorderFactory.createTitledBorder(title));
                container.add(label);
            } catch (Exception e) {
                addImagePlaceholder(container, "Error loading image", title);
            }
        } else {
            String message = title.equals("Output") ? "Not processed yet" : "Image not found";
            addImagePlaceholder(container, message, title);
        }
    }

    private BufferedImage createImageWithExactPathOverlay(BufferedImage baseImage, StrokeManager.Stroke stroke) {
        BufferedImage overlayImage = new BufferedImage(baseImage.getWidth(), baseImage.getHeight(), BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = overlayImage.createGraphics();
        g2d.drawImage(baseImage, 0, 0, null);
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        for (Path path : stroke.getPaths()) {
            // Draw path line
            g2d.setColor(Color.RED);
            g2d.setStroke(new BasicStroke(2.0f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            ArrayList<PVector> points = path.getPoints();
            for (int i = 0; i < points.size() - 1; i++) {
                PVector p1 = points.get(i);
                PVector p2 = points.get(i + 1);
                g2d.drawLine((int)p1.x, (int)p1.y, (int)p2.x, (int)p2.y);
            }
            // Draw click point
            PVector clickPoint = path.getClickPoint();
            if (clickPoint != null) {
                g2d.setColor(Color.YELLOW);
                g2d.fillOval((int)clickPoint.x - 5, (int)clickPoint.y - 5, 10, 10);
                g2d.setColor(Color.BLACK);
                g2d.drawOval((int)clickPoint.x - 5, (int)clickPoint.y - 5, 10, 10);
            }
        }
        g2d.dispose();
        return overlayImage;
    }

    private void addImagePlaceholder(JPanel container, String message, String title) {
        JLabel placeholder = new JLabel(message, SwingConstants.CENTER);
        placeholder.setPreferredSize(new Dimension(300, 300));
        placeholder.setBorder(BorderFactory.createTitledBorder(title));
        placeholder.setOpaque(true);
        placeholder.setBackground(Color.LIGHT_GRAY);
        container.add(placeholder);
    }
    
    private static class StrokeItem {
        public final StrokeManager.Stroke stroke;
        public final String status;
        
        public StrokeItem(StrokeManager.Stroke stroke, String status) {
            this.stroke = stroke;
            this.status = status;
        }
        
        @Override
        public String toString() {
            return stroke.getEffect().getName() + " (" + status + ")";
        }
    }
    
    private static class StrokeListCellRenderer extends DefaultListCellRenderer {
        @Override
        public Component getListCellRendererComponent(JList<?> list, Object value, 
                int index, boolean isSelected, boolean cellHasFocus) {
            
            JLabel label = (JLabel) super.getListCellRendererComponent(
                list, value, index, isSelected, cellHasFocus);
            
            if (value instanceof StrokeItem) {
                StrokeItem item = (StrokeItem) value;
                
                String statusColor = "gray";
                switch (item.status) {
                    case "completed": statusColor = "green"; break;
                    case "failed": case "canceled": statusColor = "red"; break;
                    case "running": statusColor = "orange"; break;
                }
                
                String timestamp = new java.text.SimpleDateFormat("HH:mm:ss")
                    .format(new Date(Long.parseLong(item.stroke.getId().substring(7))));

                label.setText("<html><b>" + item.stroke.getEffect().getName() + "</b><br>" +
                             "<font size='2' color='" + statusColor + "'>Status: " + item.status + "</font><br>" +
                             "<font size='2' color='gray'>" + timestamp + "</font></html>");
                
                label.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
            }
            return label;
        }
    }
}
