import processing.data.*;
import java.util.Arrays;
import java.util.Map;

/**
 * Holds the live hardware-execution configuration the user selects in the
 * Hardware tab: which backend to use (Aer simulator or IQM Garnet), the
 * shots / optimization level / QPU-second cap, and the IQM API token.
 *
 * The token is kept in a char[] and is never written to disk. It is handed to
 * the Python subprocess via the IQM_TOKEN environment variable in
 * applyToProcessEnv, and cleared on app close (see QuantumBrush.setup()).
 */
public class HardwareManager {
    public static final String PROVIDER_AER = "aer";
    public static final String PROVIDER_IQM = "iqm";

    private String provider = PROVIDER_AER;
    private String device = "garnet";
    private int shots = 1024;
    private int optimizationLevel = 2;
    private double maxQpuSeconds = 30.0;
    private char[] token = new char[0];

    public String getProvider() { return provider; }
    public void setProvider(String provider) {
        if (PROVIDER_AER.equals(provider) || PROVIDER_IQM.equals(provider)) {
            this.provider = provider;
        }
    }

    public String getDevice() { return device; }
    public void setDevice(String device) { this.device = device; }

    public int getShots() { return shots; }
    public void setShots(int shots) { this.shots = Math.max(1, shots); }

    public int getOptimizationLevel() { return optimizationLevel; }
    public void setOptimizationLevel(int level) {
        this.optimizationLevel = Math.max(0, Math.min(3, level));
    }

    public double getMaxQpuSeconds() { return maxQpuSeconds; }
    public void setMaxQpuSeconds(double v) { this.maxQpuSeconds = Math.max(0.0, v); }

    public boolean hasToken() { return token != null && token.length > 0; }

    /**
     * Replaces the in-memory token. The caller is responsible for zeroing the
     * source array (e.g. JPasswordField.getPassword()) after this call.
     */
    public void setToken(char[] newToken) {
        clearToken();
        if (newToken != null) {
            token = Arrays.copyOf(newToken, newToken.length);
        }
    }

    /** Zeros the in-memory token. Safe to call multiple times. */
    public void clearToken() {
        if (token != null) Arrays.fill(token, '\0');
        token = new char[0];
    }

    /**
     * Snapshot of the public config to embed in a stroke JSON's "hardware"
     * block. The token is intentionally excluded — see applyToProcessEnv.
     */
    public JSONObject snapshotForStroke() {
        JSONObject hw = new JSONObject();
        hw.setString("provider", provider);
        hw.setString("device", device);
        hw.setInt("shots", shots);
        hw.setInt("optimization_level", optimizationLevel);
        hw.setFloat("max_qpu_seconds", (float) maxQpuSeconds);
        return hw;
    }

    /**
     * Hands the IQM token off to a subprocess environment that's about to be
     * launched. Token never gets written to disk this way. If the provider is
     * not IQM, IQM_TOKEN is explicitly removed so a stale value from an outer
     * environment can't leak in.
     */
    public void applyToProcessEnv(Map<String, String> env) {
        if (PROVIDER_IQM.equals(provider) && hasToken()) {
            env.put("IQM_TOKEN", new String(token));
        } else {
            env.remove("IQM_TOKEN");
        }
    }
}
