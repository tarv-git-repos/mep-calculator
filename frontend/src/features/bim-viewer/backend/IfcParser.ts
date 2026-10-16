import * as WEBIFC from 'web-ifc';

import { getVal } from './PropertyManager';

export class IfcParser {
    public ifcAPI: WEBIFC.IfcAPI;
    private modelId: number = 0;
    private lineCache = new Map<number, any>();

    constructor() {
        this.ifcAPI = new WEBIFC.IfcAPI();
    }

    async init(customWasmPath?: string): Promise<void> {
        if (customWasmPath) {
            this.ifcAPI.SetWasmPath(customWasmPath, true);
        } else {
            try {
                // Browser-compatible fallback if createRequire is unavailable
                const localWasmPath = typeof window !== 'undefined' ? `${window.location.origin}/` : './';
                this.ifcAPI.SetWasmPath(localWasmPath, true);
            } catch {
                this.ifcAPI.SetWasmPath('./', true);
            }
        }
        await this.ifcAPI.Init();
    }

    openModel(fileBuffer: Uint8Array | Buffer): number {
        const openModelBytes = new Uint8Array(fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength));
        this.modelId = this.ifcAPI.OpenModel(openModelBytes, { COORDINATE_TO_ORIGIN: true } as any);
        this.lineCache.clear();
        return this.modelId;
    }

    closeModel(): void {
        if (this.modelId !== 0) {
            this.ifcAPI.CloseModel(this.modelId);
            this.modelId = 0;
            this.lineCache.clear();
        }
    }

    getIds(type: number): number[] {
        const ids = this.ifcAPI.GetLineIDsWithType(this.modelId, type);
        return Array.from({ length: ids.size() }, (_, i) => ids.get(i));
    }

    getLine(id: any): any {
        const numericId = getVal(id);
        if (typeof numericId !== 'number' || numericId <= 0) return null;
        if (this.lineCache.has(numericId)) return this.lineCache.get(numericId);
        try {
            const line = this.ifcAPI.GetLine(this.modelId, numericId);
            this.lineCache.set(numericId, line);
            return line;
        } catch {
            return null;
        }
    }

    getCoordinationMatrix(): number[] {
        return this.ifcAPI.GetCoordinationMatrix(this.modelId);
    }
}
