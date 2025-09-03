# backend/main.py  (TOP OF FILE)
import os, re, logging
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import Body
import json
from fastapi.responses import JSONResponse

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

from model_handler import YOLOModelHandler
from image_processor import ImageProcessor
from report_generator import ReportGenerator
from file_manager import FileManager
from fastapi import HTTPException


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Paint Defect Analysis API", version="2.0.0")

# --- CORS ---
frontend = os.environ.get("CLIENT_ORIGIN", "*")
allow_all = frontend == "*" or frontend.lower() == "all"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else [frontend],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- paths & dirs ---
BASE_DIR       = Path(os.getenv("LOCALAPPDATA", Path.home())) / "PaintDefectAnalyzer"
UPLOADS_DIR    = BASE_DIR / "uploads"
RESULTS_DIR    = BASE_DIR / "results"
DOWNLOADS_DIR  = BASE_DIR / "downloads"
TEMP_DIR       = BASE_DIR / "temp"
MODELS_DIR     = Path(__file__).parent / "models"

for d in [UPLOADS_DIR, RESULTS_DIR, DOWNLOADS_DIR, TEMP_DIR]:
    d.mkdir(parents=True, exist_ok=True)

app.mount("/static/results",   StaticFiles(directory=str(RESULTS_DIR)),   name="static_results")
app.mount("/static/uploads",   StaticFiles(directory=str(UPLOADS_DIR)),   name="static_uploads")
app.mount("/static/downloads", StaticFiles(directory=str(DOWNLOADS_DIR)), name="static_downloads")
app.mount("/downloads",        StaticFiles(directory=str(DOWNLOADS_DIR)), name="downloads")

model_handler    = YOLOModelHandler(input_size=640)
image_processor  = ImageProcessor()
report_generator = ReportGenerator()
file_manager     = FileManager()

def slugify(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r"[^\w\s-]", "", name, flags=re.UNICODE)
    name = re.sub(r"[\s_-]+", "-", name, flags=re.UNICODE)
    return name.strip("-") or "run"

@app.get("/health")
def health():
    return {"ok": True}

