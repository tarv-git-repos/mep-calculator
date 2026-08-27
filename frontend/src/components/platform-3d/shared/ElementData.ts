export interface ElementData {
    guid: string;
    expressId: number;
    ifcType: string;
    geometry?: any; // To be refined with specific buffer or fragment references
    boundingBox?: {
        min: { x: number, y: number, z: number };
        max: { x: number, y: number, z: number };
    };
    properties: Record<string, any>;
    storeyId?: number;
    name?: string;
}
