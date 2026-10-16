import * as FRAGS from '@thatopen/fragments';
import * as WEBIFC from 'web-ifc';
import * as path from 'path';
import { createRequire } from 'module';

export class GeometryGenerator {
    private importer: FRAGS.IfcImporter;

    constructor() {
        this.importer = new FRAGS.IfcImporter();
        const require = createRequire(import.meta.url);
        const wasmDir = path.dirname(require.resolve('web-ifc')) + '/';
        this.importer.wasm = { path: wasmDir, absolute: true };
        this.importer.doubleSidedMaterials = true;
    }

    async generateFragments(fileBuffer: Buffer): Promise<Uint8Array | null> {
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
