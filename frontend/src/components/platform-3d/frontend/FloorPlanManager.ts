import * as OBC from '@thatopen/components';
import { RendererManager } from './RendererManager.js';

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
    }

    async enter3DMode() {
        await this.rendererManager.world.camera.projection.set("Perspective");
        this.rendererManager.world.camera.set("Orbit");
    }
}
