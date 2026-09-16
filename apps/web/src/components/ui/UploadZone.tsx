"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, Image as ImageIcon, X } from "lucide-react";
import { UploadAdapter, CloudinaryUploadAdapter } from "@/lib/upload/adapters";

interface UploadedFile {
  name: string;
  url: string;
  size: number;
}

interface UploadZoneProps {
  onUploadComplete?: (urls: string[]) => void;
  maxFiles?: number;
  maxSizeMb?: number;
  accept?: string;
  adapter?: UploadAdapter;
}

export function UploadZone({
  onUploadComplete,
  maxFiles = 5,
  maxSizeMb = 10,
  accept = "*",
  adapter = new CloudinaryUploadAdapter(),
}: UploadZoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (selectedFiles: FileList) => {
    const validFiles: File[] = [];
    const sizeLimit = maxSizeMb * 1024 * 1024;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.size > sizeLimit) {
        alert(`File ${file.name} exceeds the ${maxSizeMb}MB size limit.`);
        continue;
      }
      validFiles.push(file);
    }

    if (files.length + validFiles.length > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files.`);
      return;
    }

    const uploadedList: UploadedFile[] = [...files];

    for (const file of validFiles) {
      setProgress((prev) => ({ ...prev, [file.name]: 0 }));
      try {
        const result = await adapter.uploadFile(file, (percent) => {
          setProgress((prev) => ({ ...prev, [file.name]: percent }));
        });

        uploadedList.push({
          name: file.name,
          url: result.url,
          size: file.size,
        });
        setFiles([...uploadedList]);
      } catch (err) {
        console.error("Upload error", err);
      }
    }

    if (onUploadComplete) {
      onUploadComplete(uploadedList.map((f) => f.url));
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const onDragLeave = () => {
    setIsDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    if (onUploadComplete) {
      onUploadComplete(updated.map((f) => f.url));
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-foreground"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple={maxFiles > 1}
          accept={accept}
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
        <div className="p-3 bg-secondary rounded-full">
          <Upload className="w-6 h-6 text-foreground" />
        </div>
        <div>
          <p className="font-medium">Drag & drop files here, or click to browse</p>
          <p className="text-tiny text-muted-foreground mt-1">
            Max size {maxSizeMb}MB • Up to {maxFiles} files
          </p>
        </div>
      </div>

      {/* Upload lists and progressions */}
      {files.length > 0 && (
        <div className="border border-border rounded-xl p-4 space-y-3 bg-card">
          <p className="text-sm font-semibold">Uploaded Files</p>
          <div className="divide-y divide-border">
            {files.map((file, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {file.name.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                    <ImageIcon className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-tiny text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {progress[file.name] !== undefined && progress[file.name] < 100 && (
                    <span className="text-xs font-semibold text-primary">
                      {progress[file.name]}%
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
