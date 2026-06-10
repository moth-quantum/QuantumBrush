import javax.swing.JPanel;

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
    }
}
