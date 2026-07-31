export interface Project {
  id: string;
  name: string;
  client: string;
  dateCreated: string;
  lastModified: string;
  calculations: Array<{
    id: string;
    pluginId: string;
    name: string;
    state: any;
  }>;
}
