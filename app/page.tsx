"use client";

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpDialog } from "@/components/HelpDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UploadsDialog } from "@/components/UploadsDialog";

import {
  ArrowUpTrayIcon as Upload,
  ArrowDownTrayIcon as Download,
  EyeIcon as Eye,
  PhotoIcon as FileImage,
  BoltIcon as Zap,
  ExclamationTriangleIcon as AlertCircle,
  CheckCircleIcon as CheckCircle,
  ServerIcon as Server,
  TrashIcon as Trash2,
  FolderIcon as Folder,
  PencilSquareIcon as Pencil,
  MagnifyingGlassIcon as Search,
} from "@heroicons/react/24/outline";

type UploadItem = { name: string; size: number; mtime: number; url: string };

interface DetectionResult {
  id: string;
  filename: string;
  original_path: string;
  processed_path: string;
  detections: Array<{
    class_id: number;
    class_name: string;
    confidence: number;
    bbox: [number, number, number, number];
  }>;
  detection_count: number;
}

interface AnalysisResponse {
  message: string;
  results: DetectionResult[];
  summary: {
    total_images: number;
    total_detections: number;
    class_counts: {
      Krater: number;
      Tanecik: number;
      Pinhol: number;
    };
  };
  run?: {
    group_slug: string;
    group_name: string;
    run_id: string;
  };
}

interface HistoryItem {
  group_slug: string;
  group_name: string;
  run_id: string;
  created_at: string;
  total_images: number;
  total_detections: number;
  preview?: string | null;
}

const API_BASE_URL = "http://127.0.0.1:8000";

