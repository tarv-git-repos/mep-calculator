declare module 'three';

declare module 'three/examples/jsm/renderers/CSS2DRenderer.js' {
  import { Object3D, Scene, Camera } from 'three';
  export class CSS2DRenderer {
    domElement: HTMLElement;
    constructor();
    setSize(width: number, height: number): void;
    render(scene: Scene, camera: Camera): void;
  }
  export class CSS2DObject extends Object3D {
    element: HTMLElement;
    constructor(element: HTMLElement);
  }
}
