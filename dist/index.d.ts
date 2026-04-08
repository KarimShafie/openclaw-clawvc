type PluginApi = {
    registerTool: (tool: {
        name: string;
        description: string;
        parameters: unknown;
        execute: (id: string, params: Record<string, unknown>) => Promise<unknown>;
    }) => void;
    config?: Record<string, unknown>;
};
declare const _default: {
    id: string;
    name: string;
    description: string;
    register(api: PluginApi): Promise<void>;
};
export default _default;
