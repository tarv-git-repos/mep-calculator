import * as OBC from '@thatopen/components';
import { RendererManager } from './RendererManager';

export class FloorPlanManager {
    public clipper: OBC.Clipper;
    public activePlaneId: string | null = null;
    public isEntering2D = false;

    constructor(private rendererManager: RendererManager) {
        this.clipper = this.rendererManager.components.get(OBC.Clipper);
        this.clipper.enabled = true;
    }

    async createClipPlane() {
        this.clipper.create(this.rendererManager.world);
    }

    async deleteClipPlane(id?: string) {
        if (id) {
            await this.clipper.delete(this.rendererManager.world, id);
        } else {
            await this.clipper.delete(this.rendererManager.world);
        }
    }

    async enter2DMode() {
        this.isEntering2D = true;
        await this.rendererManager.world.camera.projection.set("Orthographic");
        this.rendererManager.world.camera.set("Plan");
        if (this.rendererManager.world.camera?.controls) {
            this.rendererManager.world.camera.controls.mouseButtons.wheel = 32; // CameraControls.ACTION.ZOOM
            this.rendererManager.world.camera.controls.enabled = true;
        }
    }

    async enter3DMode() {
        await this.rendererManager.world.camera.projection.set("Perspective");
        this.rendererManager.world.camera.set("Orbit");
        if (this.rendererManager.world.camera?.controls) {
            this.rendererManager.world.camera.controls.mouseButtons.wheel = 16; // CameraControls.ACTION.DOLLY
            this.rendererManager.world.camera.controls.enabled = true;
        }
    }
}
