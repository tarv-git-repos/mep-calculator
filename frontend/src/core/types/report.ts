export interface ReportDocument {
  title: string;
  date: string;
  author?: string;
  projectInfo?: {
    projectName: string;
    clientName: string;
  };
  pages: ReportPage[];
}

export interface ReportPage {
  elements: ReportElement[];
}

export type ReportElement = 
  | { type: "heading"; text: string; level: 1 | 2 | 3 }
  | { type: "paragraph"; text: string }
  | { type: "table"; headers: string[]; rows: any[][] }
  | { type: "image"; src: string; alt?: string }
  | { type: "summary"; data: Record<string, any> };
