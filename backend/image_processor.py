import cv2
import numpy as np
from typing import List, Dict, Any
import asyncio
from pathlib import Path

class ImageProcessor:
    def __init__(self):
        # Define colors for each defect class (BGR format for OpenCV)
        self.class_colors = {
            0: (0, 0, 255),    # Krater - Red
            1: (0, 255, 0),    # Tanecik - Green  
            2: (255, 0, 0),    # Pinhol - Blue
        }
        
        self.class_names = {0: "Krater", 1: "Tanecik", 2: "Pinhol"}
    
    async def draw_detections(
        self, 
        image_path: str, 
        detections: List[Dict[str, Any]], 
        output_path: str
    ) -> str:
        """Draw bounding boxes and labels on image with proper encoding handling"""
        try:
            # Read file as binary and decode with cv2.imdecode to avoid Unicode path issues
            with open(image_path, 'rb') as f:
                file_bytes = np.frombuffer(f.read(), np.uint8)
                image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            
            if image is None:
                raise ValueError(f"Could not load image: {image_path}")
            
            # Create a copy for drawing
            annotated_image = image.copy()
            
            # Draw each detection
            for detection in detections:
                class_id = detection["class_id"]
                class_name = detection["class_name"]
                confidence = detection["confidence"]
                bbox = detection["bbox"]
                
                x1, y1, x2, y2 = bbox
                color = self.class_colors.get(class_id, (128, 128, 128))
                
                # Draw bounding box
                cv2.rectangle(annotated_image, (x1, y1), (x2, y2), color, 2)
                
                # Prepare label text
                label = f"{class_name}: {confidence:.2f}"
                
                # Get text size for background rectangle
                (text_width, text_height), baseline = cv2.getTextSize(
                    label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2
                )
                
                # Draw label background
                cv2.rectangle(
                    annotated_image,
                    (x1, y1 - text_height - baseline - 5),
                    (x1 + text_width, y1),
                    color,
                    -1
                )
                
                # Draw label text
                cv2.putText(
                    annotated_image,
                    label,
                    (x1, y1 - baseline - 2),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    2
                )
            
            # Add summary information
            self._add_summary_info(annotated_image, detections)
            
            # Save annotated image
            output_dir = Path(output_path).parent
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # Encode image to memory buffer first, then write to file
            success, encoded_image = cv2.imencode('.jpg', annotated_image)
            if not success:
                raise RuntimeError(f"Failed to encode image")
            
            with open(output_path, 'wb') as f:
                f.write(encoded_image.tobytes())
            
            return output_path
            
        except Exception as e:
            print(f"Error processing image: {str(e)}")
            raise
        
    def _add_summary_info(self, image: np.ndarray, detections: List[Dict[str, Any]]):
        """Add summary information to the image, including mean confidence per class"""
        height, width = image.shape[:2]

        # Count detections + confidence sum
        class_counts = {name: 0 for name in self.class_names.values()}
        class_conf_sums = {name: 0.0 for name in self.class_names.values()}

        for detection in detections:
            class_name = detection["class_name"]
            confidence = detection["confidence"]
            if class_name in class_counts:
                class_counts[class_name] += 1
                class_conf_sums[class_name] += confidence

        # Prepare summary text
        total_detections = len(detections)
        summary_lines = [f"Toplam Kusur: {total_detections}"]

        for class_name, count in class_counts.items():
            if count > 0:
                mean_conf = class_conf_sums[class_name] / count
                summary_lines.append(f"{class_name}: {count} (Ort: {mean_conf*100:.0f}%)")

        # Draw summary box
        box_height = len(summary_lines) * 25 + 20
        box_width = 250  # biraz genişlettik

        # Position summary box at top-right corner
        box_x = width - box_width - 10
        box_y = 10

        # Draw background rectangle
        cv2.rectangle(
            image,
            (box_x, box_y),
            (box_x + box_width, box_y + box_height),
            (0, 0, 0),
            -1
        )

        # Draw border
        cv2.rectangle(
            image,
            (box_x, box_y),
            (box_x + box_width, box_y + box_height),
            (255, 255, 255),
            2
        )

        # Draw summary text
        for i, line in enumerate(summary_lines):
            text_y = box_y + 25 + (i * 25)
            cv2.putText(
                image,
                line,
                (box_x + 10, text_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )

    async def create_thumbnail(self, image_path: str, output_path: str, size: tuple = (300, 300)) -> str:
        """Create a thumbnail of the image with proper encoding handling"""
        try:
            with open(image_path, 'rb') as f:
                file_bytes = np.frombuffer(f.read(), np.uint8)
                image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            
            if image is None:
                raise ValueError(f"Could not load image: {image_path}")
            
            # Resize image maintaining aspect ratio
            height, width = image.shape[:2]
            target_width, target_height = size
            
            # Calculate scaling factor
            scale = min(target_width / width, target_height / height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            # Resize image
            resized = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
            
            # Create canvas with target size
            canvas = np.zeros((target_height, target_width, 3), dtype=np.uint8)
            
            # Center the resized image on canvas
            y_offset = (target_height - new_height) // 2
            x_offset = (target_width - new_width) // 2
            canvas[y_offset:y_offset + new_height, x_offset:x_offset + new_width] = resized
            
            # Save thumbnail
            output_dir = Path(output_path).parent
            output_dir.mkdir(parents=True, exist_ok=True)
            
            success, encoded_image = cv2.imencode('.jpg', canvas)
            if not success:
                raise RuntimeError(f"Failed to encode thumbnail")
            
            with open(output_path, 'wb') as f:
                f.write(encoded_image.tobytes())
            
            return output_path
            
        except Exception as e:
            print(f"Error creating thumbnail: {str(e)}")
            raise
    
    def get_image_info(self, image_path: str) -> Dict[str, Any]:
        """Get basic information about an image with proper encoding handling"""
        try:
            with open(image_path, 'rb') as f:
                file_bytes = np.frombuffer(f.read(), np.uint8)
                image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            
            if image is None:
                return {"error": "Could not load image"}
            
            height, width, channels = image.shape
            file_size = Path(image_path).stat().st_size
            
            return {
                "width": width,
                "height": height,
                "channels": channels,
                "file_size": file_size,
                "format": Path(image_path).suffix.lower()
            }
            
        except Exception as e:
            return {"error": str(e)}
