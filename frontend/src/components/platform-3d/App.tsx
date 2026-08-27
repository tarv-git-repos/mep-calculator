import React from 'react';
import { Viewport3D } from './components/Viewport3D';
import { Sidebar } from './components/Sidebar';

export default function App() {
  return (
    <div className="flex w-full h-full bg-[#242426] text-white font-sans overflow-hidden relative">
      <Viewport3D />
      <Sidebar />
    </div>
  );
}