# TO delete images from "uploads" folder 
@app.delete("/delete-upload/{filename}")
async def delete_upload(filename: str):
    """
    Delete a file from the uploads directory by filename.
    """
    file_path = os.path.join(UPLOADS_DIR, filename)

    # security: prevent path traversal
    if not os.path.abspath(file_path).startswith(os.path.abspath(UPLOADS_DIR)):
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        os.remove(file_path)
        return JSONResponse({"message": f"{filename} deleted"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete: {e}")
    
    
    # to delete multiple history runs
@app.delete("/history/delete-multiple")
async def delete_multiple_history(items: list[dict] = Body(...)):
    """
    Delete multiple history runs. 
    Each item must include {group_slug, run_id}.
    """
    deleted = []
    errors = []

    for item in items:
        group_slug = item.get("group_slug")
        run_id = item.get("run_id")
        if not group_slug or not run_id:
            errors.append(item)
            continue

        # Doğru: RESULTS_DIR kullan
        folder_path = RESULTS_DIR / group_slug / run_id

        if not folder_path.exists():
            errors.append(item)
            continue

        try:
            import shutil
            shutil.rmtree(folder_path)
            deleted.append(item)
        except Exception as e:
            errors.append({"item": item, "error": str(e)})

    return {"deleted": deleted, "errors": errors}

#downloads selected uploads as zip
@app.post("/uploads/zip")
async def zip_uploads(files: list[str] = Body(...)):
    """
    Zip selected files from the uploads folder and return a download URL.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files selected")

    zip_name = f"uploads_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    zip_path = DOWNLOADS_DIR / zip_name

    try:
        import zipfile
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for fname in files:
                fpath = UPLOADS_DIR / fname
                if fpath.exists():
                    zf.write(fpath, arcname=fname)

        return {"download_url": f"/downloads/{zip_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    
    
@app.post("/upload-images")
async def upload_images(files: List[UploadFile] = File(...)):
    uploaded_files, failed_files = [], []
    for f in files:
        content = await f.read()
        result = await file_manager.save_uploaded_file(content, f.filename)
        if result["success"]:
            uploaded_files.append({"filename": result["filename"], "path": result["path"]})
            logger.info(f"Successfully uploaded: {result['filename']}")
        else:
            failed_files.append({"filename": f.filename, "error": result.get("error", "Unknown")})
    return {
        "message": "Upload completed",
        "uploaded_files": uploaded_files,
        "failed_files": failed_files,
        "summary": {"total": len(files), "successful": len(uploaded_files), "failed": len(failed_files)},
    }

@app.post("/analyze")
async def analyze_images(
    model_name: str   = Form("best.pt"),
    confidence: float = Form(0.25),
    filenames: str    = Form(...),  # JSON string list (uploaded file names)
    run_group: str    = Form(...),  # kullanıcıdan alınan klasör adı (grup)
    iou: float        = Form(0.5),
    max_det: int      = Form(300),
    min_box_area: int = Form(50),
    resize_long_side: int = Form(640),
    jpg_quality: int  = Form(95),
):
    """
    Yeni kayıt yapısı:
    results/<group-slug>/<run_id>/processed_*.jpg
    temp/* dosyaları analiz sonrası silinir.
    """
    try:
        # 👇 burada daha toleranslı parse edelim
        if filenames.startswith("[") and filenames.endswith("]"):
            try:
                file_list = json.loads(filenames)
                file_list = [fn.strip('"').strip("'") for fn in file_list]

            except Exception:
                # fallback: virgül ayrılmışsa split et
                file_list = [x.strip() for x in filenames.strip("[]").split(",")]
        else:
            # tek dosya adı geldiyse listeye çevir
            file_list = [filenames]

        if not run_group or not run_group.strip():
            raise HTTPException(status_code=400, detail="run_group (Klasör adı) zorunlu.")

        logger.info(f"Received file list: {file_list}")
        group_slug = slugify(run_group)
        run_id     = datetime.now().strftime("%Y%m%d_%H%M%S")

        # sonuç klasörü AppData altında
        run_dir = RESULTS_DIR / group_slug / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        # Model hazır değilse yükle
        model_path = MODELS_DIR / model_name
        if (not model_handler.is_model_loaded()) or (model_handler.current_model != model_name):
            if not model_path.exists():
                raise HTTPException(status_code=404, detail=f"Model not found: {model_name}")
            ok = await model_handler.load_model(str(model_path))
            if not ok:
                raise HTTPException(status_code=500, detail=f"Model load failed: {model_name}")

        results_out: List[Dict[str, Any]] = []
        total_dets = 0

        for fn in file_list:
            src_path = UPLOADS_DIR / fn
            if not src_path.exists():
                logger.warning(f"File not found: {src_path}")
                continue

            # 1) TIFF->JPG + resize -> temp
            conv = await file_manager.convert_to_jpg_resized(
                str(src_path),
                dst_dir=str(TEMP_DIR),
                long_side=int(resize_long_side),
                quality=int(jpg_quality),
            )
            if not conv.get("success", False):
                logger.error(f"Convert failed: {fn} -> {conv.get('error')}")
               
                continue

            pred_input = conv["path"]  # TEMP_DIR/...jpg

            # 2) YOLO inference
            dets = await model_handler.predict(
                pred_input,
                confidence_threshold=float(confidence),
                iou=float(iou),
                max_det=int(max_det),
                min_box_area=int(min_box_area),
            )

            # 3) processed kaydet: RESULTS_DIR/<group>/<run_id>/processed_<name>.jpg
            processed_filename = "processed_" + Path(pred_input).name
            processed_path_fs  = run_dir / processed_filename
            await image_processor.draw_detections(pred_input, dets, str(processed_path_fs))

            total_dets += len(dets)

            # frontend'in image src'si: `${API}/static/${processed_path}`
            processed_rel_for_static = str(Path("results") / group_slug / run_id / processed_filename)

            results_out.append({
                "id": f"result_{len(results_out)}",
                "filename": Path(pred_input).name,     # görüntülenen isim
                "original_path": str(src_path),        # bilgi amaçlı
                "processed_path": processed_rel_for_static,
                "detections": dets,
                "detection_count": len(dets),
            })

            # 4) temizlik: temp + uploads
            try:
                Path(pred_input).unlink(missing_ok=True)
              #  src_path.unlink(missing_ok=True)
            except Exception as e:
                logger.warning(f"Cleanup warning: {e}")

        # Özet ve metadata
        class_counts: Dict[str, int] = {"Krater": 0, "Tanecik": 0, "Pinhol": 0}
        for r in results_out:
            for d in r["detections"]:
                class_counts[d["class_name"]] = class_counts.get(d["class_name"], 0) + 1

        run_meta = {
            "group_name": run_group,
            "group_slug": group_slug,
            "run_id": run_id,
            "created_at": datetime.now().isoformat(),
            "params": {"model_name": model_name, "confidence": confidence, "iou": iou, "max_det": max_det},
            "summary": {
                "total_images": len(results_out),
                "total_detections": total_dets,
                "class_counts": class_counts,
            },
            "items": [
                {
                    "processed_path": r["processed_path"],
                    "filename": r["filename"],
                    "detection_count": r["detection_count"],
                }
                for r in results_out
            ],
        }
        with open(run_dir / "run.json", "w", encoding="utf-8") as f:
            json.dump(run_meta, f, ensure_ascii=False, indent=2)

        return {
            "message": "Analysis completed successfully",
            "results": results_out,
            "summary": run_meta["summary"],
            "run": {"group_slug": group_slug, "group_name": run_group, "run_id": run_id},
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Analyze error")
        raise HTTPException(status_code=500, detail=str(e))

# --- geçmiş / history API'leri ---

@app.get("/history")
async def history_list(q: Optional[str] = Query(None, description="Arama (grup veya run_id)")):
    return await file_manager.list_history(query=q)

@app.get("/history/{group_slug}/{run_id}")
async def history_details(group_slug: str, run_id: str):
    data = await file_manager.get_run_details(group_slug, run_id)
    if not data:
        raise HTTPException(status_code=404, detail="Run not found")
    return data

@app.post("/history/{group_slug}/{run_id}/zip")
async def history_zip(group_slug: str, run_id: str):
    z = await file_manager.zip_run(group_slug, run_id)
    if not z["success"]:
        raise HTTPException(status_code=500, detail=z.get("error", "zip failed"))
    return {"download_url": z["download_url"]}

@app.delete("/history/{group_slug}/{run_id}")
async def history_delete(group_slug: str, run_id: str):
    ok = await file_manager.delete_run(group_slug, run_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Run not found or cannot delete")
    return {"success": True}

@app.post("/history/rename-group")
async def history_rename_group(old_group_slug: str = Form(...), new_group_name: str = Form(...)):
    new_slug = slugify(new_group_name)
    ok = await file_manager.rename_group(old_group_slug, new_slug, new_group_name)
    if not ok:
        raise HTTPException(status_code=404, detail="Group not found or cannot rename")
    return {"success": True, "group_slug": new_slug, "group_name": new_group_name}

@app.post("/history/{group_slug}/{run_id}/rename")
async def history_rename_run(group_slug: str, run_id: str, new_run_id: str = Form(...)):
    new_run_id = re.sub(r"[^\w\-]", "_", new_run_id).strip("_") or datetime.now().strftime("%Y%m%d_%H%M%S")
    ok = await file_manager.rename_run(group_slug, run_id, new_run_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Run not found or cannot rename")
    return {"success": True, "run_id": new_run_id}

@app.get("/uploads")
def list_uploads():
    try:
        files = []
        for p in sorted(UPLOADS_DIR.iterdir()):
            if p.is_file():
                st = p.stat()
                files.append({
                    "name": p.name,
                    "size": st.st_size,            # bytes
                    "mtime": int(st.st_mtime),     # unix seconds
                    "url": f"/static/uploads/{p.name}",
                })
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# (İstersen halen rapor üret + paketle için bu endpointi de koruyalım)
@app.post("/download-results")
async def download_results(folder_name: Optional[str] = Form(None),
                           results_json: Optional[str] = Form(None)):
    try:
        results_data = None
        if results_json:
            try:
                parsed = json.loads(results_json)
                results_data = parsed.get("results", parsed) if isinstance(parsed, dict) else parsed
            except Exception as e:
                logger.warning(f"results_json parse edilemedi: {e}")

        # Rapor üretimini AppData downloads altına yaz
        report_info = await report_generator.generate_reports(
            results_data=results_data,
            base_name=folder_name or "Analiz_Sonuclari",
            out_root=str(DOWNLOADS_DIR)
        )
        excel_path = report_info["excel_path"]
        json_path  = report_info["json_path"]

        # processed dosyaları results_data içindeki processed_path'lerden toparla
        processed_paths = [r.get("processed_path") for r in (results_data or []) if r.get("processed_path")]

        package = await file_manager.create_package_for_results(
            package_name=(folder_name or "Analiz_Sonuclari"),
            processed_paths=processed_paths,
            report_files=[excel_path, json_path]
        )
        if not package["success"]:
            raise RuntimeError(package.get("error", "package failed"))

        return {
            "message": "Download package created",
            "download_path": package.get("download_url"),
            "package_info": package,
            "reports": report_info
        }

    except Exception as e:
        logger.error(f"Error creating download package: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating download package: {e}")

@app.get("/download/{filename}")
async def download_file(filename: str):
    file_path = DOWNLOADS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file_path, filename=filename, media_type="application/zip")

@app.get("/models")
async def list_models():
    models = []
    # MODELS_DIR altında *.pt dosyaları
    for p in MODELS_DIR.glob("*.pt"):
        try:
            models.append({
                "name": p.name,
                "path": str(p),
                "size": p.stat().st_size,
                "type": "PyTorch",
            })
        except Exception:
            continue
    return {"models": models}


from pathlib import Path
from fastapi.staticfiles import StaticFiles

FRONTEND_DIR = Path(__file__).parent / "frontend_out"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    # Burada artık string "main:app" kullanma
    # direkt app nesnesini ver
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)