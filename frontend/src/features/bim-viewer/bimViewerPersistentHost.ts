import React from 'react';
import ReactDOM from 'react-dom/client';
import BimViewerApp from './App';

let persistentHostElement: HTMLDivElement | null = null;
let parkedContainer: HTMLDivElement | null = null;
let persistentReactRoot: ReactDOM.Root | null = null;
let currentProjectLoaded: string | null = null;

function getParkedContainer(): HTMLDivElement {
  if (!parkedContainer) {
    parkedContainer = document.createElement('div');
    parkedContainer.id = 'bim-viewer-parked-storage';
    parkedContainer.style.position = 'fixed';
    parkedContainer.style.top = '-99999px';
    parkedContainer.style.left = '-99999px';
    parkedContainer.style.width = '1px';
    parkedContainer.style.height = '1px';
    parkedContainer.style.overflow = 'hidden';
    parkedContainer.style.visibility = 'hidden';
    parkedContainer.style.pointerEvents = 'none';
    document.body.appendChild(parkedContainer);
  }
  return parkedContainer;
}

export function getOrCreatePersistentBimViewer(activeProjectId?: string): HTMLDivElement {
  if (!persistentHostElement) {
    persistentHostElement = document.createElement('div');
    persistentHostElement.id = 'bim-viewer-persistent-host';
    persistentHostElement.className = 'w-full h-full overflow-hidden relative bg-[#242426]';

    // Park it initially
    getParkedContainer().appendChild(persistentHostElement);

    // Mount BimViewerApp permanently once
    persistentReactRoot = ReactDOM.createRoot(persistentHostElement);
    persistentReactRoot.render(React.createElement(BimViewerApp));
    currentProjectLoaded = activeProjectId || null;
  }
  return persistentHostElement;
}

export function attachPersistentBimViewer(targetContainer: HTMLElement, activeProjectId?: string) {
  const host = getOrCreatePersistentBimViewer(activeProjectId);

  if (targetContainer && host.parentElement !== targetContainer) {
    targetContainer.appendChild(host);
  }

  // Resume Three.js WebGL render loop & trigger immediate resize
  if (typeof (window as any)._resumeBimViewerRendering === 'function') {
    (window as any)._resumeBimViewerRendering();
  }

  // If the active project changed while in another module, reload model for new project
  if (activeProjectId && currentProjectLoaded && activeProjectId !== currentProjectLoaded) {
    currentProjectLoaded = activeProjectId;
    if (typeof (window as any)._reloadBimViewerForProject === 'function') {
      (window as any)._reloadBimViewerForProject(activeProjectId);
    }
  } else if (activeProjectId && !currentProjectLoaded) {
    currentProjectLoaded = activeProjectId;
  }
}

export function detachAndParkPersistentBimViewer() {
  if (persistentHostElement) {
    // Pause Three.js WebGL render loop so 0% GPU/CPU is consumed while in other calculators
    if (typeof (window as any)._pauseBimViewerRendering === 'function') {
      (window as any)._pauseBimViewerRendering();
    }

    const parked = getParkedContainer();
    if (persistentHostElement.parentElement !== parked) {
      parked.appendChild(persistentHostElement);
    }
  }
}
