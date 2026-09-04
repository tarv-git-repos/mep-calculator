import React, { useState, useRef } from 'react';
import { useViewerStore } from '../store/viewer-store';
import { Loader2 } from 'lucide-react';

export function DropOverlay() {
  const { isLoaded, isLoading, loadingText } = useViewerStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isLoaded && !isLoading && !isDragOver) return null;

  const handleClick = () => {
    if (!isLoading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (window as any).loadIfcFile) {
      (window as any).loadIfcFile(file);
    }
    // Reset value so selecting the same file again still fires change event
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (window as any).loadIfcFile) {
      (window as any).loadIfcFile(file);
    }
  };

  return (
    <div 
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`absolute inset-0 flex flex-col items-center justify-center z-20 transition-all duration-200 select-none ${
        isLoading
          ? 'bg-[#18181b]/80 backdrop-blur-xs pointer-events-auto'
          : isDragOver
          ? 'm-[20px] rounded-[12px] border-[#4da6ff] bg-[rgba(36,36,38,0.96)] shadow-xl scale-[0.99] border-dashed border-2 cursor-pointer pointer-events-auto'
          : 'm-[20px] rounded-[12px] border-[#555] bg-[rgba(36,36,38,0.9)] hover:border-[#888] hover:bg-[rgba(36,36,38,0.94)] border-dashed border-2 cursor-pointer pointer-events-auto'
      }`}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        accept=".ifc" 
        onChange={handleFileChange} 
        className="hidden" 
      />
      {isLoading ? (
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-200 pointer-events-auto">
          <Loader2 className="size-10 text-sky-400 animate-spin" />
          <h2 className="text-[16px] font-medium tracking-tight text-slate-100 text-center px-4">
            {loadingText || "Loading your 3D model..."}
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (typeof (window as any)._cancelIfcProcessing === 'function') {
                (window as any)._cancelIfcProcessing();
              }
              useViewerStore.getState().setIsLoading(false);
              useViewerStore.getState().setLoadingText('');
            }}
            className="mt-2 text-xs px-3.5 py-1.5 bg-rose-700/80 hover:bg-rose-600 active:bg-rose-800 text-white rounded border border-rose-500/80 shadow-md transition cursor-pointer font-medium"
          >
            Cancel Loading
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-[22px] font-semibold text-center px-4 text-white mb-2">{loadingText || "Drag & Drop .ifc file here"}</h2>
          <p className="text-[13px] text-[#aaa] font-medium transition-colors hover:text-white">
            📁 Click anywhere to select an .ifc file or drop it here
          </p>
        </>
      )}
    </div>
  );
}
