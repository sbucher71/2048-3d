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

## PWA / Mobile App
- PWA: Added `manifest.webmanifest` and `sw.js`. When hosted over HTTPS (or localhost), you can “Install” the app on mobile/desktop.
- Icons: Add `icons/icon-192.png` and `icons/icon-512.png` for install prompts.

## Native build (Capacitor quickstart)
1. Initialize Node project (one-time):
	- npm init -y
	- npm install @capacitor/core @capacitor/cli
2. Init Capacitor:
	- npx cap init 2048-3d com.example.a2048
	  - Web assets dir: .
3. Add platforms:
	- npm install @capacitor/android @capacitor/ios
	- npx cap add android
	- npx cap add ios
4. Copy web assets:
	- npx cap copy
5. Open IDEs:
	- npx cap open android
	- npx cap open ios
6. Build/sign via Android Studio / Xcode.

Note: three.js runs on WebView with WebGL. Enable hardware acceleration on Android if needed.
