import * as FRAGS from '@thatopen/fragments';

export class GeometryGenerator {
    private importer: FRAGS.IfcImporter;

    constructor(customWasmPath?: string) {
        this.importer = new FRAGS.IfcImporter();
        const wasmDir = customWasmPath || (typeof window !== 'undefined' ? `${window.location.origin}/` : './');
        this.importer.wasm = { path: wasmDir, absolute: true };
        this.importer.doubleSidedMaterials = true;
    }

    async generateFragments(fileBuffer: Uint8Array | Buffer): Promise<Uint8Array | null> {
        (this.importer as any).geometryProcessSettings = {
            threshold: 50000,
            precision: 1e6,
            normalPrecision: 1e7,
            planePrecision: 1e3,
            faceThreshold: 0.6,
            forceTransparentSpaces: true
        };

        const importerBytes = new Uint8Array(fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength));
        const fragResult = await this.importer.process({ bytes: importerBytes });
        
        if (!fragResult || (fragResult.byteLength ?? fragResult.length) === 0) {
            console.error('❌ CRITICAL: IfcImporter.process() returned EMPTY output!');
            return null;
        }
        return fragResult;
    }
}
