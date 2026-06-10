import javax.swing.BorderFactory;
import javax.swing.BoxLayout;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingConstants;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.FlowLayout;
import java.awt.Font;

public final class ModernWorkspacePanel {
    private static final String[] WORKFLOW_STEPS = {
        "Project",
        "Canvas",
        "Effect",
        "Stroke",
        "Export"
    };
    private static final Color SURFACE = new Color(248, 250, 252);
    private static final Color BORDER = new Color(210, 218, 227);
    private static final Color TEXT = new Color(32, 39, 53);
    private static final Color MUTED_TEXT = new Color(89, 101, 119);
    private static final Color ACCENT = new Color(38, 92, 170);

    private ModernWorkspacePanel() {
    }

    public static void installLookAndFeel() {
        try {
            javax.swing.UIManager.setLookAndFeel(javax.swing.UIManager.getSystemLookAndFeelClassName());
        } catch (Exception ignored) {
            // The app still works with the default look and feel.
        }
    }

    public static String[] getWorkflowStepLabels() {
        return WORKFLOW_STEPS.clone();
    }

    public static String getWorkflowSummaryText() {
        return String.join(" -> ", WORKFLOW_STEPS);
    }

    public static void styleControlWindow(JFrame frame) {
        if (frame != null) {
            frame.getContentPane().setBackground(SURFACE);
        }
    }

    public static JPanel createHeaderPanel() {
        JPanel panel = new JPanel(new BorderLayout(0, 10));
        panel.setBorder(new EmptyBorder(0, 0, 12, 0));
        panel.setOpaque(false);

        JPanel copyPanel = new JPanel();
        copyPanel.setLayout(new BoxLayout(copyPanel, BoxLayout.Y_AXIS));
        copyPanel.setOpaque(false);

        JLabel title = new JLabel("Quantum Brush workspace");
        title.setAlignmentX(Component.LEFT_ALIGNMENT);
        title.setFont(title.getFont().deriveFont(Font.BOLD, 18f));
        title.setForeground(TEXT);

        JLabel summary = new JLabel("Follow the core flow: " + getWorkflowSummaryText());
        summary.setAlignmentX(Component.LEFT_ALIGNMENT);
        summary.setBorder(new EmptyBorder(4, 0, 0, 0));
        summary.setFont(summary.getFont().deriveFont(Font.PLAIN, 12f));
        summary.setForeground(MUTED_TEXT);

        copyPanel.add(title);
        copyPanel.add(summary);

        JPanel stepsPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        stepsPanel.setOpaque(false);
        String[] steps = getWorkflowStepLabels();
        for (int index = 0; index < steps.length; index++) {
            stepsPanel.add(createStepLabel(index + 1, steps[index]));
        }

        panel.add(copyPanel, BorderLayout.NORTH);
        panel.add(stepsPanel, BorderLayout.CENTER);
        return panel;
    }

    private static JLabel createStepLabel(int index, String label) {
        JLabel step = new JLabel(index + "  " + label, SwingConstants.CENTER);
        step.setOpaque(true);
        step.setBackground(Color.WHITE);
        step.setForeground(index == 1 ? ACCENT : TEXT);
        step.setFont(step.getFont().deriveFont(Font.BOLD, 11f));
        step.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(index == 1 ? ACCENT : BORDER),
            new EmptyBorder(6, 10, 6, 10)
        ));
        return step;
    }
}
