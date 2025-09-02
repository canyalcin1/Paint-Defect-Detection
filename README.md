# Boya Kusurları Analiz Sistemi

YOLO tabanlı boya kusurları analiz uygulaması. R&D laboratuvarları için geliştirilmiş web arayüzlü bir çözümdür. Frontend (Next.js) statik olarak derlenir ve FastAPI backend tarafından servis edilir. Son kullanıcı için Python/Node gerektirmeyen **tek klasör EXE** paketi oluşturulabilir.

---

## Özellikler

- 🔬 **YOLO Model Desteği**: PyTorch `.pt` model dosyaları (örn. `CTP_Predict.pt`)
- 📸 **Batch Analiz**: Birden fazla görüntüyü aynı anda analiz
- 🧠 **TIFF → JPEG** dönüştürme ve yeniden boyutlandırma
- 🖼️ **İşlenmiş Görsel** üretimi (bounding box + etiket)
- 🗂️ **Arşiv/Geri Dönüş**: Geçmiş listeleme, yeniden adlandırma, zip’leme, silme
- 📊 **Detaylı Raporlama**: Excel (`.xlsx`) ve JSON; sonuçları ZIP olarak indirme
- ⚙️ **Parametre Ayarları**: confidence, iou, max_det, kalite vb.
- 🌐 **Statik Frontend Servisi**: `backend/frontend_out` içeriği kök `/` üzerinden servis edilir

---

## Hızlı Kurulum

> Aşağıdaki adımlar **geliştirici** makinesi içindir. Son kullanıcıya verilecek EXE için ayrıca “Üretim Paketleme (EXE)” bölümüne bakınız.

### 1) Python Backend Kurulumu (venv)

```bat
cd Paint-Defect-Detection-by-YOLO

python -m venv .venv
.\.venv\Scripts\activate

python -m pip install -U pip wheel
pip install -r backend\requirements.txt
```

### 2) Frontend Kurulumu ve Build

**Seçenek A — script üzerinden**
```bat
npm install
npm run build:front
```
> `npm run build:front` komutu `next build` + `next export` işlemlerini yapıp çıktıyı `backend/frontend_out/` altına koymalıdır.

**Seçenek B — manuel**
```bat
npm install
npx next build
npx next export -o backend/frontend_out
```
> İşlem sonunda `backend/frontend_out/` içinde `index.html` ve `_next/` klasörü görünmelidir.

### 3) Model Yerleştirme
- Eğitilmiş `.pt` modelinizi `backend/models/` klasörüne kopyalayın (örn. `CTP_Predict.pt`).
- Arayüzden model seçilebilir; isterseniz varsayılan adı `best.pt` yapabilirsiniz.

---

## Çalıştırma (Geliştirme)

### 1) Backend Servisi
```bat
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
Arayüz: `http://127.0.0.1:8000`  
Sağlık kontrolü: `GET /health` → `{ "ok": true }`  
Modeller: `GET /models`

> **Önemli:** `backend/main.py` dosyasının sonunda aşağıdaki guard bulunmalıdır:
> ```py
> if __name__ == "__main__":
>     import uvicorn
>     uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
> ```
> PyInstaller ile paketlemede `uvicorn.run("main:app", ...)` **değil**, doğrudan `uvicorn.run(app, ...)` kullanılmalıdır.

### 2) Frontend (Geliştirme Modu — Opsiyonel)
İsterseniz Next.js’i dev modda da çalıştırabilirsiniz:
```bat
npm run dev
```
> Üretimde frontend statik servis edildiği için dev sunucusuna gerek yoktur.

---

## Kullanım

1. **Fotoğraf Yükleme**: TIFF/JPG/PNG vb. dosyaları yükleyin (sürükle-bırak veya seçim).
2. **Model Seçimi**: `backend/models/` içindeki `.pt` dosyalarından birini seçin.
3. **Parametreler**: confidence, iou, max_det, kalite vb. ayarları isteğe göre düzenleyin.
4. **Tespit Başlat**: Analizi başlatın.
5. **Sonuçlar**: İşlenmiş görseller ve tespit özetlerini görüntüleyin.
6. **İndir**: ZIP (rapor + işlenmiş görseller) olarak indirin.
7. **Geçmiş**: Run klasörlerini arayın, görüntüleyin, zip’leyin, yeniden adlandırın veya silin.

