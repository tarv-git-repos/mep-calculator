import { create } from 'zustand';

interface ViewerState {
  // View state
  viewMode: '3d' | '2d';
  cameraMode: 'orbit' | 'walk';
  colorMode: 'full' | 'mono';
  
  // Feature toggles
  isClipActive: boolean;
  isTagsActive: boolean;
  isSpacesActive: boolean;
  
  // Model state
  isLoaded: boolean;
  isLoading: boolean;
  loadingText: string;
  
  // Level selection
  levels: Array<{ expressId: number; name: string; elevation: number }>;
  selectedLevel: string;
  
  // Selected space info
  selectedSpaceInfo: string;
  
  // Actions
  setViewMode: (mode: '3d' | '2d') => void;
  setCameraMode: (mode: 'orbit' | 'walk') => void;
  setColorMode: (mode: 'full' | 'mono') => void;
  setIsClipActive: (active: boolean) => void;
  setIsTagsActive: (active: boolean) => void;
  setIsSpacesActive: (active: boolean) => void;
  setIsLoaded: (loaded: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setLoadingText: (text: string) => void;
  setLevels: (levels: Array<{ expressId: number; name: string; elevation: number }>) => void;
  setSelectedLevel: (level: string) => void;
  setSelectedSpaceInfo: (info: string) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  viewMode: '3d',
  cameraMode: 'orbit',
  colorMode: 'full',
  isClipActive: false,
  isTagsActive: true,
  isSpacesActive: true,
  isLoaded: false,
  isLoading: false,
  loadingText: 'Drag & Drop .ifc file here',
  levels: [],
  selectedLevel: '',
  selectedSpaceInfo: 'Click on a space in 3D view to select it.',
  
  setViewMode: (mode) => set({ viewMode: mode }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setColorMode: (mode) => set({ colorMode: mode }),
  setIsClipActive: (active) => set({ isClipActive: active }),
  setIsTagsActive: (active) => set({ isTagsActive: active }),
  setIsSpacesActive: (active) => set({ isSpacesActive: active }),
  setIsLoaded: (loaded) => set({ isLoaded: loaded }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setLoadingText: (text) => set({ loadingText: text }),
  setLevels: (levels) => set({ levels }),
  setSelectedLevel: (level) => set({ selectedLevel: level }),
  setSelectedSpaceInfo: (info) => set({ selectedSpaceInfo: info }),
}));
