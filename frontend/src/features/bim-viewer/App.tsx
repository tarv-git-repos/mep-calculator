import React, { useState, useEffect, useRef } from 'react';
import './tauri-bridge';
import { Viewport3D } from './components/Viewport3D';
import { Sidebar } from './components/Sidebar';
import { BimScheduleReviewModal } from './components/BimScheduleReviewModal';
import { extractSpacesFromIFCFile, extractSpacesFromActiveViewer, type Extracted3DSpace } from '@/lib/bimViewerSpaceExtractor';
import { toast } from 'sonner';

export default function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingSpaces, setPendingSpaces] = useState<Extracted3DSpace[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFullscreenToggle = () => {
    const container = document.getElementById('bim-viewer-container');
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => console.warn("Fullscreen request failed:", err));
    } else {
      document.exitFullscreen().catch((err) => console.warn("Exit fullscreen failed:", err));
    }
  };

  const processIfcFile = async (file: File) => {
    try {
      toast.loading(`Parsing 3D IFC spaces from "${file.name}"...`, { id: "bim-sp-extract" });
      const extracted = await extractSpacesFromIFCFile(file);
      toast.dismiss("bim-sp-extract");

      if (extracted.length === 0) {
        toast.error("No 3D IFCSPACE elements found in the selected model.");
        return;
      }

      setPendingSpaces(extracted);
      setModalOpen(true);
      toast.success(`Extracted ${extracted.length} spaces from "${file.name}"!`);
    } catch (err) {
      toast.dismiss("bim-sp-extract");
      console.error("Failed to generate schedule from 3D model:", err);
      toast.error("Failed to parse 3D spaces from model file.");
    }
  };

  const handleGenerateSchedule = async () => {
    const activeSpaces = extractSpacesFromActiveViewer();
    if (activeSpaces.length > 0) {
      setPendingSpaces(activeSpaces);
      setModalOpen(true);
      toast.success(`Extracted ${activeSpaces.length} spaces from active 3D Studio!`);
      return;
    }

    const win = typeof window !== 'undefined' ? (window as any) : {};
    const file = win._currentLoadedFile;

    if (file) {
      await processIfcFile(file);
    } else {
      toast.info("Please select an IFC file to generate the space schedule.");
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      (window as any)._currentLoadedFile = file;
      await processIfcFile(file);
    }
    e.target.value = "";
  };

  useEffect(() => {
    (window as any)._onGenerateSchedule = handleGenerateSchedule;
    return () => {
      delete (window as any)._onGenerateSchedule;
    };
  }, []);

  return (
    <div id="bim-viewer-container" className="flex w-full h-full bg-[#242426] text-white font-sans overflow-hidden relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".ifc"
        className="hidden"
      />
      <Viewport3D />
      <Sidebar onFullscreenToggle={handleFullscreenToggle} />
      <BimScheduleReviewModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialRecords={pendingSpaces}
      />
    </div>
  );
}
