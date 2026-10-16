import React, { useState } from 'react';
import { useViewerStore } from '../store/viewer-store';

export function DropOverlay() {
  const { isLoaded, isLoading, loadingText } = useViewerStore();
  const [isDragOver, setIsDragOver] = useState(false);

  if (isLoaded && !isLoading) return null;

  return (
    <div 
      className={`absolute inset-0 flex flex-col items-center justify-center z-20 m-[20px] rounded-[12px] transition-colors duration-300 pointer-events-none ${
        isDragOver ? 'border-[#4da6ff] bg-[rgba(36,36,38,0.95)]' : 'border-[#555] bg-[rgba(36,36,38,0.9)]'
      }`}
      style={{ borderStyle: 'dashed', borderWidth: '2px' }}
    >
      <span className="loader" style={{ display: isLoading ? 'inline-block' : 'none' }}></span>
      <h2 className="text-[24px] font-semibold">{loadingText}</h2>
    </div>
  );
}
