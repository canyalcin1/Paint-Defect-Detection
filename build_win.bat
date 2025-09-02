@echo off
echo =====================================
echo 🚀 PaintDefectAnalyzer Build Basladi
echo =====================================

REM Sanal ortamı aktive et
call .venv\Scripts\activate

REM Eski build klasörlerini sil
rmdir /s /q build dist
del PaintDefectAnalyzer.spec 2>nul

REM PyInstaller ile build al
pyinstaller --noconfirm --onedir --name "PaintDefectAnalyzer" ^
  --collect-all ultralytics ^
  --collect-submodules cv2 ^
  --collect-submodules torch ^
  --add-data "backend\model_handler.py:." ^
  --add-data "backend\image_processor.py:." ^
  --add-data "backend\report_generator.py:." ^
  --add-data "backend\file_manager.py:." ^
  --add-data "backend\models:models" ^
  --add-data "backend\frontend_out:frontend_out" ^
  --paths backend ^
  backend\main.py

echo =====================================
echo ✅ Build Tamamlandi
echo =====================================

REM EXE’yi çalıştır
start dist\PaintDefectAnalyzer\PaintDefectAnalyzer.exe

REM Tarayıcıyı aç
start http://127.0.0.1:8000

pause
