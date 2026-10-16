declare module 'file-saver' {
  export function saveAs(data: Blob | string | File, filename?: string, options?: any): void;
}

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: string;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

