import React, { useRef } from "react";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { TBtn } from "./Button";
import { toast } from "sonner";

export interface ImportExcelBtnProps {
  /**
   * Mapping of state keys to Excel column names or array of possible header aliases.
   * Example: { "desc": ["Description", "Description of connection", "Tap Off Points"] }
   * Or legacy: { "Description": "desc", "Load kW": "kw" }
   */
  columnMapping: Record<string, string | string[]>;
  
  /**
   * Callback fired with the array of mapped row objects.
   */
  onImport: (mappedRows: any[]) => void;

  className?: string;
  children?: React.ReactNode;
}

export function ImportExcelBtn({ columnMapping, onImport, className, children }: ImportExcelBtnProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset input so same file can be selected again
      fileInputRef.current.click();
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        
        if (!workbook.SheetNames.length) {
          toast.error("Excel file is empty");
          return;
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 1. Parse sheet as 2D array to find table header row dynamically
        const raw2D = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (!raw2D || raw2D.length === 0) {
          toast.error("No data found in the Excel sheet");
          return;
        }

        // Search for the header row index (scanning first 30 rows)
        let headerRowIndex = -1;
        let headerRow: string[] = [];

        const isHeaderTerm = (val: any) => {
          if (typeof val !== "string" && typeof val !== "number") return false;
          const s = String(val).toLowerCase().replace(/[^a-z0-9]/g, "");
          return [
            "description", "tapoff", "len", "length", "load", "kw", 
            "ref", "from", "diversity", "df", "tcl", "md", "vdrop", "cur"
          ].some(term => s.includes(term));
        };

        for (let i = 0; i < Math.min(raw2D.length, 30); i++) {
          const rowArr = raw2D[i];
          if (Array.isArray(rowArr) && rowArr.some(isHeaderTerm)) {
            headerRowIndex = i;
            headerRow = rowArr.map(c => String(c || "").trim());
            break;
          }
        }

        let jsonRows: Record<string, any>[] = [];

        if (headerRowIndex !== -1 && headerRow.length > 0) {
          // Convert rows after headerRowIndex into key-value objects
          for (let i = headerRowIndex + 1; i < raw2D.length; i++) {
            const rowArr = raw2D[i];
            if (!Array.isArray(rowArr) || rowArr.length === 0) continue;
            
            const rowObj: Record<string, any> = {};
            let hasValue = false;
            
            rowArr.forEach((cellVal, colIdx) => {
              const hName = headerRow[colIdx];
              if (hName) {
                rowObj[hName] = cellVal;
                if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== "") {
                  hasValue = true;
                }
              }
            });

            // Ignore footer summary & metadata rows
            const firstCellStr = String(rowArr[0] || "").toLowerCase().trim();
            const secondCellStr = String(rowArr[1] || "").toLowerCase().trim();
            if (
              firstCellStr.includes("originated") || firstCellStr.includes("reviewed") || 
              firstCellStr.includes("where") || firstCellStr.includes("note") ||
              firstCellStr.includes("total") || firstCellStr.includes("approved") ||
              secondCellStr.includes("originated") || secondCellStr.includes("reviewed") ||
              secondCellStr.includes("where") || secondCellStr.includes("note") ||
              secondCellStr.includes("total") || secondCellStr.includes("approved")
            ) {
              continue;
            }

            if (hasValue) {
              jsonRows.push(rowObj);
            }
          }
        } else {
          // Fallback to standard sheet_to_json if no header row found
          jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
        }

        if (!jsonRows || jsonRows.length === 0) {
          toast.error("No valid data rows found in the Excel sheet");
          return;
        }

        // Map the parsed JSON according to column mapping
        const mappedRows: Record<string, any>[] = [];

        jsonRows.forEach((row) => {
          const newObj: Record<string, any> = {};
          let matchedAnyField = false;

          for (const [key, mapping] of Object.entries(columnMapping)) {
            const targets = Array.isArray(mapping) ? mapping : [key, mapping];
            const stateKey = Array.isArray(mapping) ? key : mapping;

            let foundVal: any = undefined;
            
            // 1. Exact match search
            for (const target of targets) {
              if (row[target] !== undefined && row[target] !== null && row[target] !== "") {
                foundVal = row[target];
                break;
              }
            }

            // 2. Case-insensitive / normalized search
            if (foundVal === undefined) {
              const rowKeys = Object.keys(row);
              for (const target of targets) {
                const normTarget = target.toLowerCase().replace(/[^a-z0-9]/g, "");
                for (const rKey of rowKeys) {
                  const normRKey = rKey.toLowerCase().replace(/[^a-z0-9]/g, "");
                  if (normRKey === normTarget || normRKey.includes(normTarget) || normTarget.includes(normRKey)) {
                    if (row[rKey] !== undefined && row[rKey] !== null && row[rKey] !== "") {
                      foundVal = row[rKey];
                      break;
                    }
                  }
                }
                if (foundVal !== undefined) break;
              }
            }

            if (foundVal !== undefined) {
              newObj[stateKey] = foundVal;
              matchedAnyField = true;
            }
          }

          if (matchedAnyField && (newObj.desc !== undefined || newObj.length !== undefined || newObj.loadKw !== undefined)) {
            mappedRows.push(newObj);
          }
        });

        if (mappedRows.length === 0) {
          toast.error("Could not map any columns. Please verify Excel column headers.");
          return;
        }

        onImport(mappedRows);
        toast.success(`Successfully imported ${mappedRows.length} rows`);
      } catch (err) {
        console.error("Error parsing Excel file", err);
        toast.error("Failed to parse Excel file");
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls,.csv"
        onChange={handleImportExcel}
        className="hidden"
      />
      <TBtn onClick={handleClick} className={className}>
        {children || (
          <>
            <Download className="size-3.5 mr-1" />
            Import Excel
          </>
        )}
      </TBtn>
    </>
  );
}
