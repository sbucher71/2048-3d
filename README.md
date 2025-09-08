# 2048 3D (Three.js)

A small, self-contained 3D take on 2048 using Three.js with smooth tweens and a glassy HUD.

How to run (no server needed):
- Open `index.html` in your browser (double-click). If your browser restricts file URLs for localStorage, use a simple local server.

Optional local server (PowerShell):
```
# Python 3
python -m http.server 8080
# then browse to http://localhost:8080/TestApp/
```

Controls:
- Arrow keys or WASD to move.
- Touch: swipe in any direction.
- New Game to reset.

Notes:
- Best score stored in localStorage under key `best2048-3d`.
- Uses three.js (0.160) and tween.js (UMD) from CDN.
