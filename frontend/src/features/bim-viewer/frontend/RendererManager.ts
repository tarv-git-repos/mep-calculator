import * as OBC from '@thatopen/components';
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer';

export class RendererManager {
    public components: OBC.Components;
    public worlds: OBC.Worlds;
    public world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>;
    public css2DRenderer: CSS2DRenderer;

    constructor(public viewport: HTMLElement) {
        this.components = new OBC.Components();
        this.worlds = this.components.get(OBC.Worlds);
        
        this.world = this.worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();
        this.world.scene = new OBC.SimpleScene(this.components);
        this.world.renderer = new OBC.SimpleRenderer(this.components, this.viewport, { logarithmicDepthBuffer: true });
        this.world.camera = new OBC.OrthoPerspectiveCamera(this.components);
        
        this.world.scene.setup();
        this.world.scene.three.background = new THREE.Color(0x242426);
        this.components.init();

        this.css2DRenderer = new CSS2DRenderer();
        this.css2DRenderer.setSize(this.viewport.clientWidth, this.viewport.clientHeight);
        Object.assign(this.css2DRenderer.domElement.style, { position: 'absolute', top: '0px', pointerEvents: 'none' });
        this.viewport.appendChild(this.css2DRenderer.domElement);
        
        this.world.renderer.onBeforeUpdate.add(() => this.css2DRenderer.render(this.world.scene.three, this.world.camera.three));

        new ResizeObserver(() => { 
            this.world.renderer?.resize(); 
            this.world.camera?.updateAspect(); 
            this.css2DRenderer.setSize(this.viewport.clientWidth, this.viewport.clientHeight); 
        }).observe(this.viewport);
    }
}
