export interface RelationshipData {
    sourceGuid: string;
    targetGuid: string;
    relationshipType: string; // e.g., 'IfcRelSpaceBoundary', 'IfcRelContainedInSpatialStructure'
}
