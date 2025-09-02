# Paint Defect Analyzer

A YOLO-based paint defect analysis app with a **web UI** for R&D labs. The frontend (Next.js) is exported statically and served by a FastAPI backend. For end users, you can ship a **single-folder package** that requires **no Python or Node.js** (Windows: `.exe`, macOS: native binary).

---

## Features

- 🔬 **YOLO model support:** PyTorch `.pt` models (e.g., `CTP_Predict.pt`)
- 📸 **Batch analysis:** analyze multiple images at once
- 🧠 **TIFF → JPEG** conversion & resizing
- 🖼️ **Processed image output:** bounding boxes + labels
- 🗂️ **History / housekeeping:** list, rename, zip, delete past runs
- 📊 **Reporting:** Excel (`.xlsx`) and JSON; download results as ZIP
- ⚙️ **Parameters:** confidence, IoU, `max_det`, quality, etc.
- 🌐 **Static frontend serving:** `backend/frontend_out` is served at the `/` root

---

## Tech Stack

- **Backend:** Python, FastAPI, Uvicorn, Ultralytics YOLO, OpenCV, Pillow, Pandas, ReportLab, ONNX Runtime  
- **Frontend:** Next.js (App Router), React, Tailwind CSS, Heroicons  
- **Packaging:** PyInstaller (`onedir`)

---

## Project Structure

```
├── app/                         # Next.js frontend (source)
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── backend/                     # Python backend
│   ├── main.py                  # FastAPI entry
│   ├── model_handler.py         # YOLO model mgmt
│   ├── image_processor.py       # drawing / processing
│   ├── report_generator.py      # report export
│   ├── file_manager.py          # upload/zip/cleanup
│   ├── models/                  # .pt models
│   └── requirements.txt
├── components/                  # React components
├── public/                      # Static assets (optional)
├── package.json                 # Frontend scripts
└── dist/                        # PyInstaller output (production)
```

---

## Quickstart (Developer Machine)

> The steps below are for development. For the end-user package, see **Production Packaging**.

### 1) Python backend (venv)

**Windows (CMD):**
```bat
cd Paint-Defect-Detection-by-YOLO

python -m venv .venv
.\.venv\Scripts\activate

python -m pip install -U pip wheel
pip install -r backend\requirements.txt
```

**macOS / Linux (zsh/bash):**
```bash
cd Paint-Defect-Detection-by-YOLO

python3 -m venv .venv
source .venv/bin/activate

python3 -m pip install -U pip wheel
pip install -r backend/requirements.txt
```

### 2) Frontend build → static export

**Option A — via script**
```bash
npm install
npm run build:front
```
> `build:front` should run `next build` + `next export` and place output in `backend/frontend_out/`.

**Option B — manual**
```bash
npm install
npx next build
npx next export -o backend/frontend_out
```

After this, `backend/frontend_out/` must contain `index.html` and `_next/`.

### 3) Place your model
Copy your trained `.pt` model into `backend/models/` (e.g., `CTP_Predict.pt`).  
You can name the default model `best.pt` if desired.

---

## Run (Development)

**Start backend:**
```bash
cd backend
# Windows: python; macOS/Linux: python3 (either works if your venv resolves it)
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

- UI: `http://127.0.0.1:8000`  
- Health: `GET /health` → `{ "ok": true }`  
- Models: `GET /models`

> **Important (entry guard in `backend/main.py`):**
> ```py
> if __name__ == "__main__":
>     import uvicorn
>     uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
> ```
> For PyInstaller packaging, use `uvicorn.run(app, ...)` (pass the object), **not** `uvicorn.run("main:app", ...)`.

---

## Usage

1. Upload images (TIFF/JPG/PNG/BMP).
2. Select model from `backend/models/`.
3. Adjust parameters (confidence, IoU, `max_det`, quality…).
4. Start analysis.
5. Review processed images and detection summary.
6. Download ZIP (report + processed images).
7. Browse history: open, rename, zip, or delete run folders.

---

## Production Packaging (Single-Folder Package)

Goal: ship a **no-Python / no-Node** single folder to end users.

### Windows (PyInstaller, `onedir`)

