import sys, time, threading
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

import webview  # pywebview

PORT = 8765

# PyInstaller ile paketlenince çalışma dizinini doğru çöz
def resource_path(*parts):
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).parent))
    return base.joinpath(*parts)

app = FastAPI()

# --- FRONTEND: Next'in statik çıktısını kökten SERVE et ---
FRONT_DIR = resource_path("out")
if not FRONT_DIR.exists():
    raise RuntimeError(f"Frontend build bulunamadı: {FRONT_DIR}")

# _next, assets vs. otomatik servis edilsin
app.mount("/_next", StaticFiles(directory=str(FRONT_DIR / "_next")), name="_next")
# kökü mount et (index.html dahil)
app.mount("/",
          StaticFiles(directory=str(FRONT_DIR), html=True),
          name="root")

# SPA fallback (yanlış route'larda index'e dön)
@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    candidate = FRONT_DIR / full_path
    if candidate.is_file():
        return FileResponse(str(candidate))
    index_html = FRONT_DIR / "index.html"
    return HTMLResponse(index_html.read_text(encoding="utf-8"))

# --- BACKEND: burada kendi API'lerini ekle ---
# Eğer halihazırda FastAPI app'in varsa, onu "include_router" ile bağla.
# örn:
# from backend.api import router as api_router
# app.include_router(api_router, prefix="/api")

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")

if __name__ == "__main__":
    t = threading.Thread(target=run_server, daemon=True)
    t.start()

    # basit sağlık kontrolü
    for _ in range(50):
        time.sleep(0.1)

    webview.create_window(
        "Paint Defect Analyzer",
        f"http://127.0.0.1:{PORT}/",
        width=1280, height=800,
        resizable=True
    )
    webview.start()  # Pencere kapanınca process biter
