import { Matrix4 } from 'three';
import * as WEBIFC from 'web-ifc';
import { GeometryGenerator } from './backend/GeometryGenerator';
import { IfcParser } from './backend/IfcParser';
import { PropertyManager } from './backend/PropertyManager';
import { RelationshipManager } from './backend/RelationshipManager';
import { SpaceGeometryExtractor } from './backend/SpaceGeometryExtractor';
import { CacheManager } from './backend/CacheManager';

self.onmessage = async (e: MessageEvent) => {
    const { fileBytes, wasmPath } = e.data;
    try {
        self.postMessage({ type: 'progress', text: 'Generating 3D geometry meshes (Step 2/5)...' });
        const geometryGenerator = new GeometryGenerator(wasmPath);
        const fragResult = await geometryGenerator.generateFragments(fileBytes);
        if (!fragResult) {
            throw new Error('Failed to generate 3D geometry fragments from IFC file.');
        }
        const fragBytes = new Uint8Array(fragResult.buffer ?? fragResult);

        self.postMessage({ type: 'progress', text: 'Extracting building levels & spaces (Step 3/5)...' });
        const parser = new IfcParser();
        await parser.init(wasmPath);
        parser.openModel(fileBytes);

        let projectTree = null;
        let elements: Record<number, any> = {};

        try {
            const propertyManager = new PropertyManager(parser);
            const relationshipManager = new RelationshipManager(parser);
            const spaceGeometryExtractor = new SpaceGeometryExtractor(parser);
            const cacheManager = new CacheManager(parser, propertyManager, relationshipManager, spaceGeometryExtractor);

            const coordVals = parser.getCoordinationMatrix();
            const coordMatrix = new Matrix4().fromArray(coordVals);

            relationshipManager.extractRelationships();

            const rootIds = parser.getIds(WEBIFC.IFCPROJECT);
            const rootId = rootIds.length > 0 ? rootIds[0] : null;

            projectTree = rootId ? cacheManager.buildTree(rootId, coordMatrix) : null;
            elements = cacheManager.buildElements(coordMatrix);
        } finally {
            parser.closeModel();
        }

        self.postMessage({ type: 'progress', text: 'Preparing 3D scene (Step 4/5)...' });
        const jsonStr = JSON.stringify({ project: projectTree, elements });

        self.postMessage(
            { type: 'complete', fragBytes, jsonStr },
            [fragBytes.buffer]
        );
    } catch (err: any) {
        self.postMessage({ type: 'error', error: err?.message || String(err) });
    }
};
