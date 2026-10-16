export interface Plugin {
    id: string;
    init(): void | Promise<void>;
    dispose(): void | Promise<void>;
}

export class PluginManager {
    private plugins: Map<string, Plugin> = new Map();

    async register(plugin: Plugin): Promise<void> {
        if (this.plugins.has(plugin.id)) {
            console.warn(`Plugin ${plugin.id} is already registered.`);
            return;
        }
        this.plugins.set(plugin.id, plugin);
        await plugin.init();
    }

    async unregister(id: string): Promise<void> {
        const plugin = this.plugins.get(id);
        if (plugin) {
            await plugin.dispose();
            this.plugins.delete(id);
        }
    }

    get(id: string): Plugin | undefined {
        return this.plugins.get(id);
    }
}

export const pluginManager = new PluginManager();
