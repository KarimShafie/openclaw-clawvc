export declare function start(workspacePath: string, opts?: {
    debounceMs?: number;
}): void;
export declare function stop(): Promise<void>;
export declare function isRunning(): boolean;
