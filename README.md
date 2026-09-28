# NP Certificate Verifier — Clique & Vertex Cover (Android APK)

The web verifier (`index.html`) packaged as an Android app with **Capacitor**.
The APK is built automatically on **GitHub Actions** — no Android SDK needed on your machine.
App icon and splash screen are generated from `logo.png`.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Download landing page (first thing visitors see) |
| `app.html` | The verifier app itself — bundled into the APK, EXE, and browser PWA |
| `logo.png` | App icon / splash artwork source |
| `manifest.webmanifest`, `sw.js` | PWA install + offline support for the browser version |
| `capacitor.config.json` | App id `com.cliquevertex.verifier`, name **NP Certificate Verifier** |
| `package.json` | Web wrapper tooling (Capacitor 8 + sharp) |
| `res/` | Pre-generated Android icons, splash, and theme resources |
| `desktop/` | Electron wrapper that produces the Windows `.exe` |
| `scripts/prepare-web.mjs` | Copies `app.html` → `www/` for Capacitor |
| `scripts/generate-icons.mjs` | Regenerates `res/` from `logo.png` (`npm run icons`) |
| `.github/workflows/build-apk.yml` | Builds the Android APK on every push |
| `.github/workflows/build-desktop.yml` | Builds the Windows EXE on every push |

## One app, three ways to run it

| Device | How | Works offline |
| --- | --- | --- |
| Android phone/tablet | Download the `.apk`, install (allow unknown sources) | Yes |
| Windows 10/11 desktop | Download the `.exe`, double-click it — no install | Yes |
| Any browser (desktop or mobile) | Tap **Run it on the web** on the landing page — no download, works on Linux &amp; Mac too. Installable as a PWA from the browser menu. | Yes, after one visit |

Live web app: <https://pranavcm24032.github.io/clique-vertex_Verfier/app.html>

## How to get the APK (one-time setup)

1. Make sure this repo is on GitHub (origin is already set).
2. Run `git add -A && git commit` and `git push`.
3. On GitHub, open the **Actions** tab → the **Build Android APK** workflow runs
   automatically on every push.
4. When it finishes (green checkmark), the same APK is available two ways:
   - **From the app's website:** open `index.html` in a browser and tap the
     **Download the Android app (.apk)** button — it links straight to the newest
     build.
   - **From GitHub:** open **Releases** → *NP Certificate Verifier — Android APK*
     → `NP-Certificate-Verifier.apk`, or the **Actions** run → **Artifacts**.
5. Copy the APK to your phone, tap it, and allow "install from unknown sources".

You can also re-run the build anytime from the Actions tab via
**Run workflow ▸ (workflow_dispatch)** — the release download link always points
to the newest build.

## Offline

The app is fully offline. `index.html` is self-contained (no external fonts,
scripts, or network calls) and is bundled inside the APK at build time. After
installation no internet connection is needed, ever.

> Update note: each Actions build is signed with a fresh debug key, so installing a
> new build over an old one requires uninstalling the previous version first.
> Rebuilding without installing works fine.

## Rebuilding after editing `index.html` or `logo.png`

- Change `index.html`: just push — CI copies it into the app automatically.
- Change `logo.png`: push, but CI uses the pre-generated `res/`.
  Regenerate first, then commit:
  ```
  npm install
  npm run icons
  git add res/ && git commit
  ```
  For a sharper icon use a 1024×1024+ `logo.png`.

## Building locally (optional, needs Java + Android SDK)

```
npm install
npm run sync          # prepare web + add/sync android platform
npx cap sync android  # refreshes native project after changes
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

## Notes

- Package id: `com.cliquevertex.verifier` | App name: **NP Certificate Verifier**
- minSdk 24 (Android 7+), target/compile SDK 36 (Capacitor 8 defaults)
- The debug APK is signed with the standard debug keystore — fine for personal use,
  not for Play Store release.