"use client";

import { useRef, useState } from "react";
import { imageFileToBase64 } from "@/lib/openai";

interface Props {
  onPhoto: (base64: string, previewUrl: string) => void;
}

export default function PhotoUploader({ onPhoto }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    setLoading(true);
    try {
      const base64 = await imageFileToBase64(file);
      const url = URL.createObjectURL(file);
      setPreview(url);
      onPhoto(base64, url);
    } catch (e) {
      console.error("Photo processing error:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-zinc-700 rounded-2xl p-8 text-center cursor-pointer hover:border-purple-600 transition-colors group"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Delivery"
            className="max-h-48 mx-auto rounded-xl object-cover"
          />
        ) : (
          <div className="space-y-2">
            <div className="text-4xl">📸</div>
            <p className="text-zinc-400 group-hover:text-white transition-colors">
              {loading ? "Processing..." : "Tap to take photo or drag & drop"}
            </p>
            <p className="text-xs text-zinc-600">Photo of package at doorstep</p>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />

      {preview && (
        <button
          onClick={() => {
            setPreview(null);
            if (fileRef.current) fileRef.current.value = "";
          }}
          className="text-xs text-zinc-500 hover:text-white underline"
        >
          Retake photo
        </button>
      )}
    </div>
  );
}
