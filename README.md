🔍 Hello! I am a creative image modification tool powered by quantum computing.
- Brush collection powered by quantum algorithms.
- Lightweight program which supports quantum simulation and hardware communication both.
- Work with high-res images with quantum backend to draw, modify and have fun!

👩🏻‍💻 Author: MOTH Quantum (This app is built with ❤️ by [Astryd Park](https://www.github.com/artreadcode))

---

📋 Contents
1. [Usage Instruction](https://github.com/moth-quantum/quantumbrush?tab=readme-ov-file#usage-instruction)
2. [Installation Instruction](https://github.com/moth-quantum/quantumbrush?tab=readme-ov-file#installation-instructions)
3. [Examples](https://github.com/moth-quantum/quantumbrush?tab=readme-ov-file#examples)
4. [One more thing](https://github.com/moth-quantum/quantumbrush?tab=readme-ov-file#one-more-thing)
5. [Technical Stack](https://github.com/moth-quantum/quantumbrush?tab=readme-ov-file#technical-stack)

---

# Usage Instruction
This application is tested with MacOS Sequoia (15.5) && Eclipse IDE (2025-03) && Python 3.11+ && OpenJDK 21.0.7 LTS. Technically, the application must support every machines (Windows, Linux and MacOS) with the suitable Java and Python versions. It requires OpenJDK and Python to execute, so they must be previously installed.

However, luckily, the installer provides automatic OpenJDK + Python installation through Miniconda — you usually don’t need to install them yourself. The native installers and `setup.sh` create a dedicated Python environment at `~/.quantumbrush/env` and store all necessary libraries there. On Windows, [Git for Windows](https://git-scm.com/download/win) is required so setup can run. More of this is described under [Installation Instructions](https://github.com/moth-quantum/quantumbrush?tab=readme-ov-file#installation-instructions).

Quantum Brush is basically a graphics software powered by quantum-computing-imagination. There’s nothing which makes user experience difficult. The program has three windows. Treat them equally well.

0. Import any Image! This is the guidance which are free images.
   - [Free art website](https://www.nga.gov/artworks/free-images-and-open-access)
   - [Art canvas image 1](https://unsplash.com/photos/a-white-wall-with-some-white-paint-on-it-YS0YJLU_h2k)
   - [Art canvas image 2](https://unsplash.com/photos/white-wall-paint-with-black-line-R53t-Tg6J4c)
   - [Art canvas image 3](https://unsplash.com/photos/white-printer-paper-on-white-surface-HZm2XR0whdw)

1. Canvas

![The image of Canvas](/screenshots/before.png)
   This is the place where your image/canvas is displayed and you interact with it by `mouseClicked` and `mouseDragged`. `mouseClicked` will create a yellow dot. `mouseDragged` will create a red line. Look at the screenshot above.
   Those elements are crucial for quantum algorithms, so treat it nicely.

   ⚠️ CAVEAT: Because of this special requirements, after you work on other windows, you MUST click the title bar of the canvas or it will wrongly leave yellow dots. This might make quantum brush algorithms to misbehave so be careful!

   Now, what will you do if you want to do something with quantum brush algorithms? As a sidekick, there is a control panel. 
   
2. Control panel

![The image of Control Panel](/screenshots/control.png)

 This window is for modifying parameters for quantum brush algorithms. It depends on which brush did you choose. For example, Heisenbrush (Ver.Continuous) here has a radius, lightness, saturation and strength. It also contains tiny descriptions of each brush.
 
 After creating & modifying each brush stroke, we must group those paths and level them up to a system called 'stroke'. When you press 'Create', the program will say you can open up Stroke Manager to run the quantum algorithms. It depends on your choice. You can make bunch of strokes BEFORE you run them on quantum simulations/hardware (in the near future) OR you can directly open up the manager window and run the algorithms. This program is designed to not interfere with creative workflow.
 
 Have you decided to move along to Stroke Manager?

3. Stroke Manager

	Open up Stroke Manager from *Tools* on the menu bar.

![The image of Stroke Manager](/screenshots/manager.png)

 Here, you can see the list of ’strokes’ that you created. You can change the timeline of them, for example, run the recent stroke on the simulator than the old one.
 
 When you click 'Run', Python process will run in the background. You can close the window and come back to actually apply the processed result on the divided section. If the result is satisfactory, press the 'Apply to Canvas' button.

# Installation Instructions

These instructions are for artists and creatives who want the easiest install path.

## Recommended: native installers

Download the latest release [here](https://github.com/moth-quantum/QuantumBrush/releases/latest). Each tagged release ships native packages for all platforms (`.dmg`, `.exe`, `.deb`, `.iso`) plus fallback shell installers.

| Platform | File | What to do |
|----------|------|------------|
| macOS Apple Silicon | `QuantumBrush-*-macos-apple-silicon.dmg` | Open the `.dmg`, drag QuantumBrush to Applications, launch it |
| macOS Intel | `QuantumBrush-*-macos-intel.dmg` | Open the `.dmg`, drag QuantumBrush to Applications, launch it |
| Windows | `QuantumBrush-*-windows-x64.exe` | Run the installer, then launch from Start Menu |
| Ubuntu / Debian | `QuantumBrush-*-linux-amd64.deb` | Install the `.deb`, then launch from applications menu |
| Ubuntu ISO option | `QuantumBrush-*-ubuntu-amd64.iso` | Mount the ISO, open Terminal in the mounted folder, run `./install-quantumbrush.sh` |

On first launch, QuantumBrush automatically configures Java and Python for you.

- **macOS / Linux (`.dmg` or `.deb`):** no terminal required — launch from Applications or the app menu.
- **Windows (`.exe`):** install [Git for Windows](https://git-scm.com/download/win) first. First launch runs setup through Git Bash in the background; allow any setup prompts.
- **Ubuntu ISO:** requires Terminal once to run `install-quantumbrush.sh`.

**macOS security:** release builds are signed and notarized when Apple Developer credentials are configured in CI. Unsigned builds may trigger Gatekeeper. Use an official signed release from the Releases page — do not bypass security with `xattr` or similar tools.

## Fallback: shell installer

If a native package is unavailable for your machine:

1. Download `QuantumBrush-Installer.sh` (macOS/Linux) or `QuantumBrush-Installer.bat` (Windows) from [Releases](https://github.com/moth-quantum/QuantumBrush/releases/latest).
2. macOS/Linux: open Terminal and run `bash ~/Downloads/QuantumBrush-Installer.sh`
3. Windows: install [Git for Windows](https://git-scm.com/download/win) if needed, then double-click `QuantumBrush-Installer.bat`
4. When prompted, press Enter or `y` to run setup and install Java/Python automatically.
5. Open Terminal (or Git Bash on Windows), go to the install folder, and launch:
   ```bash
   cd ~/QuantumBrush
   ./RunQuantumBrush.sh        # macOS / Linux
   ./RunQuantumBrush.command   # macOS (double-click also works)
   RunQuantumBrush.bat         # Windows
   ```

## Update an existing install

1. Open a terminal in your `QuantumBrush` folder (`~/QuantumBrush` by default).
2. Run `bash ~/QuantumBrush/update.sh` on macOS/Linux, or `bash update.sh` on Windows with Git Bash.
3. Launch again with `RunQuantumBrush.sh` / `RunQuantumBrush.bat`.

## Hackathon / verification

If you are submitting a demo video, follow [packaging/INSTALL_VERIFICATION.md](packaging/INSTALL_VERIFICATION.md).

# Examples

The combination of the stroke and the quantum brush that we choose, the result is this!

![Example of Quantum Brush](/screenshots/after.png)
c.f. Image credit: [Pavilion by the Lake](https://www.metmuseum.org/art/collection/search/40429)
	You can see the tech-savvy details on our paper and understand deeply about quantum-powered creativity!
    
- Our paper is on Arxiv now! Check it out [here](https://arxiv.org/abs/2509.01442).

# One more thing...

Users can create their own quantum brush and contribute to this open-source project! The dummy brush looks like this (Have a look at the `template` folder underneath `effect`, too.:

```
QuantumBrush
	|_ effect
			|_ {brushName}
						|_ {brushName}.py
						|_ {brushName}.json
						|_ __init__.py
```

Any users who have brilliant idea regarding visual effects using quantum mechanics can fork this repository, include their own brush and raise a pull request. After the review, we will add your work with credit in the `dist` branch.

The current nature of quantum computing requires lot of dependencies. If it needs to be manually installed, look at the line __*318*__ of `setup.sh`. You will notice there's an automatic block of script to install dependencies with `conda run -n quantumbrush pip install`. Don't forget to add yours here so that your work won't crash. Recommended workflow is **A)** Sketch your idea, **B)** Think about which technical stack is needed and **C)** Fork the repository, modify the `setup.sh` or jump right into development.

You can see all debugging results if you open up the `View Live Debug Log` underneath Tools in the Control Panel window.

1. `__init__.py` is just an empty file for existance.
2. `{brushName}.py` is a brush algorithm file. Make your `run(...)` function to be linked to the `effects/apply_effect.py` in the future.
3. `{brushName}_requirements.json` is a file contains initialised parameters for the brush. This is the example from `template.json`. It contains the default values for each parameter, data type of each and other metadata which is your name or a description. `id` is extra important because this will be used to communicate between each script.

   ``` json
   {
    "name": "Super cool effect",
    "id": "id_without_spaces", # Set this well so that it could be called from other scripts.
    "author": "creator", # Your name
    "version": "1.0.0",
    "description": "Small description of the effect.",
    "dependencies": {
        "numpy": ">=2.1.0"
    },
    "user_input": {
        "Radius": {
            "type": "int",
            "min": 0,
            "max": 100,
            "default": 20 
        },
        "Strength": {
            "type": "float",
            "min": 0.0,
            "max": 1.0,
            "default": 1.0
        },
        "Color": {
            "type": "color",
            "default": "#FF0000"
        }
    },
    "stroke_input": {
        "image_rgba": "array",
        "path": "array",
        "clicks": "array"
    },
    "flags": {
        "smooth_path": true
    }
   ```

While development, check `apply_effect.py` underneath the `effect` folder so that you can have a glimpse of how backend communicates. Happy quantum!

# Technical Stack

- Format: Standalone Processing (Java) application for multiple OS
- Supported:
  
      ```
      (base) astrydpark@Astryds-MacBook-Pro ~ % java -version
          openjdk version "21.0.7" 2025-04-15 LTS
          OpenJDK Runtime Environment Temurin-21.0.7+6 (build 21.0.7+6-LTS)
          OpenJDK 64-Bit Server VM Temurin-21.0.7+6 (build 21.0.7+6-LTS, mixed mode, sharing)
      ```

- Works on Python 3.11+ (Automatic background: dedicated Miniconda environment at `~/.quantumbrush/env`)

Project location: `$HOME/QuantumBrush`

Used IDE version: Eclipse 2025-03

# License

Copyright [2025] [Moth]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
