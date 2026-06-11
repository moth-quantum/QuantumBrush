import javax.swing.JPanel;
import javax.swing.JButton;
import java.awt.Component;

public class ModernWorkspacePanelTest {
    public static void main(String[] args) {
        String[] steps = ModernWorkspacePanel.getWorkflowStepLabels();

        if (steps.length != 5) {
            throw new AssertionError("Expected five workflow steps");
        }
        if (!"Project".equals(steps[0])) {
            throw new AssertionError("First step should orient users around project setup");
        }
        if (!"Export".equals(steps[4])) {
            throw new AssertionError("Last step should orient users around export");
        }

        String summary = ModernWorkspacePanel.getWorkflowSummaryText();
        if (!summary.contains("Project") || !summary.contains("Export")) {
            throw new AssertionError("Summary should mention the full project-to-export workflow");
        }

        JPanel panel = ModernWorkspacePanel.createHeaderPanel();
        if (panel.getComponentCount() < 2) {
            throw new AssertionError("Header panel should contain title and workflow content");
        }

        String[] actionLabels = ModernWorkspacePanel.getQuickActionLabels();
        if (actionLabels.length != 4) {
            throw new AssertionError("Expected four quick actions for the core workflow");
        }
        if (!"New Project".equals(actionLabels[0])) {
            throw new AssertionError("First action should create a project");
        }
        if (!"Export".equals(actionLabels[3])) {
            throw new AssertionError("Last action should export or save work");
        }

        JPanel actions = ModernWorkspacePanel.createQuickActionsPanel(
            event -> {},
            event -> {},
            event -> {},
            event -> {}
        );
        int buttonCount = 0;
        for (Component component : actions.getComponents()) {
            if (component instanceof JButton) {
                buttonCount++;
            }
        }
        if (buttonCount != actionLabels.length) {
            throw new AssertionError("Quick actions panel should expose each core workflow action");
        }
    }
}
