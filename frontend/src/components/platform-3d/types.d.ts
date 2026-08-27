interface Window {
  api: {
    processIfc: (fp: string) => Promise<{ frag: string; json: string }>;
    readFile: (fp: string) => Promise<ArrayBuffer | Uint8Array>;
    getFilePath: (file: File) => string;
  };
}

declare module 'three/examples/jsm/renderers/CSS2DRenderer.js' {
    import { Object3D, Camera, Scene } from 'three';

    export class CSS2DObject extends Object3D {
        constructor(element: HTMLElement);
        element: HTMLElement;
    }

    export class CSS2DRenderer {
        constructor();
        domElement: HTMLElement;
        getSize(): { width: number; height: number };
        setSize(width: number, height: number): void;
        render(scene: Scene, camera: Camera): void;
    }
}
