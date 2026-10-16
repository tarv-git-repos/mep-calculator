import { IfcParser } from './IfcParser.js';
import * as WEBIFC from 'web-ifc';
import { Vector3 } from 'three';
import { getVal, arr } from './PropertyManager.js';

export interface SpacePolygonResult {
    polygon: { x: number; y: number }[];
    center: Vector3;
    area: number;
}

function extractNum(val: any): number | null {
    if (typeof val === 'number') return val;
    if (!val) return null;
    if (Array.isArray(val)) {
        for (const item of val) {
            const res = extractNum(item);
            if (res !== null) return res;
        }
    }
    if (typeof val === 'object') {
        if ('value' in val) return extractNum(val.value);
        if ('_representationValue' in val) return extractNum(val._representationValue);
        if ('_internalValue' in val) return extractNum(val._internalValue);
    }
    return null;
}

export class SpaceGeometryExtractor {
    constructor(private parser: IfcParser) {}

    getSpacePolygonAndCenter(spaceId: number): SpacePolygonResult {
        const defaultRes: SpacePolygonResult = { polygon: [], center: new Vector3(), area: 0 };
        const line = this.parser.getLine(spaceId);
        if (!line) return defaultRes;
        const repId = getVal(line.Representation);
        const rep = this.parser.getLine(repId);
        if (!rep) return defaultRes;
        
        const reps = arr(rep.Representations).map((id: any) => this.parser.getLine(id));
        for (const r of reps) {
            if (!r) continue;
            const items = arr(r.Items).map((id: any) => this.parser.getLine(id));
            for (const item of items) {
                if (!item) continue;
                
                let placementM = new Matrix4();
                if (item.Position) {
                    const pos = this.parser.getLine(getVal(item.Position));
                    if (pos) {
                        const parsePt = (pt: any) => new Vector3(getVal(pt?.Coordinates?.[0])||0, getVal(pt?.Coordinates?.[1])||0, getVal(pt?.Coordinates?.[2])||0);
                        const parseDir = (dir: any, def: [number,number,number]) => new Vector3(getVal(dir?.DirectionRatios?.[0]) ?? def[0], getVal(dir?.DirectionRatios?.[1]) ?? def[1], getVal(dir?.DirectionRatios?.[2]) ?? def[2]);
                        
                        const z = pos.type === WEBIFC.IFCAXIS2PLACEMENT3D && pos.Axis ? parseDir(this.parser.getLine(getVal(pos.Axis)), [0,0,1]).normalize() : new Vector3(0,0,1);
                        const x = pos.RefDirection ? parseDir(this.parser.getLine(getVal(pos.RefDirection)), [1,0,0]).normalize() : new Vector3(1,0,0);
                        
                        placementM.makeBasis(
                            x.clone().crossVectors(new Vector3().crossVectors(z, x).normalize(), z).normalize(), 
                            new Vector3().crossVectors(z, x).normalize(), 
                            z
                        );
                        if (pos.Location) {
                            placementM.setPosition(parsePt(this.parser.getLine(getVal(pos.Location))));
                        }
                    }
                }

                let profileObj: any = null;
                if (item.SweptArea) profileObj = this.parser.getLine(getVal(item.SweptArea));
                else if (item.Profile) profileObj = this.parser.getLine(getVal(item.Profile));
                else if (item.__type === 'IFCARBITRARYCLOSEDPROFILEDEF') profileObj = item;
                
                if (profileObj && profileObj.OuterCurve) {
                    const curve = this.parser.getLine(getVal(profileObj.OuterCurve));
                    if (!curve) continue;

                    const rawCoords: { x: number; y: number }[] = [];
                    const ptsRef = getVal(curve.Points);

                    if (typeof ptsRef === 'number') {
                        const ptList = this.parser.getLine(ptsRef);
                        if (ptList && ptList.CoordList) {
                            const coords = arr(ptList.CoordList);
                            coords.forEach((pt: any) => {
                                const ptArray = arr(pt);
                                const x = extractNum(ptArray[0]);
                                const y = extractNum(ptArray[1]);
                                if (x !== null && y !== null) {
                                    const v = new Vector3(x, y, 0).applyMatrix4(placementM);
                                    rawCoords.push({ x: v.x, y: v.y });
                                }
                            });
                        }
                    } else if (Array.isArray(ptsRef)) {
                        for (const ptId of ptsRef) {
                            const pt = this.parser.getLine(getVal(ptId));
                            if (pt && pt.Coordinates) {
                                const coords = arr(pt.Coordinates);
                                const x = extractNum(coords[0]);
                                const y = extractNum(coords[1]);
                                if (x !== null && y !== null) {
                                    const v = new Vector3(x, y, 0).applyMatrix4(placementM);
                                    rawCoords.push({ x: v.x, y: v.y });
                                }
                            }
                        }
                    }

                    if (rawCoords.length > 0) {
                        let n = rawCoords.length;
                        if (n > 2 && rawCoords[0].x === rawCoords[n - 1].x && rawCoords[0].y === rawCoords[n - 1].y) {
                            n = n - 1;
                        }

                        let areaSum = 0;
                        let cxSum = 0;
                        let cySum = 0;
                        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

                        for (let i = 0; i < n; i++) {
                            const p1 = rawCoords[i];
                            const p2 = rawCoords[(i + 1) % n];

                            if (p1.x < minX) minX = p1.x;
                            if (p1.x > maxX) maxX = p1.x;
                            if (p1.y < minY) minY = p1.y;
                            if (p1.y > maxY) maxY = p1.y;

                            const cross = (p1.x * p2.y) - (p2.x * p1.y);
                            areaSum += cross;
                            cxSum += (p1.x + p2.x) * cross;
                            cySum += (p1.y + p2.y) * cross;
                        }

                        const signedArea = areaSum / 2;
                        const absArea = Math.abs(signedArea);
                        let center = new Vector3();

                        if (absArea > 0.0001) {
                            const cx = cxSum / (6 * signedArea);
                            const cy = cySum / (6 * signedArea);
                            center.set(cx, cy, 0);
                        } else {
                            center.set((minX + maxX) / 2, (minY + maxY) / 2, 0);
                        }

                        return {
                            polygon: rawCoords,
                            center,
                            area: absArea
                        };
                    }
                }
            }
        }
        return defaultRes;
    }

    getSpaceCenterOffset(spaceId: number): Vector3 {
        return this.getSpacePolygonAndCenter(spaceId).center;
    }
}