---

## Teknik Detaylar

### Teknoloji Yığını
- **Backend**: Python, FastAPI, Uvicorn, Ultralytics YOLO, OpenCV, Pillow, Pandas, ReportLab, ONNXRuntime
- **Frontend**: Next.js (App Router), React, Tailwind CSS, Heroicons
- **Paketleme**: PyInstaller (Windows, onedir)

### Desteklenen Formatlar
- **Görüntü**: TIFF, JPG/JPEG, PNG, BMP
- **Model**: `.pt` (PyTorch)
- **Rapor**: `.xlsx` (Excel) ve `.json`

### Çalışma Dizinleri (Runtime)
Uygulama çalışma zamanlı dosyaları **%LOCALAPPDATA%\PaintDefectAnalyzer** altında tutar:
- `uploads/`, `results/`, `downloads/`, `temp/`

---

## Üretim Paketleme (EXE) — PyInstaller

> Amaç: Python/Node gerektirmeyen, tek klasör çalıştırılabilir paket üretmek.

**Önkoşul:** `backend/main.py` sonunda guard mevcut olmalı (bkz. yukarı).

```bat
.\.venv\Scripts\activate

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
```

> **Dikkat:** Windows’ta `--add-data` için ayırıcı **`:`** olmalıdır (Linux/macOS da `:` kullanır). `;` kullanırsanız dosyalar kopyalanmaz.

**Çıktı:** `dist\PaintDefectAnalyzer\`  
İçerik örneği:
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

### Son Kullanıcı İçin Çalıştırma Script’i

Aynı klasöre bir **`run_app.bat`** ekleyin:

```bat
@echo off
echo =====================================
echo 🚀 Paint Defect Analyzer Baslatiliyor...
echo =====================================

start PaintDefectAnalyzer.exe
timeout /t 3 /nobreak >nul

start http://127.0.0.1:8000
echo ✅ Uygulama acildi!
pause
```

> Dağıtım: `dist\PaintDefectAnalyzer\` klasörünü ZIP’leyin, kullanıcıya verin. Kullanıcı `run_app.bat`’e çift tıklar.

---

## Sorun Giderme

- **`/health` veya `/models` 404**  
  `app.mount("/", StaticFiles(...))` satırı **tüm API route’larından sonra** olmalıdır.

- **`/analyze` 400/422**  
  Frontend formunda **grup adı (run_group)** boş olmasın. `filenames` alanı JSON string listesi olarak gider; backend’de toleranslı parse + tırnak temizleme uygulanır.

- **EXE’de “Could not import module 'main'”**  
  Guard kısmında `uvicorn.run(app, ...)` kullanılmalıdır (string `"main:app"` **kullanmayın**).

- **`dist` içinde `models/` veya `frontend_out/` yok**  
  `--add-data` ayırıcıları doğru yazılmış mı kontrol edin (`:`).

- **`npm ci` EUSAGE / lock uyumsuzluğu**  
  `npm install` çalıştırarak lock dosyasını senkronlayın, sonra build alın.

- **Port çakışması (8000)**  
  Başka bir uvicorn/EXE çalışıyorsa kapatın veya portu değiştirin (`--port 8080`), `run_app.bat` URL’ini güncelleyin.

- **Antivirüs/SmartScreen**  
  İç dağıtımlarda EXE ilk çalıştırmada uyarı verebilir; “izin ver” gerekebilir.

---

## Proje Yapısı

```
├── app/                       # Next.js frontend (kaynak)
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── backend/                   # Python backend
│   ├── main.py                # FastAPI entry
│   ├── model_handler.py       # YOLO model yönetimi
│   ├── image_processor.py     # Görüntü çizim/işleme
│   ├── report_generator.py    # Rapor üretimi
│   ├── file_manager.py        # Upload/zip/temizlik vb.
│   ├── models/                # .pt modeller
│   └── requirements.txt       # Python bağımlılıkları
├── components/                # React bileşenleri
├── public/                    # Statik dosyalar (varsa)
├── package.json               # Frontend scriptleri
└── dist/                      # PyInstaller çıktısı (üretim)
```

---

## Lisans

Lisans bilgisini buraya ekleyin (örn. MIT).

