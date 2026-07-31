export interface InputDefinition {
  id: string;
  name: string;
  type: "number" | "string" | "boolean" | "select";
  options?: string[];
  defaultValue?: any;
  unit?: string;
  required?: boolean;
}

export interface CalculationResult {
  data: any;
  isValid: boolean;
  errors?: Record<string, string>;
  warnings?: Record<string, string>;
}

export interface ReportData {
  title: string;
  sections: Array<{
    title: string;
    content: any;
    type: "table" | "text" | "chart";
  }>;
}

export interface ExportData {
  filename: string;
  sheets: Array<{
    name: string;
    data: any[][];
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface CalculatorPlugin {
  id: string;
  name: string;
  category: string;
  description?: string;
  
  inputs: InputDefinition[];
  
  calculate(state: any): CalculationResult;
  report(state: any, result: CalculationResult): ReportData;
  export(state: any, result: CalculationResult): ExportData;
  validate(state: any): ValidationResult;
}
