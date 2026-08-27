import { IfcParser } from './IfcParser.js';
import * as WEBIFC from 'web-ifc';
import { Matrix4, Vector3 } from 'three';

export const getVal = (v: any) => {
    if (!v || typeof v !== 'object') return v;
    if ('value' in v) return v.value;
    if ('_representationValue' in v) return v._representationValue;
    if ('_internalValue' in v) return v._internalValue;
    if ('representationValue' in v) return v.representationValue;
    if ('internalValue' in v) return v.internalValue;
    return v;
};

export const arr = <T>(v: T | T[]): T[] => Array.isArray(v) ? v : v ? [v] : [];

export class PropertyManager {
    constructor(private parser: IfcParser) {}

    getQuantities(id: number, relDefines: Map<number, number[]>): Record<string, any> {
        const qts: Record<string, any> = Object.fromEntries(
            (relDefines.get(id) || [])
                .map(relId => this.parser.getLine(relId))
                .filter(p => p?.type === WEBIFC.IFCELEMENTQUANTITY)
                .flatMap(p => arr(p.Quantities))
                .map(qId => this.parser.getLine(qId))
                .filter(q => q)
                .map(q => [getVal(q.Name), getVal(q.LengthValue ?? q.AreaValue ?? q.VolumeValue ?? q.CountValue ?? q.WeightValue)])
        );
        
        if (qts.Area === undefined) {
            const psets = (relDefines.get(id) || [])
                .map(relId => this.parser.getLine(relId))
                .filter(p => p?.type === WEBIFC.IFCPROPERTYSET);
            for (const pset of psets) {
                if (!pset) continue;
                const props = arr(pset.HasProperties).map(pId => this.parser.getLine(pId)).filter(Boolean);
                for (const p of props) {
                    const name = getVal(p.Name);
                    if (["Area", "NetArea", "GrossArea", "NetFloorArea"].includes(name)) {
                        const val = getVal(p.NominalValue);
                        if (typeof val === 'number') {
                            qts.Area = val;
                            break;
                        }
                        if (val && typeof val === 'object' && ('value' in val || '_representationValue' in val || '_internalValue' in val)) {
                            qts.Area = getVal(val);
                            break;
                        }
                    }
                }
                if (qts.Area !== undefined) break;
            }
        }
        return qts;
    }

    findProp(id: number, names: string[], relDefines: Map<number, number[]>): any {
        return getVal((relDefines.get(id) || [])
            .map(relId => this.parser.getLine(relId))
            .filter(p => p?.type === WEBIFC.IFCPROPERTYSET)
            .flatMap(p => arr(p.HasProperties))
            .map(pId => this.parser.getLine(pId))
            .find(p => p && names.includes(getVal(p.Name)))?.NominalValue);
    }

    getMatrix(pid: number, cache = new Map<number, Matrix4>()): Matrix4 {
        if (cache.has(pid)) return cache.get(pid)!.clone();
        
        const m = new Matrix4();
        const p = this.parser.getLine(pid);
        if (!p || !getVal(p.RelativePlacement)) return m;
        
        const rp = this.parser.getLine(getVal(p.RelativePlacement));
        if (rp) {
            const parsePt = (pt: any) => new Vector3(getVal(pt?.Coordinates?.[0])||0, getVal(pt?.Coordinates?.[1])||0, getVal(pt?.Coordinates?.[2])||0);
            const parseDir = (dir: any, def: [number,number,number]) => new Vector3(getVal(dir?.DirectionRatios?.[0]) ?? def[0], getVal(dir?.DirectionRatios?.[1]) ?? def[1], getVal(dir?.DirectionRatios?.[2]) ?? def[2]);

            const z = rp.type === WEBIFC.IFCAXIS2PLACEMENT3D && rp.Axis ? parseDir(this.parser.getLine(getVal(rp.Axis)), [0,0,1]).normalize() : new Vector3(0,0,1);
            const x = rp.RefDirection ? parseDir(this.parser.getLine(getVal(rp.RefDirection)), [1,0,0]).normalize() : new Vector3(1,0,0);
            m.makeBasis(
                x.clone().crossVectors(new Vector3().crossVectors(z, x).normalize(), z).normalize(), 
                new Vector3().crossVectors(z, x).normalize(), 
                z
            ).setPosition(parsePt(this.parser.getLine(getVal(rp.Location))));
        }
        
        const result = p.PlacementRelTo ? new Matrix4().multiplyMatrices(this.getMatrix(getVal(p.PlacementRelTo), cache), m) : m;
        cache.set(pid, result);
        return result;
    }
}
