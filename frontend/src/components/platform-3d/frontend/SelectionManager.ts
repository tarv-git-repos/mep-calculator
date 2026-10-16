import * as OBCF from '@thatopen/components-front';
import { RendererManager } from './RendererManager.js';
import * as THREE from 'three';

export class SelectionManager {
    public highlighter: OBCF.Highlighter;

    constructor(private rendererManager: RendererManager) {
        this.highlighter = this.rendererManager.components.get(OBCF.Highlighter);
        this.highlighter.config.world = this.rendererManager.world;
        this.highlighter.setup();

        const domElement = this.rendererManager.world.renderer!.three.domElement;
        domElement.removeEventListener("mousedown", (this.highlighter as any).onMouseDown);
        domElement.removeEventListener("mouseup", (this.highlighter as any).onMouseUp);
        domElement.removeEventListener("pointermove", (this.highlighter as any).onMouseMove);

        this.highlighter.styles.set('hover', {
            color: new THREE.Color(0x4285F4),
            opacity: 0.3,
            transparent: true,
            depthWrite: false,
            depthTest: false
        } as any);
        
        this.highlighter.styles.set('select', {
            color: new THREE.Color(0x4285F4),
            opacity: 0.7,
            transparent: true,
            depthWrite: false,
            depthTest: false
        } as any);
    }

    clear() {
        this.highlighter.clear();
    }
}
