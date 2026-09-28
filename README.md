# ST1 Web Port

This repository is a **browser-port framework / clean-room prototype** for a Slendytubbies 1-style first-person game.

## What was found in the supplied archive

The supplied `Slendytubbies_32bit_original.zip` is a compiled Windows build. Its `output_log.txt` identifies the game as:

- Unity **3.5.5f2**
- Mono/UnityScript managed assemblies
- Direct3D 9 standalone player

It does **not** contain the original Unity editor project (`Assets/`, `ProjectSettings/`, scene source files, etc.), so the original executable cannot simply be turned into a modern Unity WebGL build.

## What this prototype does

It is a dependency-free HTML5 browser project with:

- first-person mouse look
- WASD movement
- sprint/stamina
- flashlight toggle
- paper collection
- a simple pursuit enemy
- win/pause/restart states
- GitHub Pages deployment workflow

It intentionally does not ship the original game's executable, proprietary DLLs, models, textures, sounds, or source code.

## Run locally

Because browser pointer-lock and some APIs are restricted for `file://` pages, use a local web server.

With Python:

```text
py -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Publish to GitHub Pages

1. Create a GitHub repository, for example `st1-web-port`.
2. Put these files in the repository.
3. Push to `main`.
4. Open **Settings → Pages**.
5. Set the Pages source to **GitHub Actions**.
6. The included workflow deploys the repository.

## Moving from prototype to a true port

The practical route for a faithful port is to obtain the original Unity project/source from the rights holder or creator and open it in an appropriate Unity version, then migrate the gameplay and assets into a current browser-capable project.

If you have an authorized Unity source project, the prototype here can be replaced by that project's actual scenes, scripts, models and audio and then built for WebGL.

## GitHub Pages caveat

GitHub Pages is static hosting, so this setup is appropriate for a client-side web game. It does not provide authoritative multiplayer servers by itself.
