#!/usr/bin/env python3
"""
Startup script for Paint Defect Analysis Backend Server
"""

import os
import sys
import subprocess
import uvicorn
from pathlib import Path

def check_dependencies():
    """Check if all required dependencies are installed"""
    try:
        import fastapi
        import torch
        import cv2
        import pandas
        import numpy
        print("✓ All dependencies are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("Please install dependencies with: pip install -r requirements.txt")
        return False

def setup_directories():
    """Create necessary directories"""
    directories = ["uploads", "results", "models"]
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        print(f"✓ Directory created/verified: {directory}")

def check_model_files():
    """Check if model files exist"""
    models_dir = Path("models")
    model_files = list(models_dir.glob("*.pt")) + list(models_dir.glob("*.onnx"))
    
    if not model_files:
        print("⚠ Warning: No model files found in 'models' directory")
        print("Please place your trained model files (*.pt or *.onnx) in the 'models' directory")
        return False
    else:
        print(f"✓ Found {len(model_files)} model file(s):")
        for model_file in model_files:
            print(f"  - {model_file.name}")
        return True

def main():
    """Main startup function"""
    print("=" * 50)
    print("Paint Defect Analysis Backend Server")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Setup directories
    setup_directories()
    
    # Check model files
    check_model_files()
    
    print("\n" + "=" * 50)
    print("Starting server...")
    print("API will be available at: http://127.0.0.1:8000")
    print("API documentation at: http://127.0.0.1:8000/docs")
    print("Press Ctrl+C to stop the server")
    print("=" * 50 + "\n")
    
    # Start the server
    try:
        uvicorn.run(
            "main:app",
            host="127.0.0.1",
            port=8000,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
