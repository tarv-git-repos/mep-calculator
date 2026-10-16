export interface FormulaMetadata {
  id: string;
  name: string;
  expression: string;
  description?: string;
  dependencies: string[];
}

export interface CalculationStep {
  formulaId: string;
  inputs: Record<string, any>;
  result: any;
  timestamp: string;
}

export interface CalculationHistory {
  id: string;
  steps: CalculationStep[];
}
