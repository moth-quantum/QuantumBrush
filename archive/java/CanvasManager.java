import processing.core.PApplet;
import processing.core.PImage;

import java.util.ArrayList;
import java.util.concurrent.CopyOnWriteArrayList;

public class CanvasManager {
    private PApplet app;
    private CopyOnWriteArrayList<Path> paths;
    private Path currentPath;
    private ArrayList<ArrayList<Path>> undoHistory;
    private int historyIndex;

    public CanvasManager(PApplet app) {
        this.app = app;
        this.paths = new CopyOnWriteArrayList<>();
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
    
    /*
    public void addPointToCurrentPath(float x, float y) {
        if (currentPath != null) {
            currentPath.addPoint(x, y);
        }
    }
    */
    
    // WITH this new method:
    public void addPointToCurrentPath(float x, float y, boolean shiftPressed) {
        if (currentPath != null) {
            // Pass the boolean flag down to the Path object
            currentPath.addPoint(x, y, shiftPressed);
        }
    }

    public void finishCurrentPath() {
        if (currentPath != null && currentPath.hasPoints()) {
            paths.add(currentPath);
            currentPath = null;
            
            notifyPathChanged();
        }
    }

    public void draw(float zoomLevel, float panX, float panY) {
        try {
            app.pushMatrix();
            app.translate(panX, panY);
            app.scale(zoomLevel);
            
            for (Path path : paths) {
                if (path != null) {
                    path.draw(app, zoomLevel);
                }
            }

            if (currentPath != null) {
                currentPath.draw(app, zoomLevel);
            }
            
            app.popMatrix();
        } catch (Exception e) {
            System.err.println("Error in CanvasManager.draw(): " + e.getMessage());
        }
    }

    public void clearPaths() {
        paths.clear();
        currentPath = null;
        
        notifyPathChanged();
    }

    public ArrayList<Path> getPaths() {
        return new ArrayList<>(paths);
    }

    public boolean hasPath() {
        return !paths.isEmpty();
    }
    
    private void notifyPathChanged() {
        if (app instanceof QuantumBrush) {
            QuantumBrush quantumApp = (QuantumBrush) app;
            if (quantumApp.getUIManager() != null) {
                quantumApp.getUIManager().enableCreateButton();
            }
        }
    }
    
    // ... existing code ...
    
    public void setPaths(ArrayList<Path> newPaths) {
        paths.clear();
        if (newPaths != null) {
            for (Path path : newPaths) {
                if (path != null) {
                    paths.add(path.copy());
                }
            }
        }
        currentPath = null;
        
        notifyPathChanged();
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
        // addPoint(x, y);
        addPoint(x, y, false); // Add 'false'
    }

    /*
    public void addPoint(float x, float y) {
        if (clickPoint != null && points.size() > 0) {
            // Calculate delta from click point
            float deltaX = x - clickPoint.x;
            float deltaY = y - clickPoint.y;
            
            // Compare magnitudes to decide horizontal or vertical
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal line - lock Y to click point Y
                points.add(new PVector(x, clickPoint.y));
            } else {
                // Vertical line - lock X to click point X
                points.add(new PVector(clickPoint.x, y));
            }
        } else {
            // Normal drawing without constraint
            points.add(new PVector(x, y));
        }
    }
    */
    
    // WITH this new, corrected method:
    public void addPoint(float x, float y, boolean shiftPressed) {
        // The clickPoint is the starting "anchor" for the constraint
        // We also check points.size() > 0 because the *very first* point
        // (added in mousePressed) should just be at (x, y)
        if (shiftPressed && clickPoint != null && points.size() > 0) {
            
            // Calculate delta from the *original* click point
            float deltaX = x - clickPoint.x;
            float deltaY = y - clickPoint.y;
            
            // Compare absolute magnitudes to decide horizontal or vertical
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal line: Lock Y to the click point's Y
                points.add(new PVector(x, clickPoint.y));
            } else {
                // Vertical line: Lock X to the click point's X
                points.add(new PVector(clickPoint.x, y));
            }
        } else {
            // Normal drawing (if Shift is not pressed OR this is the very first point)
            points.add(new PVector(x, y));
        }
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

    public void draw(PApplet app, float zoomLevel) {
        if (clickPoint != null) {
            app.pushStyle();
            
            app.fill(0, 0, 0);
            app.noStroke();
            float borderSize = 12.0f / zoomLevel;
            app.ellipse(clickPoint.x, clickPoint.y, borderSize, borderSize);
            
            app.fill(255, 255, 0);
            float dotSize = 8.0f / zoomLevel;
            app.ellipse(clickPoint.x, clickPoint.y, dotSize, dotSize);
            
            app.popStyle();
        }
        
        if (points.size() >= 2) {
            app.pushStyle();
            
            try {
                app.stroke(255, 255, 0);
                app.strokeWeight(6.0f / zoomLevel);
                app.strokeCap(app.ROUND);
                app.strokeJoin(app.ROUND);
                
                for (int i = 0; i < points.size() - 1; i++) {
                    PVector p1 = points.get(i);
                    PVector p2 = points.get(i + 1);
                    if (p1 != null && p2 != null) {
                        app.line(p1.x, p1.y, p2.x, p2.y);
                    }
                }
                
                app.stroke(255, 0, 0);
                app.strokeWeight(3.0f / zoomLevel);
                
                for (int i = 0; i < points.size() - 1; i++) {
                    PVector p1 = points.get(i);
                    PVector p2 = points.get(i + 1);
                    if (p1 != null && p2 != null) {
                        app.line(p1.x, p1.y, p2.x, p2.y);
                    }
                }
                
            } catch (Exception e) {
                System.err.println("Concurrent modification in Path.draw(), skipping frame");
            }
            
            app.popStyle();
        }
    }
    
    public Path copy() {
        Path newPath = new Path();
        synchronized(points) {
            for (PVector p : points) {
                if (p != null) {
                    // newPath.addPoint(p.x, p.y);
                	newPath.addPoint(p.x, p.y, false); // Add 'false'
                }
            }
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