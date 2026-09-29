# ST1 Web Port — Real Scene Data Reconstruction

This project was rebuilt from the **supplied Slendytubbies 32-bit Windows build** rather than from a generic placeholder map.

## What was actually extracted

The supplied game files report **Unity 3.5.5f2**. The `level0`–`level9` serialized scene files were parsed to recover object names and Transform data.

The browser project uses recovered coordinates for objects such as:

- `Paper`
- `treemain1`, `treemain2`, `treemain3`
- `Teletubby house`
- `Spawn`
- `undead`
- `Tinky 1`

The paper locations are therefore taken from the actual supplied level scenes rather than invented positions.

## What this is

This is a **data-driven web reconstruction** of ST1. It is not the original Windows executable running inside the browser.

The browser game currently recreates the first-person loop using recovered scene placement:

- 3D first-person camera
- WASD movement
- mouse look
- sprint + stamina
- flashlight
- paper collection
- level selector
- trees, house, terrain and enemy placeholders positioned from the recovered scene data
- GitHub Pages deployment

## Why it isn't a literal EXE-to-WebGL conversion

The supplied build is a compiled Unity 3.5.5f2 Windows player. The original Unity Editor project is not included. A standalone Windows executable is not a WebGL build input.

The original proprietary executable, DLLs, textures, models and sounds are not bundled into this repository.

## Run

Open `index.html` through a web server. GitHub Pages can host it directly.

For local testing:

```text
py -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages

Set the repository's Pages source to **GitHub Actions** and use the included workflow.

## Next stage for a closer port

A closer visual match would require importing the original Unity models, textures, audio and terrain data into a browser-compatible renderer. The current project deliberately keeps those original assets out of the public repository.
