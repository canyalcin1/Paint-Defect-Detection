"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { TrashIcon, CheckSquareIcon, SquareIcon } from "lucide-react";

type UploadItem = { name: string; size: number; mtime: number; url: string };

type UploadsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: UploadItem[];
  onRefresh: () => void;
  error?: string | null;
  apiBaseUrl: string;
};

export function UploadsDialog({
  open,
  onOpenChange,
  files,
  onRefresh,
  error,
  apiBaseUrl,
}: UploadsDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === files.length) {
      setSelected(new Set()); // unselect all
    } else {
      setSelected(new Set(files.map((f) => f.name)));
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm("Seçili dosyaları silmek istediğinize emin misiniz?")) return;

    try {
      for (const name of selected) {
        const res = await fetch(`${apiBaseUrl}/delete-upload/${name}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          console.warn(`Failed to delete ${name}`);
        }
      }
      setSelected(new Set());
      onRefresh();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          bg-gray-900/80 dark:bg-white/10
          backdrop-blur-md
          rounded-lg
          shadow-xl
          border border-gray-700/40 dark:border-white/20
          p-6
          max-w-4xl
          mx-auto
          transition-all
          text-white dark:text-black
          overflow-y-auto max-h-[80vh]
        "
      >
        <DialogHeader>
          <DialogTitle>Uploaded Files</DialogTitle>
          <DialogDescription>
            Select files to delete, or click a file name to view it.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-red-400 mb-3">
            Error loading uploads: {error}
          </p>
        )}

        {files.length === 0 ? (
          <p className="text-sm text-gray-400">No files found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((f) => (
              <div
                key={f.name}
                className={`border rounded-lg p-3 bg-white/10 hover:bg-white/20 transition cursor-pointer ${
                  selected.has(f.name) ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() => toggleSelect(f.name)}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm truncate">{f.name}</span>
                  {selected.has(f.name) ? (
                    <CheckSquareIcon className="h-4 w-4 text-blue-500" />
                  ) : (
                    <SquareIcon className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <a
                  href={`${apiBaseUrl}${f.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs underline text-blue-300 hover:text-blue-400 truncate"
                  onClick={(e) => e.stopPropagation()} // prevent selecting when clicking link
                >
                  Open
                </a>
                <p className="text-xs text-gray-400 mt-1">
                  {(f.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="mt-4 flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={selectAll}>
              {selected.size === files.length ? "Unselect All" : "Select All"}
            </Button>
            <Button
              variant="destructive"
              disabled={selected.size === 0}
              onClick={deleteSelected}
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              Delete Selected
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRefresh}>
              Refresh
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
