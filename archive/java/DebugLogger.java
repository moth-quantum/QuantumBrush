import java.util.*;
import java.io.*;

public class DebugLogger {
    private static final List<String> logs = Collections.synchronizedList(new ArrayList<>());
    private static final int MAX_LOGS = 1000; // Limit to prevent memory issues
    private static PrintStream originalOut;
    private static PrintStream originalErr;
    private static boolean isRedirecting = false;
    
    static {
        // Store original streams
        originalOut = System.out;
        originalErr = System.err;
        
        // Start redirecting immediately
        startRedirection();
    }
    
    /**
     * Start redirecting System.out and System.err to the debug logger
     */
    public static void startRedirection() {
        if (isRedirecting) return;
        
        isRedirecting = true;
        
        // Create custom PrintStream that captures output
        PrintStream customOut = new PrintStream(new OutputStream() {
            private StringBuilder buffer = new StringBuilder();
            
            @Override
            public void write(int b) throws IOException {
                char c = (char) b;
                if (c == '\n') {
                    // Line is complete, log it
                    String line = buffer.toString();
                    if (!line.trim().isEmpty()) {
                        addLogEntry("[OUT] " + line);
                    }
                    buffer.setLength(0);
                } else if (c != '\r') { // Ignore carriage returns
                    buffer.append(c);
                }
                
                // Also write to original output
                originalOut.write(b);
            }
        });
        
        PrintStream customErr = new PrintStream(new OutputStream() {
            private StringBuilder buffer = new StringBuilder();
            
            @Override
            public void write(int b) throws IOException {
                char c = (char) b;
                if (c == '\n') {
                    // Line is complete, log it
                    String line = buffer.toString();
                    if (!line.trim().isEmpty()) {
                        addLogEntry("[ERR] " + line);
                    }
                    buffer.setLength(0);
                } else if (c != '\r') { // Ignore carriage returns
                    buffer.append(c);
                }
                
                // Also write to original error stream
                originalErr.write(b);
            }
        });
        
        // Replace System.out and System.err
        System.setOut(customOut);
        System.setErr(customErr);
        
        log("=== DEBUG LOGGER STARTED ===");
        log("All System.out.println() and System.err.println() calls will now appear in the debug viewer");
    }
    
    /**
     * Stop redirecting and restore original streams
     */
    public static void stopRedirection() {
        if (!isRedirecting) return;
        
        log("=== STOPPING DEBUG LOGGER ===");
        
        System.setOut(originalOut);
        System.setErr(originalErr);
        isRedirecting = false;
    }
    
    /**
     * Add a log entry with timestamp
     */
    public static void log(String message) {
        addLogEntry("[LOG] " + message);
    }
    
    /**
     * Internal method to add log entries
     */
    private static void addLogEntry(String message) {
        String timestamp = java.time.LocalTime.now().format(
            java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss.SSS")
        );
        String logEntry = "[" + timestamp + "] " + message;
        
        synchronized (logs) {
            logs.add(logEntry);
            
            // Remove old entries if we exceed the limit
            while (logs.size() > MAX_LOGS) {
                logs.remove(0);
            }
        }
    }
    
    /**
     * Get all logs as a single string
     */
    public static String getAllLogs() {
        synchronized (logs) {
            if (logs.isEmpty()) {
                return "No logs available yet.\n\nLogs will appear here when:\n" +
                       "- You create effects\n" +
                       "- You process strokes\n" +
                       "- The application performs various operations\n" +
                       "- Any System.out.println() or System.err.println() calls are made\n\n" +
                       "Try creating an effect to see parameter processing details!";
            }
            
            StringBuilder sb = new StringBuilder();
            for (String log : logs) {
                sb.append(log).append("\n");
            }
            return sb.toString();
        }
    }
    
    /**
     * Get the number of log entries
     */
    public static int getLogCount() {
        synchronized (logs) {
            return logs.size();
        }
    }
    
    /**
     * Clear all logs
     */
    public static void clearLogs() {
        synchronized (logs) {
            logs.clear();
        }
        log("Debug log cleared");
    }
    
    /**
     * Add test logs for debugging the logger itself
     */
    public static void addTestLog() {
        log("=== TEST LOG ENTRY ===");
        log("This is a test log entry added at: " + new java.util.Date());
        System.out.println("This is a test System.out.println() call");
        System.err.println("This is a test System.err.println() call");
        log("Test completed - you should see multiple entries above");
    }
    
    /**
     * Get original output streams (for cases where you need direct access)
     */
    public static PrintStream getOriginalOut() {
        return originalOut;
    }
    
    public static PrintStream getOriginalErr() {
        return originalErr;
    }
    
    /**
     * Check if redirection is active
     */
    public static boolean isRedirecting() {
        return isRedirecting;
    }
}