```bat
.\.venv\Scripts\activate

pyinstaller --noconfirm --onedir --name "PaintDefectAnalyzer" ^
  --collect-all ultralytics ^
  --collect-submodules cv2 ^
  --collect-submodules torch ^
  --add-data "backend\model_handler.py;." ^
  --add-data "backend\image_processor.py;." ^
  --add-data "backend\report_generator.py;." ^
  --add-data "backend\file_manager.py;." ^
  --add-data "backend\models;models" ^
  --add-data "backend\frontend_out;frontend_out" ^
  --paths backend ^
  backend\main.py
```

**Output (Windows):** `dist\PaintDefectAnalyzer\`
```
PaintDefectAnalyzer.exe
_internal\
model_handler.py
image_processor.py
report_generator.py
file_manager.py
models\
frontend_out\
```

**End-user launcher (Windows):** create `run_app.bat`:
```bat
@echo off
echo =====================================
echo 🚀 Starting Paint Defect Analyzer...
echo =====================================

start PaintDefectAnalyzer.exe
timeout /t 3 /nobreak >nul

start http://127.0.0.1:8000
echo ✅ App opened!
pause
```

> **Note on `--add-data` separator:**  
> - **Windows:** use `source;dest` (semicolon)  
> - **macOS/Linux:** use `source:dest` (colon)

---

### macOS (PyInstaller, `onedir`)

```bash
# inside the venv
pip install pyinstaller

pyinstaller --noconfirm --onedir --name "PaintDefectAnalyzer" \
  --collect-all ultralytics \
  --collect-submodules cv2 \
  --collect-submodules torch \
  --add-data "backend/model_handler.py:." \
  --add-data "backend/image_processor.py:." \
  --add-data "backend/report_generator.py:." \
  --add-data "backend/file_manager.py:." \
  --add-data "backend/models:models" \
  --add-data "backend/frontend_out:frontend_out" \
  --paths backend \
  backend/main.py
```

**Output (macOS):** `dist/PaintDefectAnalyzer/`
```
PaintDefectAnalyzer        # native binary (no .exe)
_internal/
model_handler.py
image_processor.py
report_generator.py
file_manager.py
models/
frontend_out/
```

**End-user launcher (macOS):** create `run_app.command` in the same folder:
```bash
#!/bin/bash
echo "====================================="
echo "🚀 Starting Paint Defect Analyzer..."
echo "====================================="

cd "$(dirname "$0")"
./PaintDefectAnalyzer &

sleep 3
open "http://127.0.0.1:8000"

echo "✅ App opened!"
```

Make it executable:
```bash
cd dist/PaintDefectAnalyzer
chmod +x PaintDefectAnalyzer run_app.command
```

**Gatekeeper / quarantine (if needed):**
```bash
xattr -dr com.apple.quarantine "dist/PaintDefectAnalyzer"
```
Or allow via **System Settings → Privacy & Security → Open Anyway**.

**Distribution:** Zip the `dist/PaintDefectAnalyzer/` folder and share. Users double-click `run_app.command`.

---

## Runtime Folders

At runtime, the app persists working files under a platform-appropriate user data dir, e.g.:

- **Windows:** `%LOCALAPPDATA%\PaintDefectAnalyzer`
- **macOS:** `~/Library/Application Support/PaintDefectAnalyzer`

Typical subfolders:
```
uploads/
results/
downloads/
temp/
```

---

## Troubleshooting

- **`/health` or `/models` return 404**  
  Ensure `app.mount("/", StaticFiles(...))` is declared **after** all API routes.

- **`/analyze` 400/422**  
  Ensure the frontend sends a non-empty `run_group`. The `filenames` field should be a JSON string list; backend should robustly parse and trim quotes.

- **PyInstaller EXE error “Could not import module 'main'”**  
  Use `uvicorn.run(app, ...)` with the **object**, not the string `"main:app"`.

- **Missing `models/` or `frontend_out/` in `dist`**  
  Check your `--add-data` separators (`;` on Windows, `:` on macOS/Linux).

- **Port 8000 already in use**  
  Stop other uvicorn/packaged instances, or change the port (`--port 8080`) and update the launcher URL.

- **Antivirus / SmartScreen warning (Windows)**  
  This can happen on first run; allow/whitelist if internal distribution.

- **macOS “cannot be opened because it is from an unidentified developer”**  
  Use the quarantine command above or “Open Anyway”.

---

## License

Add your license here (e.g., MIT).
