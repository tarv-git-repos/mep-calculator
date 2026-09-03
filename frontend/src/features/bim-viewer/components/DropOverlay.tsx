import React, { useState, useRef } from 'react';
import { useViewerStore } from '../store/viewer-store';

export function DropOverlay() {
  const { isLoaded, isLoading, loadingText } = useViewerStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasLoadedModel = isLoaded || Boolean((window as any)._currentLoadedFile);
  if (hasLoadedModel && !isDragOver) return null;

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
      className={`absolute inset-0 flex flex-col items-center justify-center z-20 m-[20px] rounded-[12px] transition-all duration-300 cursor-pointer pointer-events-auto select-none ${
        isDragOver 
          ? 'border-[#4da6ff] bg-[rgba(36,36,38,0.96)] shadow-xl scale-[0.99]' 
          : 'border-[#555] bg-[rgba(36,36,38,0.9)] hover:border-[#888] hover:bg-[rgba(36,36,38,0.94)]'
      }`}
      style={{ borderStyle: 'dashed', borderWidth: '2px' }}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        accept=".ifc" 
        onChange={handleFileChange} 
        className="hidden" 
      />
      <span className="loader" style={{ display: isLoading ? 'inline-block' : 'none' }}></span>
      <h2 className="text-[24px] font-semibold text-center px-4 text-white mb-2">{loadingText}</h2>
      {!isLoading && (
        <p className="text-[14px] text-[#aaa] font-medium transition-colors hover:text-white">
          📁 Click anywhere to select an .ifc file or drop it here
        </p>
      )}
    </div>
  );
}
