export interface SpatialIndex {
    /**
     * Initializes or clears the spatial index.
     */
    init(): void;

    /**
     * Inserts an item into the index.
     * @param id The unique identifier of the item.
     * @param minX Minimum X coordinate of the bounding box.
     * @param minY Minimum Y coordinate of the bounding box.
     * @param maxX Maximum X coordinate of the bounding box.
     * @param maxY Maximum Y coordinate of the bounding box.
     */
    insert(id: string | number, minX: number, minY: number, maxX: number, maxY: number): void;

    /**
     * Removes an item from the index.
     */
    remove(id: string | number): void;

    /**
     * Searches for items intersecting the given bounding box.
     * @returns Array of item IDs.
     */
    search(minX: number, minY: number, maxX: number, maxY: number): (string | number)[];
}
