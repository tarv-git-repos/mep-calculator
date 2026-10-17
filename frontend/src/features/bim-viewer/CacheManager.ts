import { IfcParser } from './IfcParser';
import { PropertyManager, getVal, arr } from './PropertyManager';
import { RelationshipManager } from './RelationshipManager';
import { SpaceGeometryExtractor } from './SpaceGeometryExtractor';
import { Matrix4, Vector3 } from 'three';
import * as WEBIFC from 'web-ifc';

export class CacheManager {
    constructor(
        private parser: IfcParser,
        private propertyManager: PropertyManager,
        private relationshipManager: RelationshipManager,
        private spaceGeometryExtractor: SpaceGeometryExtractor
    ) {}

    buildTree(id: number, coordMatrix: Matrix4): any {
        const line = this.parser.getLine(id);
        if (!line) return null;
        const type = Object.keys(WEBIFC).find(k => (WEBIFC as any)[k] === line.type);
        const node: any = {
            expressId: id,
            globalId: getVal(line.GlobalId),
            name: getVal(line.Name),
            type
        };
        if (line.type === WEBIFC.IFCBUILDINGSTOREY) {
            node.elevation = getVal(line.Elevation);
        }
        if (line.type === WEBIFC.IFCSPACE) {
            const name = getVal(line.Name);
            const longName = getVal(line.LongName);
            const objectType = getVal(line.ObjectType);
            if ((longName && /^\([A-Z]\)\s/i.test(longName)) || /garden/i.test(name || '') || /garden/i.test(longName || '') || /garden/i.test(objectType || '')) return null;
            node.longName = longName;
            node.objectType = objectType;
            node.quantities = this.propertyManager.getQuantities(id, this.relationshipManager.relDefines);
        }
        node.children = this.relationshipManager.relAggregates.get(id)?.map((childId: number) => this.buildTree(childId, coordMatrix)).filter(Boolean) || [];
        return node;
    }

    buildElements(coordMatrix: Matrix4): Record<number, any> {
        const types = [WEBIFC.IFCWINDOW, WEBIFC.IFCDOOR, WEBIFC.IFCWALL, WEBIFC.IFCSLAB, WEBIFC.IFCFURNITURE, WEBIFC.IFCSPACE];
        const elements: Record<number, any> = {};
        const matrixCache = new Map<number, Matrix4>();

        for (const type of types) {
            const ids = this.parser.getIds(type);
            for (const id of ids) {
                const line = this.parser.getLine(id);
                if (line?.type === WEBIFC.IFCSPACE) {
                    const name = getVal(line.Name);
                    const longName = getVal(line.LongName);
                    const objectType = getVal(line.ObjectType);
                    if ((longName && /^\([A-Z]\)\s/i.test(longName)) || /garden/i.test(name || '') || /garden/i.test(longName || '') || /garden/i.test(objectType || '')) continue;
                }

                const m = this.propertyManager.getMatrix(getVal(line?.ObjectPlacement), matrixCache);
                let polygon: { x: number; y: number }[] = [];
                let labelPosition = { x: 0, y: 0, z: 0 };
                let spaceCenter = { x: 0, y: 0, z: 0 };

                if (line?.type === WEBIFC.IFCSPACE) {
                    const spaceGeom = this.spaceGeometryExtractor.getSpacePolygonAndCenter(id);
                    const baseM = this.propertyManager.getMatrix(getVal(line?.ObjectPlacement), matrixCache);
                    baseM.premultiply(coordMatrix);

                    if (spaceGeom.polygon && spaceGeom.polygon.length > 0) {
                        polygon = spaceGeom.polygon.map(pt => {
                            const v = new Vector3(pt.x, pt.y, 0).applyMatrix4(baseM);
                            return { x: v.x, y: v.y };
                        });
                    }

                    const centerV = new Vector3(spaceGeom.center.x, spaceGeom.center.y, 0).applyMatrix4(baseM);
                    spaceCenter = { x: centerV.x, y: centerV.y, z: centerV.z };
                    labelPosition = { x: centerV.x, y: centerV.y, z: centerV.z };

                    m.multiply(new Matrix4().makeTranslation(spaceGeom.center.x, spaceGeom.center.y, spaceGeom.center.z));
                }
                m.premultiply(coordMatrix);

                elements[id] = {
                    expressId: id,
                    globalId: getVal(line?.GlobalId),
                    name: getVal(line?.Name),
                    longName: getVal(line?.LongName),
                    type: Object.keys(WEBIFC).find(k => (WEBIFC as any)[k] === line?.type),
                    spaceId: this.relationshipManager.getSpaceId(id),
                    storeyId: this.relationshipManager.relContained.get(id),
                    width: getVal(line?.OverallWidth) ?? this.propertyManager.findProp(id, ["Width", "OverallWidth", "NominalWidth"], this.relationshipManager.relDefines),
                    height: getVal(line?.OverallHeight) ?? this.propertyManager.findProp(id, ["Height", "OverallHeight", "NominalHeight"], this.relationshipManager.relDefines),
                    quantities: this.propertyManager.getQuantities(id, this.relationshipManager.relDefines),
                    polygon: polygon.length > 0 ? polygon : undefined,
                    spaceCenter: polygon.length > 0 ? spaceCenter : undefined,
                    labelPosition: polygon.length > 0 ? labelPosition : undefined,
                    placement: {
                        localMatrix: m.elements,
                        position: { x: m.elements[12], y: m.elements[13], z: m.elements[14] },
                        directionX: { x: m.elements[0], y: m.elements[1], z: m.elements[2] },
                        directionY: { x: m.elements[4], y: m.elements[5], z: m.elements[6] },
                        directionZ: { x: m.elements[8], y: m.elements[9], z: m.elements[10] }
                    }
                };
            }
        }
        return elements;
    }
}
