import { SpaceData } from './SpaceData';
import { ElementData } from './ElementData';
import { RelationshipData } from './RelationshipData';
import { SpatialIndex } from './SpatialIndex';

export interface FloorPlanData {
    storeyId: number;
    storeyGuid?: string;
    name: string;
    elevation: number;
    
    // Elements belonging to this floor plan
    elements: Record<number | string, ElementData>;
    spaces: Record<number | string, SpaceData>;
    relationships: RelationshipData[];
    
    // Bounds and spatial index for fast querying
    boundingBox?: {
        min: { x: number, y: number, z: number };
        max: { x: number, y: number, z: number };
    };
    spatialIndex?: SpatialIndex;
    
    // Renderable data references
    gpuBuffers?: any; // To be refined with WebGL buffer references or fragment groups
    labels?: any;
}
