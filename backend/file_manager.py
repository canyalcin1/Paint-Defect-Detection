# backend/file_manager.py
import os
import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any

import cv2
import numpy as np


# ---- Ortak klasörler (kullanıcıya yazılabilir) ----
BASE_DIR       = Path(os.getenv("LOCALAPPDATA", Path.home())) / "PaintDefectAnalyzer"
UPLOADS_DIR    = BASE_DIR / "uploads"
RESULTS_DIR    = BASE_DIR / "results"
DOWNLOADS_DIR  = BASE_DIR / "downloads"
TEMP_DIR       = BASE_DIR / "temp"

for d in [UPLOADS_DIR, RESULTS_DIR, DOWNLOADS_DIR, TEMP_DIR]:
    d.mkdir(parents=True, exist_ok=True)


class FileManager:
    def __init__(self):
        # instance referansları
        self.base_dir      = BASE_DIR
        self.uploads_dir   = UPLOADS_DIR
        self.results_dir   = RESULTS_DIR
        self.downloads_dir = DOWNLOADS_DIR
        self.temp_dir      = TEMP_DIR

    # ---------------- Upload / Convert ----------------

    async def save_uploaded_file(self, content: bytes, filename: str) -> Dict[str, Any]:
        """Uploads klasörüne güvenli isimle kaydet."""
        try:
            safe_name = Path(filename).name
            p = self.uploads_dir / safe_name
            with open(p, "wb") as f:
                f.write(content)
            return {"success": True, "filename": safe_name, "path": str(p)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def convert_to_jpg_resized(
        self,
        src_path: str,
        dst_dir: Optional[str] = None,
        long_side: int = 640,
        quality: int = 95,
    ) -> Dict[str, Any]:
        """
        TIFF/PNG vs. dosyayı okumaya çalışır, uzun kenarı long_side olacak şekilde
        yeniden boyutlandırır ve JPG olarak kaydeder.
        """
        try:
            src_path = str(src_path)

            with open(src_path, "rb") as f:
                file_bytes = f.read()

            img = cv2.imdecode(np.frombuffer(file_bytes, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                return {"success": False, "error": "decode failed"}

            h, w = img.shape[:2]
            if w >= h:
                new_w = int(long_side)
                new_h = int(h * (long_side / max(w, 1)))
            else:
                new_h = int(long_side)
                new_w = int(w * (long_side / max(h, 1)))

            img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

            dst_dir_p = Path(dst_dir) if dst_dir else self.temp_dir
            dst_dir_p.mkdir(exist_ok=True, parents=True)

            stem = Path(src_path).stem
            out_path = dst_dir_p / f"{stem}.jpg"

            cv2.imwrite(str(out_path), img_resized, [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)])
            return {"success": True, "path": str(out_path)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ---------------- History / Details ----------------

    async def list_history(self, query: Optional[str] = None) -> Dict[str, Any]:
        groups = []
        items: List[Dict[str, Any]] = []

        q = (query or "").strip().lower()
        if not self.results_dir.exists():
            return {"groups": [], "items": []}

        for group in sorted([d for d in self.results_dir.iterdir() if d.is_dir()]):
            group_slug = group.name
            runs = []

            for run in sorted([d for d in group.iterdir() if d.is_dir()]):
                run_id = run.name

                meta: Dict[str, Any] = {}
                meta_file = run / "run.json"
                if meta_file.exists():
                    try:
                        meta = json.loads(meta_file.read_text(encoding="utf-8"))
                    except Exception:
                        meta = {}

                total_images = len(list(run.glob("processed_*.jpg")))
                preview = None
                for p in run.glob("processed_*.jpg"):
                    preview = f"results/{group_slug}/{run_id}/{p.name}"
                    break

                record = {
                    "group_slug": group_slug,
                    "group_name": meta.get("group_name", group_slug),
                    "run_id": run_id,
                    "created_at": meta.get("created_at", datetime.fromtimestamp(run.stat().st_mtime).isoformat()),
                    "total_images": meta.get("summary", {}).get("total_images", total_images),
                    "total_detections": meta.get("summary", {}).get("total_detections", 0),
                    "preview": preview,
                }

                hay = f"{record['group_slug']} {record['group_name']} {record['run_id']}".lower()
                if (not q) or (q in hay):
                    runs.append(record)
                    items.append(record)

            if runs:
                groups.append({"group_slug": group_slug, "group_name": runs[0]["group_name"], "runs": runs})

        return {"groups": groups, "items": items}

    async def get_run_details(self, group_slug: str, run_id: str) -> Optional[Dict[str, Any]]:
        run_dir = self.results_dir / group_slug / run_id
        if not run_dir.exists():
            return None

        images = [f"results/{group_slug}/{run_id}/{p.name}" for p in sorted(run_dir.glob("processed_*.jpg"))]

        meta: Dict[str, Any] = {}
        meta_file = run_dir / "run.json"
        if meta_file.exists():
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
            except Exception:
                meta = {}

        return {
            "group_slug": group_slug,
            "group_name": meta.get("group_name", group_slug),
            "run_id": run_id,
            "created_at": meta.get("created_at"),
            "images": images,
            "summary": meta.get("summary", {"total_images": len(images), "total_detections": 0}),
        }

    async def delete_run(self, group_slug: str, run_id: str) -> bool:
        run_dir = self.results_dir / group_slug / run_id
        if not run_dir.exists():
            return False

        shutil.rmtree(run_dir, ignore_errors=True)

        group_dir = self.results_dir / group_slug
        try:
            if group_dir.exists() and not any(group_dir.iterdir()):
                shutil.rmtree(group_dir, ignore_errors=True)
        except Exception:
            pass

        return True

    async def zip_run(self, group_slug: str, run_id: str) -> Dict[str, Any]:
        run_dir = self.results_dir / group_slug / run_id
        if not run_dir.exists():
            return {"success": False, "error": "run not found"}

        package_name = f"{group_slug}__{run_id}"
        pkg_dir = self.downloads_dir / package_name
        if pkg_dir.exists():
            shutil.rmtree(pkg_dir, ignore_errors=True)

        (pkg_dir / "processed_images").mkdir(parents=True, exist_ok=True)

        copied = 0
        for p in run_dir.glob("processed_*.jpg"):
            shutil.copy2(p, pkg_dir / "processed_images" / p.name)
            copied += 1

        zip_path = self.downloads_dir / f"{package_name}.zip"
        await self._create_zip_file(pkg_dir, zip_path)

        return {"success": True, "files": copied, "download_url": f"/download/{package_name}.zip"}

    async def rename_group(self, old_slug: str, new_slug: str, new_name_display: Optional[str] = None) -> bool:
        src = self.results_dir / old_slug
        dst = self.results_dir / new_slug
        if not src.exists() or dst.exists():
            return False

        src.rename(dst)

        for run in dst.iterdir():
            meta_file = run / "run.json"
            if meta_file.exists():
                try:
                    meta = json.loads(meta_file.read_text(encoding="utf-8"))
                    meta["group_name"] = new_name_display or new_slug
                    meta["group_slug"] = new_slug
                    meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
                except Exception:
                    pass

        return True

    async def rename_run(self, group_slug: str, run_id: str, new_run_id: str) -> bool:
        src = self.results_dir / group_slug / run_id
        dst = self.results_dir / group_slug / new_run_id
        if not src.exists() or dst.exists():
            return False

        src.rename(dst)

        meta_file = dst / "run.json"
        if meta_file.exists():
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                meta["run_id"] = new_run_id
                meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception:
                pass

        return True

    # ---------------- Paketleme ----------------

    async def create_package_for_results(
        self,
        package_name: str,
        processed_paths: List[str],
        report_files: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        processed_paths: "results/<group>/<run_id>/processed_*.jpg" gibi relative yollar.
        Bunları gerçek dosya yoluna çevirip kopyalar.
        """
        try:
            base = self.downloads_dir / package_name
            if base.exists():
                shutil.rmtree(base, ignore_errors=True)
            (base / "processed_images").mkdir(parents=True, exist_ok=True)
            (base / "reports").mkdir(parents=True, exist_ok=True)

            copied = 0
            for rel in processed_paths:
                rel_path = Path(rel)
                if rel_path.is_absolute():
                    abs_src = rel_path
                else:
                    # "results/..." öneki varsa AppData/results ile eşle
                    parts = rel_path.parts
                    if len(parts) >= 2 and parts[0] == "results":
                        abs_src = self.results_dir / Path(*parts[1:])
                    else:
                        abs_src = self.base_dir / rel_path  # emniyetli fallback

                if abs_src.exists():
                    shutil.copy2(abs_src, base / "processed_images" / abs_src.name)
                    copied += 1

            if report_files:
                for f in report_files:
                    fp = Path(f)
                    if not fp.is_absolute():
                        fp = self.base_dir / fp
                    if fp.exists():
                        shutil.copy2(fp, base / "reports" / fp.name)

            zip_path = self.downloads_dir / f"{package_name}.zip"
            await self._create_zip_file(base, zip_path)

            return {"success": True, "download_url": f"/download/{package_name}.zip", "files": copied}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _create_zip_file(self, folder: Path, zip_path: Path):
        if zip_path.exists():
            zip_path.unlink()
        shutil.make_archive(str(zip_path.with_suffix("")), "zip", root_dir=str(folder))
