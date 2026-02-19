import processing.core.*;
import processing.data.*;
import java.io.*;
import java.util.*;

public class EffectManager {
    private QuantumBrush app;
    private HashMap<String, Effect> effects;
    
    public EffectManager(QuantumBrush app) {
        this.app = app;
        this.effects = new HashMap<>();
        loadEffects();
    }
    
    public void loadEffects() {
        // Clear existing effects to prevent contamination
        effects.clear();
        
        File effectsDir = new File("effect");
        if (!effectsDir.exists() || !effectsDir.isDirectory()) {
            System.err.println("Error: effect directory not found or not a directory");
            return;
        }
        
        File[] effectFolders = effectsDir.listFiles(File::isDirectory);
        
        if (effectFolders == null || effectFolders.length == 0) {
            System.out.println("No effect folders found in effect directory");
            return;
        }
        
        for (File folder : effectFolders) {
            String folderName = folder.getName();
            
            // Look for requirements JSON files
            File[] jsonFiles = folder.listFiles(
                (dir, name) -> name.toLowerCase().endsWith("_requirements.json")
            );
            
            if (jsonFiles != null && jsonFiles.length > 0) {
                for (File jsonFile : jsonFiles) {
                    try {
                        // ✅ FIXED: Load JSON fresh each time to prevent contamination
                        JSONObject requirements = app.loadJSONObject(jsonFile.getAbsolutePath());
                        
                        if (requirements == null) {
                            System.err.println("Failed to load JSON from: " + jsonFile.getAbsolutePath());
                            continue;
                        }
                        
                        // Get the effect ID from the JSON file
                        String effectId = requirements.getString("id", folderName);
                        
                        // ✅ FIXED: Create a completely new Effect object with clean state
                        Effect effect = new Effect(effectId, folderName, requirements);
                        
                        // Store the effect using its ID as the key
                        effects.put(effectId, effect);
                        
                        System.out.println("Loaded effect: " + effectId + " from folder: " + folderName);
                        
                    } catch (Exception e) {
                        System.err.println(
                            "Error loading effect from " + jsonFile.getName() + 
                            ": " + e.getMessage()
                        );
                        e.printStackTrace();
                    }
                }
            } else {
                System.out.println("No requirements JSON files found in folder: " + folderName);
            }
        }
    }
    
    public Effect getEffect(String id) {
        return effects.get(id);
    }
    
    public Set<String> getEffectNames() {
        return effects.keySet();
    }
    
    public ArrayList<Effect> getEffects() {
        return new ArrayList<>(effects.values());
    }
}

class Effect {
    private String id;
    private String folderName;
    private JSONObject requirements;
    
    public Effect(String id, String folderName, JSONObject requirements) {
        this.id = id;
        this.folderName = folderName;
        // ✅ FIXED: Make a deep copy of the requirements to prevent contamination
        this.requirements = copyJSONObject(requirements);
    }
    
    // ✅ FIXED: Deep copy JSON to prevent cross-contamination between effects
    private JSONObject copyJSONObject(JSONObject original) {
        if (original == null) return new JSONObject();
        
        try {
            // Convert to string and back to create a deep copy
            String jsonString = original.toString();
            return JSONObject.parse(jsonString);
        } catch (Exception e) {
            System.err.println("Error copying JSON object: " + e.getMessage());
            return new JSONObject();
        }
    }
    
    public String getId() {
        return id;
    }
    
    public String getFolderName() {
        return folderName;
    }
    
    public String getName() {
        return requirements.getString("name", id);
    }
    
    public JSONObject getRequirements() {
        return requirements;
    }
    
    public JSONObject getUserInputRequirements() {
        if (requirements.hasKey("user_input")) {
            return requirements.getJSONObject("user_input");
        }
        return new JSONObject();
    }
    
    /**
     * Gets the parameter specification for a specific parameter.
     */
    public JSONObject getParamSpec(String paramName) {
        JSONObject userInput = getUserInputRequirements();
        if (userInput.hasKey(paramName)) {
            Object paramValue = userInput.get(paramName);
            if (paramValue instanceof JSONObject) {
                return (JSONObject) paramValue;
            }
        }
        return null;
    }
    
    /**
     * Gets the parameter type for a specific parameter.
     */
    public String getParamType(String paramName) {
        JSONObject paramSpec = getParamSpec(paramName);
        if (paramSpec != null && paramSpec.hasKey("type")) {
            return paramSpec.getString("type");
        }
        return null;
    }
    
    /**
     * Gets the minimum value for a numeric parameter.
     */
    public float getParamMin(String paramName, float defaultMin) {
        JSONObject paramSpec = getParamSpec(paramName);
        if (paramSpec != null && paramSpec.hasKey("min")) {
            return paramSpec.getFloat("min");
        }
        return defaultMin;
    }
    
    /**
     * Gets the maximum value for a numeric parameter.
     */
    public float getParamMax(String paramName, float defaultMax) {
        JSONObject paramSpec = getParamSpec(paramName);
        if (paramSpec != null && paramSpec.hasKey("max")) {
            return paramSpec.getFloat("max");
        }
        return defaultMax;
    }
    
    /**
     * Gets the default value for a parameter.
     */
    public Object getParamDefault(String paramName) {
        JSONObject paramSpec = getParamSpec(paramName);
        
        if (paramSpec != null && paramSpec.hasKey("default")) {
            String type = getParamType(paramName);
            
            try {
                if ("int".equals(type)) {
                    return paramSpec.getInt("default");
                } else if ("float".equals(type)) {
                    return paramSpec.getFloat("default");
                } else if ("bool".equals(type) || "boolean".equals(type)) {
                    return paramSpec.getBoolean("default");
                } else {
                    return paramSpec.get("default");
                }
            } catch (Exception e) {
                System.err.println("Error reading default value for " + paramName + ": " + e.getMessage());
                return paramSpec.get("default");
            }
        }
        
        return null;
    }
    
    public Map<String, Object> getDefaultParameters() {
        Map<String, Object> params = new HashMap<>();
        JSONObject userInput = getUserInputRequirements();
        
        for (Object key : userInput.keys()) {
            String paramName = (String) key;
            Object defaultValue = getParamDefault(paramName);
            if (defaultValue != null) {
                params.put(paramName, defaultValue);
            }
        }
        
        return params;
    }
}
