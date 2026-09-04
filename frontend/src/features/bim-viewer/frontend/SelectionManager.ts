import * as OBC from '@thatopen/components';
import * as OBCF from '@thatopen/components-front';
import { RendererManager } from './RendererManager';
import * as THREE from 'three';

export class SelectionManager {
    public highlighter: OBCF.Highlighter;
    private isSetup = false;

    constructor(private rendererManager: RendererManager) {
        this.highlighter = this.rendererManager.components.get(OBCF.Highlighter);
    }

    setup() {
        if (this.isSetup) return;
        try {
            this.highlighter.config.world = this.rendererManager.world;
            this.highlighter.setup();

            const domElement = this.rendererManager.world.renderer?.three?.domElement;
            if (domElement) {
                domElement.removeEventListener("mousedown", (this.highlighter as any).onMouseDown);
                domElement.removeEventListener("mouseup", (this.highlighter as any).onMouseUp);
                domElement.removeEventListener("pointermove", (this.highlighter as any).onMouseMove);
            }

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

            this.isSetup = true;
        } catch (err) {
            console.warn("SelectionManager setup warning:", err);
        }
    }

    async clear() {
        try {
            if (!this.isSetup) return;

            if (this.highlighter && typeof this.highlighter.clear === 'function') {
                const p = this.highlighter.clear();
                if (p && typeof p.catch === 'function') {
                    await p.catch(() => {});
                }
            }
        } catch (err) {
            // Safely ignore
        }
    }
}