export default function PaintDefectAnalyzer() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [confidence, setConfidence] = useState(0.25);
  const [selectedModel, setSelectedModel] = useState("model.pt");
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [analysisResponse, setAnalysisResponse] =
    useState<AnalysisResponse | null>(null);
  const [serverStatus, setServerStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  const [uploadsError, setUploadsError] = useState<string | null>(null);

  // yeni: grup adı & geçmiş
  const [runGroup, setRunGroup] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState<string>("");
  const [selectedHistory, setSelectedHistory] = useState<{
    group_slug: string;
    run_id: string;
  } | null>(null);
  const [selectedHistoryImages, setSelectedHistoryImages] = useState<string[]>(
    []
  );
  const [renameGroupInput, setRenameGroupInput] = useState<string>("");
  const [renameRunInput, setRenameRunInput] = useState<string>("");

  useEffect(() => {
    checkServerHealth();
    loadAvailableModels();
    loadHistory();
    fetchUploads();
  }, []);

  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        setServerStatus("online");
        setError(null);
      } else {
        setServerStatus("offline");
        setError("Backend server is not responding");
      }
    } catch {
      setServerStatus("offline");
      setError(
        "Cannot connect to backend server. Please make sure the Python backend is running."
      );
    }
  };

  const loadAvailableModels = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/models`);
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.models);
        if (data.models.length > 0) {
          setSelectedModel(data.models[0].name);
        }
      }
    } catch (error) {
      console.error("Error loading models:", error);
    }
  };

  const loadHistory = async (q?: string) => {
    try {
      const url =
        q && q.trim()
          ? `${API_BASE_URL}/history?q=${encodeURIComponent(q.trim())}`
          : `${API_BASE_URL}/history`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.items || []);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      setSelectedFiles(files);
      setResults([]);
      setAnalysisResponse(null);
      setError(null);
    },
    []
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    setSelectedFiles(files);
    setResults([]);
    setAnalysisResponse(null);
    setError(null);
  }, []);

  const [selectedHistoryItems, setSelectedHistoryItems] = useState<Set<string>>(
    new Set()
  );

  const toggleHistoryCheckbox = (key: string) => {
    setSelectedHistoryItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllHistory = () => {
    if (selectedHistoryItems.size === history.length) {
      setSelectedHistoryItems(new Set());
    } else {
      setSelectedHistoryItems(
        new Set(history.map((h) => `${h.group_slug}__${h.run_id}`))
      );
    }
  };

  const deleteSelectedHistory = async () => {
    if (selectedHistoryItems.size === 0) return;
    if (!confirm("Seçili klasörleri silmek istediğinize emin misiniz?")) return;

    const items = Array.from(selectedHistoryItems).map((key) => {
      const [group_slug, run_id] = key.split("__");
      return { group_slug, run_id };
    });

    await fetch(`${API_BASE_URL}/history/delete-multiple`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    });

    setSelectedHistoryItems(new Set());
    loadHistory(historySearch);
  };

  const fetchUploads = useCallback(async () => {
    try {
      setUploadsError(null);
      const res = await fetch(`${API_BASE_URL}/uploads`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("uploads fetched:", data.files); // 👀 see what the UI sees
      setUploadedFiles(Array.isArray(data.files) ? data.files : []);
    } catch (e: any) {
      console.error("fetchUploads error:", e);
      setUploadedFiles([]);
      setUploadsError(e?.message ?? "Failed to load uploads");
    }
  }, []);

  const uploadFiles = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return [];
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      const response = await fetch(`${API_BASE_URL}/upload-images`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok)
        throw new Error(`Upload failed: ${response.statusText}`);
      const data = await response.json();
      const filenames: string[] = data.uploaded_files.map(
        (f: any) => f.filename
      );
      await fetchUploads(); // get {name, size, mtime, url} from /uploads
      return filenames;
    } catch (err: any) {
      setError(`File upload failed: ${err}`);
      return [];
    }
  };

  const processImages = async () => {
    if (serverStatus !== "online") {
      setError("Backend server is not available");
      return;
    }
    if (!runGroup.trim()) {
      setError("Lütfen önce 'Klasör adı (grup)' girin.");
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);

    try {
      setProcessingProgress(20);
      const uploaded = await uploadFiles();
      if (uploaded.length === 0) throw new Error("No files uploaded");

      setProcessingProgress(40);

      // ✅ filenames string listesi garanti altına alınıyor
      const onlyNames = uploaded.map((f) => f.toString());

      const formData = new FormData();
      formData.append("model_name", selectedModel);
      formData.append("confidence", confidence.toString());
      formData.append("filenames", JSON.stringify(onlyNames));
      formData.append("run_group", runGroup.trim() || "DefaultGroup");

      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Analysis failed: ${response.status} ${errText}`);
      }

      setProcessingProgress(80);
      const data: AnalysisResponse = await response.json();
      setProcessingProgress(100);
      setResults(data.results);
      setAnalysisResponse(data);

      setTimeout(() => {
        setIsProcessing(false);
        setProcessingProgress(0);
      }, 400);

      // geçmişi tazele
      loadHistory(historySearch);
    } catch (err: any) {
      setError(`Analysis failed: ${err}`);
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // State for help and uploads popups
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isUploadsOpen, setIsUploadsOpen] = useState(false);

  const downloadResults = async () => {
    if (!analysisResponse || results.length === 0) return;
    setIsDownloading(true);
    try {
      // mevcut paketi rapor + processed için /download-results kullanmaya devam
      const formData = new FormData();
      formData.append(
        "folder_name",
        analysisResponse?.run?.group_name || "Analiz_Sonuclari"
      );
      formData.append("results_json", JSON.stringify(results));
      const response = await fetch(`${API_BASE_URL}/download-results`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok)
        throw new Error(`Download preparation failed: ${response.statusText}`);
      const data = await response.json();

      const downloadUrl = `${API_BASE_URL}${
        data.download_path || data.download_url
      }`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download =
        (analysisResponse?.run?.group_name || "Analiz_Sonuclari") + ".zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setError(null);
    } catch (error: any) {
      setError(`Download failed: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Geçmiş UI aksiyonları ---

  const openHistory = async (item: HistoryItem) => {
    setSelectedHistory({ group_slug: item.group_slug, run_id: item.run_id });
    setRenameGroupInput(item.group_name);
    setRenameRunInput(item.run_id);
    try {
      const res = await fetch(
        `${API_BASE_URL}/history/${item.group_slug}/${item.run_id}`
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedHistoryImages(
          (data.images || []).map((p: string) => `${API_BASE_URL}/static/${p}`)
        );
      } else {
        setSelectedHistoryImages([]);
      }
    } catch {
      setSelectedHistoryImages([]);
    }
  };

  const zipHistory = async () => {
    if (!selectedHistory) return;
    const { group_slug, run_id } = selectedHistory;
    const res = await fetch(
      `${API_BASE_URL}/history/${group_slug}/${run_id}/zip`,
      { method: "POST" }
    );
    if (res.ok) {
      const data = await res.json();
      const url = `${API_BASE_URL}${data.download_url}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${group_slug}__${run_id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const deleteHistory = async () => {
    if (!selectedHistory) return;
    const { group_slug, run_id } = selectedHistory;
    if (!confirm("Bu çalışma klasörünü silmek istediğinize emin misiniz?"))
      return;
    const res = await fetch(`${API_BASE_URL}/history/${group_slug}/${run_id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSelectedHistory(null);
      setSelectedHistoryImages([]);
      loadHistory(historySearch);
    }
  };

  const renameGroup = async () => {
    if (!selectedHistory) return;
    const { group_slug } = selectedHistory;
    const fd = new FormData();
    fd.append("old_group_slug", group_slug);
    fd.append("new_group_name", renameGroupInput);
    const res = await fetch(`${API_BASE_URL}/history/rename-group`, {
      method: "POST",
      body: fd,
    });
    if (res.ok) {
      setSelectedHistory(null);
      setSelectedHistoryImages([]);
      loadHistory(historySearch);
    }
  };

  const renameRun = async () => {
    if (!selectedHistory) return;
    const { group_slug, run_id } = selectedHistory;
    const fd = new FormData();
    fd.append("new_run_id", renameRunInput);
    const res = await fetch(
      `${API_BASE_URL}/history/${group_slug}/${run_id}/rename`,
      { method: "POST", body: fd }
    );
    if (res.ok) {
      setSelectedHistory(null);
      setSelectedHistoryImages([]);
      loadHistory(historySearch);
    }
  };

  const totalDetections = analysisResponse?.summary.total_detections || 0;

  return (
    <div className="min-h-screen relative">
      {/* Modern gradient background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-400 via-white to-purple-200" />
      {/* Optional glass overlay for extra modern effect */}
      <div className="fixed inset-0 -z-10 backdrop-blur-lg bg-white/40" />
      <div className="max-w-7xl mx-auto space-y-8 p-8">
        {/* HELP + UPLOADS BUTTONS */}
        <div className="fixed bottom-8 left-8 z-50 flex flex-col gap-3 ml-[-4px]">
          {/* Uploads Button */}
          <div className="relative">
            <button
              onClick={async () => {
                await fetchUploads();
                setIsUploadsOpen(true);
              }}
              className="
                bg-purple-600/80 
                backdrop-blur-md
                border border-purple-300/40
                text-white 
                font-semibold 
                px-6 py-4 
                rounded-full 
                shadow-xl 
                hover:bg-purple-700/90 
                hover:shadow-2xl 
                active:scale-95 
                transition-all 
                duration-200 
                ease-in-out
              "
            >
              Yüklenenler
            </button>

            {/* Popup Panel */}
            {isUploadsOpen}
          </div>

          {/* Help Button */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="
      bg-blue-600/80 
      backdrop-blur-md
      border border-blue-300/40
      text-white 
      font-semibold 
      px-6 py-4 
      rounded-full 
      shadow-xl 
      hover:bg-blue-700/90 
      hover:shadow-2xl 
      active:scale-95 
      transition-all 
      duration-200 
      ease-in-out
    "
          >
            Yardım
          </button>
          <HelpDialog open={isHelpOpen} onOpenChange={setIsHelpOpen} />
          <UploadsDialog
            open={isUploadsOpen}
            onOpenChange={setIsUploadsOpen}
            files={uploadedFiles}
            onRefresh={fetchUploads}
            error={uploadsError}
            apiBaseUrl={API_BASE_URL}
          />
        </div>

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold text-foreground drop-shadow-lg">
            Boya Kusurları Analiz Sistemi
          </h1>
          <p className="text-lg text-muted-foreground">
            YOLO tabanlı kusur tespiti · klasör bazlı arşiv
          </p>

          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              <span className="text-base">
                Backend:
                {serverStatus === "checking" && (
                  <Badge
                    variant="secondary"
                    className="ml-2 rounded-full px-3 py-1"
                  >
                    Kontrol Ediliyor...
                  </Badge>
                )}
                {serverStatus === "online" && (
                  <Badge
                    variant="default"
                    className="ml-2 bg-green-600 rounded-full px-3 py-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Çevrimiçi
                  </Badge>
                )}
                {serverStatus === "offline" && (
                  <Badge
                    variant="destructive"
                    className="ml-2 rounded-full px-3 py-1"
                  >
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Çevrimdışı
                  </Badge>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="rounded-xl shadow-md">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Upload */}
        <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-md border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Fotoğraf Yükleme
            </CardTitle>
            <CardDescription>
              Analiz edilecek fotoğrafları yükleyin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Klasör adı (grup)</Label>
                <Input
                  value={runGroup}
                  onChange={(e) => setRunGroup(e.target.value)}
                  placeholder="Örn: Panel örneği 1"
                />
              </div>
              <div className="space-y-2">
                <Label>Confidence Threshold: {confidence}</Label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={confidence}
                  onChange={(e) =>
                    setConfidence(
                      Math.max(
                        0,
                        Math.min(1, Number.parseFloat(e.target.value) || 0)
                      )
                    )
                  }
                />
              </div>
            </div>

            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <FileImage className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Fotoğrafları buraya sürükleyin veya dosya seçin
              </p>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="max-w-xs mx-auto"
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Seçilen Dosyalar ({selectedFiles.length})</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-card rounded border text-sm"
                    >
                      {file.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label>Model</Label>
                <select
                  className="w-full p-2 border border-border rounded-md bg-background"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={availableModels.length === 0}
                >
                  {availableModels.length === 0 ? (
                    <option value="">Model bulunamadı</option>
                  ) : (
                    availableModels.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name} ({(model.size / 1024 / 1024).toFixed(1)}{" "}
                        MB)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <Button
                onClick={processImages}
                disabled={
                  selectedFiles.length === 0 ||
                  isProcessing ||
                  serverStatus !== "online" ||
                  !runGroup.trim()
                }
                className="w-48"
              >
                <Zap className="h-4 w-4 mr-2" />
                {isProcessing ? "Analiz Ediliyor..." : "Tespit Başlat"}
              </Button>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={processingProgress} className="w-full" />
                <p className="text-sm text-center text-muted-foreground">
                  {processingProgress < 20 && "Başlatılıyor..."}
                  {processingProgress >= 20 &&
                    processingProgress < 40 &&
                    "Fotoğraflar yükleniyor..."}
                  {processingProgress >= 40 &&
                    processingProgress < 80 &&
                    "AI modeli analiz ediyor..."}
                  {processingProgress >= 80 &&
                    processingProgress < 100 &&
                    "Sonuçlar işleniyor..."}
                  {processingProgress >= 100 && "Tamamlandı!"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {analysisResponse && (
          <>
            <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-md border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Analiz Sonuçları
                </CardTitle>
                <CardDescription>
                  {analysisResponse.summary.total_images} fotoğrafta toplam{" "}
                  {totalDetections} kusur tespit edildi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {Object.entries(analysisResponse.summary.class_counts).map(
                    ([className, count]) => (
                      <div
                        key={className}
                        className="text-center p-4 bg-card rounded-lg"
                      >
                        <div className="text-2xl font-bold text-primary">
                          {count}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {className}
                        </div>
                      </div>
                    )
                  )}
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.map((result) => (
                    <Card key={result.id} className="overflow-hidden">
                      <div className="aspect-square bg-muted relative">
                        <img
                          src={`${API_BASE_URL}/static/${result.processed_path}`}
                          alt={result.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <CardContent className="p-3">
                        <p className="font-medium text-sm mb-2">
                          {result.filename}
                        </p>
                        <p className="text-xs text-muted-foreground mb-2">
                          {result.detection_count} kusur tespit edildi
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {result.detections.map((d, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs"
                            >
                              {d.class_name} ({(d.confidence * 100).toFixed(1)}
                              %)
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-md border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Sonuçları İndir
                </CardTitle>
                <CardDescription>
                  Rapor + işlenmiş görseller (ZIP)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={downloadResults}
                  className="w-full"
                  disabled={!analysisResponse || isDownloading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isDownloading ? "İndiriliyor..." : "ZIP Dosyası İndir"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* Geçmiş Tespitler */}
        <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-md border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Geçmiş Tespitler
            </CardTitle>
            <CardDescription>
              Kayıtlı klasörleri arayın, görüntüleyin, indirin, yeniden
              adlandırın veya silin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Arama (grup adı veya run id)"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadHistory(historySearch);
                  }}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => loadHistory(historySearch)}
              >
                Ara
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setHistorySearch("");
                  loadHistory("");
                }}
              >
                Temizle
              </Button>
            </div>
            <div className="flex gap-2 mb-4">
              <Button variant="outline" onClick={selectAllHistory}>
                {selectedHistoryItems.size === history.length
                  ? "Tümünü Kaldır"
                  : "Tümünü Seç"}
              </Button>
              <Button
                variant="destructive"
                onClick={deleteSelectedHistory}
                disabled={selectedHistoryItems.size === 0}
              >
                Seçiliyi Sil
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((h) => {
                const key = `${h.group_slug}__${h.run_id}`;
                const selected = selectedHistoryItems.has(key);

                return (
                  <Card key={key} className="overflow-hidden relative">
                    {/* Checkbox sağ üstte */}
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleHistoryCheckbox(key)}
                      className="absolute top-2 left-2 w-4 h-4 accent-blue-600 cursor-pointer"
                    />

                    {/* Önizleme */}
                    <div className="aspect-video bg-muted">
                      {h.preview ? (
                        <img
                          src={`${API_BASE_URL}/static/${h.preview}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                          Önizleme yok
                        </div>
                      )}
                    </div>

                    {/* İçerik */}
                    <CardContent className="p-3 space-y-2">
                      <div className="font-medium">{h.group_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Run: {h.run_id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString()} ·{" "}
                        {h.total_images} görsel · {h.total_detections} tespit
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => openHistory(h)}>
                          Görüntüle
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            setSelectedHistory({
                              group_slug: h.group_slug,
                              run_id: h.run_id,
                            });
                            await zipHistory();
                          }}
                        >
                          ZIP
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {selectedHistory && (
              <div className="space-y-4 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    Seçili: {selectedHistory.group_slug} /{" "}
                    {selectedHistory.run_id}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={deleteHistory}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Sil
                    </Button>
                    <Button size="sm" onClick={zipHistory}>
                      <Download className="h-4 w-4 mr-1" /> ZIP indir
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  {selectedHistoryImages.map((src, i) => (
                    <div key={i} className="aspect-square bg-muted">
                      <img
                        src={src}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>Grup adını değiştir</Label>
                      <Input
                        value={renameGroupInput}
                        onChange={(e) => setRenameGroupInput(e.target.value)}
                        placeholder="Yeni grup adı"
                      />
                    </div>
                    <Button onClick={renameGroup}>
                      <Pencil className="h-4 w-4 mr-1" /> Değiştir
                    </Button>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>Run klasör adını değiştir</Label>
                      <Input
                        value={renameRunInput}
                        onChange={(e) => setRenameRunInput(e.target.value)}
                        placeholder="YYYYMMDD_HHMMSS veya özel"
                      />
                    </div>
                    <Button onClick={renameRun}>
                      <Pencil className="h-4 w-4 mr-1" /> Değiştir
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
