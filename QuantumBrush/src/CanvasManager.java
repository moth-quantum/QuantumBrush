import processing.core.PApplet;
import processing.core.PImage;

import java.util.ArrayList;

public class CanvasManager {
    private PApplet app;
    private ArrayList<Path> paths;
    private Path currentPath;
    private ArrayList<ArrayList<Path>> undoHistory;
    private int historyIndex;

    public CanvasManager(PApplet app) {
        this.app = app;
        this.paths = new ArrayList<>();
        this.currentPath = null;
        this.undoHistory = new ArrayList<>();
        this.historyIndex = -1;
    }

    public void startNewPath() {
        currentPath = new Path();
    }

    public void setClickPoint(float x, float y) {
        if (currentPath != null) {
            currentPath.setClickPoint(x, y);
        }
    }

    public void addPointToCurrentPath(float x, float y) {
        if (currentPath != null) {
            currentPath.addPoint(x, y);
        }
    }

    public void finishCurrentPath() {
        if (currentPath != null && currentPath.hasPoints()) {
            // Add the path (history is now managed by main class)
            paths.add(currentPath);
            currentPath = null;
        }
    }

    public void draw() {
        // Draw all paths
        app.stroke(255, 0, 0); // Red brush
        app.strokeWeight(2);

        for (Path path : paths) {
            path.draw(app);
        }

        if (currentPath != null) {
            currentPath.draw(app);
        }
    }

    public void clearPaths() {
        paths.clear();
        currentPath = null;
    }

    public ArrayList<Path> getPaths() {
        return paths;
    }

    public boolean hasPath() {
        return !paths.isEmpty();
    }
    
    // Undo/Redo functionality
    private void saveHistoryState() {
        // Remove any states after current index
        while (undoHistory.size() > historyIndex + 1) {
            undoHistory.remove(undoHistory.size() - 1);
        }
        
        // Create a deep copy of current paths
        ArrayList<Path> pathsCopy = new ArrayList<>();
        for (Path path : paths) {
            pathsCopy.add(path.copy());
        }
        
        // Add to history
        undoHistory.add(pathsCopy);
        historyIndex = undoHistory.size() - 1;
    }
    
    public void undo() {
        if (historyIndex > 0) {
            historyIndex--;
            paths = new ArrayList<>();
            for (Path path : undoHistory.get(historyIndex)) {
                paths.add(path.copy());
            }
        } else if (historyIndex == 0) {
            historyIndex--;
            paths.clear();
        }
    }
    
    public void redo() {
        if (historyIndex < undoHistory.size() - 1) {
            historyIndex++;
            paths = new ArrayList<>();
            for (Path path : undoHistory.get(historyIndex)) {
                paths.add(path.copy());
            }
        }
    }

    // Add a method to set paths from outside (needed for project undo/redo)
    public void setPaths(ArrayList<Path> newPaths) {
        paths = new ArrayList<>();
        for (Path path : newPaths) {
            paths.add(path.copy());
        }
        currentPath = null;
    }
}

class Path {
    private ArrayList<PVector> points;
    private PVector clickPoint;

    public Path() {
        this.points = new ArrayList<>();
    }
    
    public Path(float x, float y) {
        this();
        addPoint(x, y);
    }

    public void addPoint(float x, float y) {
        points.add(new PVector(x, y));
    }

    public void setClickPoint(float x, float y) {
        clickPoint = new PVector(x, y);
    }

    public PVector getClickPoint() {
        return clickPoint;
    }

    public ArrayList<PVector> getPoints() {
        return points;
    }

    public boolean hasPoints() {
        return !points.isEmpty();
    }

    public void draw(PApplet app) {
        // Always draw the yellow dot first if it exists
        if (clickPoint != null) {
            app.pushStyle();
            app.fill(255, 255, 0);  // Yellow
            app.noStroke();
            app.ellipse(clickPoint.x, clickPoint.y, 10, 10);
            app.popStyle();
        }
        
        // Draw line segments only if we have at least 2 points
        if (points.size() >= 2) {
            app.pushStyle();
            app.stroke(255, 0, 0); // Red brush
            app.strokeWeight(2);
            
            // Draw as individual line segments
            for (int i = 0; i < points.size() - 1; i++) {
                PVector p1 = points.get(i);
                PVector p2 = points.get(i + 1);
                app.line(p1.x, p1.y, p2.x, p2.y);
            }
            
            app.popStyle();
        }
    }
    
    public Path copy() {
        Path newPath = new Path();
        for (PVector p : points) {
            newPath.addPoint(p.x, p.y);
        }
        if (clickPoint != null) {
            newPath.setClickPoint(clickPoint.x, clickPoint.y);
        }
        return newPath;
    }
}

class PVector {
    public float x, y;
    
    public PVector(float x, float y) {
        this.x = x;
        this.y = y;
    }
}
