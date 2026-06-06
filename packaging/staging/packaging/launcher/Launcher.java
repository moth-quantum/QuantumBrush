import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

public class Launcher {
    private static Path userConfigPath() {
        return Paths.get(System.getProperty("user.home"), ".quantumbrush", "config", "python_path.txt");
    }

    private static Path userRunDir() {
        return Paths.get(System.getProperty("user.home"), ".quantumbrush", "run");
    }

    public static void main(String[] args) throws Exception {
        Path appContent = resolveAppContent();
        Path mainJar = findMainJar(appContent);
        if (mainJar == null) {
            System.err.println("QuantumBrush.jar not found in " + appContent);
            System.exit(1);
        }

        if (needsSetup()) {
            int code = runSetup(appContent);
            if (code != 0) {
                System.exit(code);
            }
            if (needsSetup()) {
                System.err.println("Setup finished but Python environment is still missing.");
                System.err.println("Close this window, open a new terminal, and launch QuantumBrush again.");
                System.exit(1);
            }
        }

        Path launchDir = prepareLaunchDirectory(appContent);
        launchMainJar(launchDir, mainJar, args);
    }

    private static Path resolveAppContent() throws Exception {
        Path fromLauncher = launcherDirectory();
        if (fromLauncher != null && Files.exists(fromLauncher.resolve("QuantumBrush.jar"))) {
            return fromLauncher;
        }

        String appPath = System.getProperty("jpackage.app-path");
        if (appPath != null && !appPath.isEmpty()) {
            Path root = Paths.get(appPath);
            Path[] candidates = {
                root.resolve("lib/app"),
                root.getParent() != null ? root.getParent().resolve("lib/app") : null,
                root
            };
            for (Path candidate : candidates) {
                if (candidate != null && Files.exists(candidate.resolve("QuantumBrush.jar"))) {
                    return candidate.toAbsolutePath().normalize();
                }
            }
        }

        Path cwd = Paths.get("").toAbsolutePath().normalize();
        if (Files.exists(cwd.resolve("QuantumBrush.jar"))) {
            return cwd;
        }
        return cwd;
    }

    private static Path launcherDirectory() throws Exception {
        if (Launcher.class.getProtectionDomain().getCodeSource() == null) {
            return null;
        }
        Path code = Paths.get(Launcher.class.getProtectionDomain().getCodeSource().getLocation().toURI());
        if (Files.isRegularFile(code)) {
            return code.getParent().toAbsolutePath().normalize();
        }
        if (Files.isDirectory(code)) {
            return code.toAbsolutePath().normalize();
        }
        return null;
    }

    private static Path findMainJar(Path appContent) throws IOException {
        Path direct = appContent.resolve("QuantumBrush.jar");
        if (Files.isRegularFile(direct)) {
            return direct;
        }

        try (Stream<Path> stream = Files.walk(appContent, 3)) {
            return stream
                .filter(Files::isRegularFile)
                .filter(path -> path.getFileName().toString().startsWith("QuantumBrush")
                    && path.getFileName().toString().endsWith(".jar")
                    && !path.getFileName().toString().equals("launcher.jar"))
                .findFirst()
                .orElse(null);
        }
    }

    private static boolean needsSetup() {
        Path envDir = Paths.get(System.getProperty("user.home"), ".quantumbrush", "env");
        return !Files.isRegularFile(userConfigPath()) || !Files.isDirectory(envDir);
    }

    private static int runSetup(Path appContent) throws IOException, InterruptedException {
        Path setupScript = appContent.resolve("setup.sh");
        if (!Files.isRegularFile(setupScript)) {
            System.err.println("setup.sh not found in " + appContent);
            return 1;
        }

        List<String> command = new ArrayList<>();
        String os = System.getProperty("os.name", "").toLowerCase();
        if (os.contains("win")) {
            String bash = findWindowsBash();
            if (bash == null) {
                System.err.println("Git Bash or WSL is required to configure Python dependencies on Windows.");
                System.err.println("Install Git for Windows, then launch QuantumBrush again.");
                return 1;
            }
            command.add(bash);
            command.add("-lc");
            command.add("cd '" + escapeSingleQuotes(appContent.toString()) + "' && bash setup.sh --yes");
        } else {
            command.add("bash");
            command.add(setupScript.toString());
            command.add("--yes");
        }

        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(appContent.toFile());
        builder.inheritIO();
        return builder.start().waitFor();
    }

    private static Path prepareLaunchDirectory(Path appContent) throws IOException {
        Path runDir = userRunDir();
        Files.createDirectories(runDir);
        Files.createDirectories(runDir.resolve("config"));
        Files.createDirectories(runDir.resolve("project"));
        Files.createDirectories(runDir.resolve("log"));
        Files.createDirectories(runDir.resolve("metadata"));

        Path userConfig = userConfigPath();
        if (Files.isRegularFile(userConfig)) {
            Files.copy(userConfig, runDir.resolve("config/python_path.txt"),
                StandardCopyOption.REPLACE_EXISTING);
        }

        linkOrCopy(appContent, runDir, "effect");
        linkOrCopy(appContent, runDir, "QuantumBrush_lib");

        return runDir.toAbsolutePath().normalize();
    }

    private static void linkOrCopy(Path appContent, Path runDir, String name) throws IOException {
        Path source = appContent.resolve(name);
        if (!Files.exists(source)) {
            return;
        }

        Path target = runDir.resolve(name);
        if (Files.exists(target)) {
            return;
        }

        try {
            Files.createSymbolicLink(target, source);
        } catch (IOException | UnsupportedOperationException ex) {
            if (Files.isDirectory(source)) {
                copyDirectory(source, target);
            } else {
                Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
            }
        }
    }

    private static void copyDirectory(Path source, Path target) throws IOException {
        Files.walk(source).forEach(path -> {
            try {
                Path dest = target.resolve(source.relativize(path));
                if (Files.isDirectory(path)) {
                    Files.createDirectories(dest);
                } else {
                    Files.createDirectories(dest.getParent());
                    Files.copy(path, dest, StandardCopyOption.REPLACE_EXISTING);
                }
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        });
    }

    private static String findWindowsBash() {
        String[] candidates = {
            System.getenv("ProgramFiles") + "\\Git\\bin\\bash.exe",
            System.getenv("ProgramFiles(x86)") + "\\Git\\bin\\bash.exe",
            System.getenv("LOCALAPPDATA") + "\\Programs\\Git\\bin\\bash.exe",
            "C:\\Program Files\\Git\\bin\\bash.exe"
        };
        for (String candidate : candidates) {
            if (candidate != null && new File(candidate).isFile()) {
                return candidate;
            }
        }
        return null;
    }

    private static void launchMainJar(Path launchDir, Path mainJar, String[] args) throws IOException {
        String javaBin = Paths.get(System.getProperty("java.home"), "bin", "java").toString();
        if (System.getProperty("os.name", "").toLowerCase().contains("win")) {
            javaBin += ".exe";
        }

        List<String> command = new ArrayList<>();
        command.add(javaBin);
        command.add("-jar");
        command.add(mainJar.toAbsolutePath().toString());
        for (String arg : args) {
            command.add(arg);
        }

        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(launchDir.toFile());
        builder.inheritIO();
        try {
            int code = builder.start().waitFor();
            System.exit(code);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.exit(1);
        }
    }

    private static String escapeSingleQuotes(String value) {
        return value.replace("'", "'\\''");
    }
}
