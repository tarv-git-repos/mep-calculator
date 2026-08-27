import { IfcParser } from './IfcParser.js';
import * as WEBIFC from 'web-ifc';
import { getVal, arr } from './PropertyManager.js';

export class RelationshipManager {
    public relDefines = new Map<number, number[]>();
    public relAggregates = new Map<number, number[]>();
    public relContained = new Map<number, number>();
    public relSpaceBoundary = new Map<number, number>();
    public fills = new Map<number, number>();
    public voids = new Map<number, number>();

    constructor(private parser: IfcParser) {}

    extractRelationships(): void {
        this.parser.getIds(WEBIFC.IFCRELDEFINESBYPROPERTIES)
            .map((id: number) => this.parser.getLine(id))
            .forEach((r: any) => r && arr(r.RelatedObjects).forEach((o: any) => {
                const key = getVal(o);
                this.relDefines.set(key, [...(this.relDefines.get(key) || []), getVal(r.RelatingPropertyDefinition)]);
            }));

        this.parser.getIds(WEBIFC.IFCRELAGGREGATES)
            .map((id: number) => this.parser.getLine(id))
            .forEach((r: any) => r && arr(r.RelatedObjects).forEach((o: any) => {
                const key = getVal(r.RelatingObject);
                this.relAggregates.set(key, [...(this.relAggregates.get(key) || []), getVal(o)]);
            }));

        this.parser.getIds(WEBIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE)
            .map((id: number) => this.parser.getLine(id))
            .forEach((r: any) => r && arr(r.RelatedElements).forEach((e: any) => {
                this.relContained.set(getVal(e), getVal(r.RelatingStructure));
            }));

        this.parser.getIds(WEBIFC.IFCRELSPACEBOUNDARY)
            .map((id: number) => this.parser.getLine(id))
            .forEach((r: any) => r && this.relSpaceBoundary.set(getVal(r.RelatedBuildingElement), getVal(r.RelatingSpace)));

        this.parser.getIds(WEBIFC.IFCRELFILLSELEMENT)
            .map((id: number) => this.parser.getLine(id))
            .forEach((r: any) => r && this.fills.set(getVal(r.RelatedBuildingElement), getVal(r.RelatingOpeningElement)));

        this.parser.getIds(WEBIFC.IFCRELVOIDSELEMENT)
            .map((id: number) => this.parser.getLine(id))
            .forEach((r: any) => r && this.voids.set(getVal(r.RelatedOpeningElement), getVal(r.RelatingBuildingElement)));
    }

    getSpaceId(id: number): number | undefined {
        return this.relSpaceBoundary.get(id) ?? this.relSpaceBoundary.get(this.voids.get(this.fills.get(id)!)!) ?? this.relContained.get(id);
    }
}
