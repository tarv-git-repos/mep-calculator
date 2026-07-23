import React, { useRef } from "react";
import * as XLSX from "xlsx";
import { Upload } from "lucide-react";
import { TBtn } from "./Button";
import { toast } from "sonner";

export interface ImportExcelBtnProps {
  /**
   * Mapping of Excel column names to your internal state keys.
   * Example: { "Description": "desc", "Load kW": "kw" }
   */
  columnMapping: Record<string, string>;
  
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
        
        // Parse the sheet to an array of objects where keys are the header names
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
        
        if (!json || json.length === 0) {
          toast.error("No data found in the Excel sheet");
          return;
        }

        // Map the parsed JSON according to the column mapping
        const mappedRows = json.map((row) => {
          const newObj: Record<string, any> = {};
          
          for (const [excelKey, stateKey] of Object.entries(columnMapping)) {
            // Find the key in row (case-insensitive if needed, but exact match is safer)
            const val = row[excelKey];
            if (val !== undefined && val !== null && val !== "") {
              newObj[stateKey] = val;
            }
          }
          return newObj;
        });

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
            <Upload className="size-3.5 mr-1" />
            Import Excel
          </>
        )}
      </TBtn>
    </>
  );
}
