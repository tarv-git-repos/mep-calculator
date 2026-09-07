import * as OBC from '@thatopen/components';
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer';

export class RendererManager {
    public components: OBC.Components;
    public worlds: OBC.Worlds;
    public world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>;
    public css2DRenderer: CSS2DRenderer;
    public resizeObserver?: ResizeObserver;
    private _isDisposed: boolean = false;

    constructor(public viewport: HTMLElement) {
        // Clear any orphaned canvases or overlays left behind from previous mounts
        while (this.viewport.firstChild) {
            try {
                this.viewport.removeChild(this.viewport.firstChild);
            } catch (e) {
                break;
            }
        }

        this.components = new OBC.Components();
        this.worlds = this.components.get(OBC.Worlds);
        
        this.world = this.worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();
        this.world.scene = new OBC.SimpleScene(this.components);

        // Attempt WebGL renderer creation with fallback configurations
        let rendererCreated = false;
        const configOptions = [
            { logarithmicDepthBuffer: true, antialias: true, powerPreference: 'high-performance' as WebGLPowerPreference, failIfMajorPerformanceCaveat: false },
            { logarithmicDepthBuffer: false, antialias: false, powerPreference: 'default' as WebGLPowerPreference, failIfMajorPerformanceCaveat: false },
            { logarithmicDepthBuffer: false, antialias: false }
        ];

        for (const config of configOptions) {
            try {
                this.world.renderer = new OBC.SimpleRenderer(this.components, this.viewport, config);
                rendererCreated = true;
                break;
            } catch (err) {
                console.warn("Retrying WebGL renderer creation with relaxed parameters...", err);
                while (this.viewport.firstChild) {
                    try { this.viewport.removeChild(this.viewport.firstChild); } catch (_) { break; }
                }
            }
        }

        if (!rendererCreated) {
            // Last-ditch attempt: standard SimpleRenderer without custom params
            this.world.renderer = new OBC.SimpleRenderer(this.components, this.viewport);
        }

        // Attach WebGL context loss listener to prevent browser crash
        if (this.world.renderer?.three?.domElement) {
            const canvas = this.world.renderer.three.domElement;
            canvas.addEventListener('webglcontextlost', (event: Event) => {
                event.preventDefault();
                console.warn("3D WebGL Context lost. Retaining instance for restoration.");
            }, false);

            canvas.addEventListener('webglcontextrestored', () => {
                console.info("3D WebGL Context successfully restored.");
                try {
                    this.world.renderer?.resize();
                    this.world.camera?.updateAspect();
                } catch (e) {}
            }, false);
        }

        this.world.camera = new OBC.OrthoPerspectiveCamera(this.components);
        
        this.world.scene.setup();
        this.world.scene.three.background = new THREE.Color(0x242426);
        this.components.init();

        this.css2DRenderer = new CSS2DRenderer();
        this.css2DRenderer.setSize(this.viewport.clientWidth || 800, this.viewport.clientHeight || 600);
        Object.assign(this.css2DRenderer.domElement.style, { position: 'absolute', top: '0px', left: '0px', pointerEvents: 'none', width: '100%', height: '100%' });
        this.viewport.appendChild(this.css2DRenderer.domElement);
        
        this.world.renderer.onBeforeUpdate.add(() => {
            if (!this._isDisposed && this.world?.scene?.three && this.world?.camera?.three) {
                this.css2DRenderer.render(this.world.scene.three, this.world.camera.three);
            }
        });

        // Purge any ThatOpen company watermark/branding injected by OBC
        const purgeWatermarks = () => {
            if (this._isDisposed) return;
            try {
                const elements = this.viewport.querySelectorAll('a, img, div, svg');
                elements.forEach((el: any) => {
                    const str = (el.outerHTML || '').toLowerCase();
                    if (str.includes('thatopen') || str.includes('that open') || str.includes('that-open')) {
                        el.remove();
                    }
                });
            } catch {}
        };
        setTimeout(purgeWatermarks, 100);
        setTimeout(purgeWatermarks, 1000);
        setTimeout(purgeWatermarks, 3000);

        this.resizeObserver = new ResizeObserver(() => { 
            if (this._isDisposed) return;
            try {
                this.world.renderer?.resize(); 
                this.world.camera?.updateAspect(); 
                if (this.viewport.clientWidth && this.viewport.clientHeight) {
                    this.css2DRenderer.setSize(this.viewport.clientWidth, this.viewport.clientHeight); 
                }
            } catch (e) {}
        });
        this.resizeObserver.observe(this.viewport);
    }

    public dispose() {
        this._isDisposed = true;
        try {
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
            if (this.css2DRenderer?.domElement?.parentElement) {
                this.css2DRenderer.domElement.parentElement.removeChild(this.css2DRenderer.domElement);
            }
            if (this.world?.renderer?.three) {
                const renderer = this.world.renderer.three;
                renderer.dispose();
                if (typeof renderer.forceContextLoss === 'function') {
                    renderer.forceContextLoss();
                }
            }
            if (this.world?.renderer) {
                this.world.renderer.dispose();
            }
            if (this.components) {
                this.components.dispose();
            }
            while (this.viewport?.firstChild) {
                try {
                    this.viewport.removeChild(this.viewport.firstChild);
                } catch (_) {
                    break;
                }
            }
        } catch (err) {
            console.warn("RendererManager dispose notice:", err);
        }
    }
}
