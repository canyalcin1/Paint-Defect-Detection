import os
import cv2
import torch
import numpy as np
from typing import List, Dict, Any
from pathlib import Path
import logging

# Tamamen offline çalışsın
os.environ.setdefault("WANDB_DISABLED", "true")
os.environ.setdefault("YOLO_VERBOSE", "0")
os.environ.setdefault("ULTRALYTICS_HUB", "0")

from ultralytics import YOLO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class YOLOModelHandler:
    """
    Ultralytics YOLO tabanlı handler.
    - .pt 
    syalarını lokalden yükler (internet yok).
    - Preprocess/letterbox/decoding/NMS Ultralytics'te.
    """

    def __init__(self, input_size: int = 640):
        self.model = None
        self.current_model: str | None = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.input_size = int(input_size)
        self.class_names = {0: "Krater", 1: "Tanecik", 2: "Pinhol"}
        logger.info(f"Initialized YOLO handler (Ultralytics) with device: {self.device}")

    def is_model_loaded(self) -> bool:
        return self.model is not None

    def _device_arg(self):
        return 0 if self.device.type == "cuda" else "cpu"

    async def load_model(self, model_path: str) -> bool:
        try:
            model_path = str(model_path)
            logger.info(f"Loading Ultralytics model from: {model_path}")

            if not model_path.lower().endswith(".pt"):
                raise ValueError("Sadece .pt destekleniyor (Ultralytics YOLO).")

            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model bulunamadı: {model_path}")

            self.model = YOLO(model_path)
            try:
                self.model.to(self._device_arg())
            except Exception as e:
                logger.warning(f"Modeli {self.device} cihaza taşıma sırasında uyarı: {e}")

            self.current_model = Path(model_path).name
            logger.info(f"Model loaded successfully: {self.current_model}")
            return True

        except Exception as e:
            logger.error(f"Error loading model: {e}")
            self.model = None
            self.current_model = None
            return False

    async def predict(
        self,
        image_path: str,
        confidence_threshold: float = 0.25,
        iou: float = 0.5,
        max_det: int = 300,
        min_box_area: int = 0,
    ) -> List[Dict[str, Any]]:
        if not self.is_model_loaded():
            raise RuntimeError("No model loaded")

        # Unicode path güvenli okuma
        with open(image_path, "rb") as f:
            file_bytes = np.frombuffer(f.read(), np.uint8)
            image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError(f"Could not load image: {image_path}")

        logger.info(
            f"YOLO predict -> file={Path(image_path).name}, conf={confidence_threshold}, iou={iou}, max_det={max_det}"
        )

        results = self.model.predict(
            source=image,
            imgsz=self.input_size,
            conf=float(confidence_threshold),
            iou=float(iou),
            max_det=int(max_det),
            device=self._device_arg(),
            agnostic_nms=False,
            verbose=False,
        )

        r = results[0]
        dets: List[Dict[str, Any]] = []

        if r.boxes is None or len(r.boxes) == 0:
            return dets

        for b in r.boxes:
            x1, y1, x2, y2 = [int(v) for v in b.xyxy[0].tolist()]
            conf = float(b.conf[0])
            cls = int(b.cls[0])

            if min_box_area > 0 and (x2 - x1) * (y2 - y1) < int(min_box_area):
                continue

            dets.append(
                {
                    "class_id": cls,
                    "class_name": self.class_names.get(cls, f"Class_{cls}"),
                    "confidence": conf,
                    "bbox": [x1, y1, x2, y2],
                }
            )

        return dets

    def get_model_info(self) -> Dict[str, Any]:
        if not self.is_model_loaded():
            return {"loaded": False}
        return {
            "loaded": True,
            "model_name": self.current_model,
            "device": str(self.device),
            "classes": self.class_names,
            "input_size": self.input_size,
        }
