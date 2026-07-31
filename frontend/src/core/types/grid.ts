export interface GridColumn {
  id: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "action";
  width?: string | number;
  options?: string[]; // for select type
  editable?: boolean;
  align?: "left" | "center" | "right";
  tooltip?: string;
}

export interface GridRow {
  id: string;
  [key: string]: any;
}

export interface EditableGridState {
  rows: GridRow[];
  selectedRowIds: Set<string>;
  history: GridRow[][];
  historyIndex: number;
}

export interface EditableGridHandlers {
  onRowsChange: (newRows: GridRow[]) => void;
  onSelectionChange: (selectedIds: Set<string>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}
