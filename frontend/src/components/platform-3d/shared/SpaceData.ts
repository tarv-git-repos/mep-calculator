export interface SpaceData {
    guid: string;
    expressId: number;
    name: string;
    number: string;
    longName?: string;
    area: number;
    volume: number;
    polygon?: { x: number, y: number }[];
    boundingBox?: {
        min: { x: number, y: number, z: number };
        max: { x: number, y: number, z: number };
    };
    labelPosition?: { x: number, y: number, z: number };
    boundaryElements: (string | number)[]; // IDs or GUIDs of bounding walls/doors
    storeyId: number;
}
