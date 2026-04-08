interface GitResult {
    ok: boolean;
    output: string;
    error?: string;
}
export type RepoState = "no-git" | "empty" | "clawvc-owned" | "user-owned";
export declare function checkRepoState(workspace: string): Promise<RepoState>;
export declare function initRepo(workspace: string): Promise<GitResult>;
export declare function gitLog(workspace: string, count?: number): Promise<GitResult>;
export declare function gitDiff(workspace: string, n?: number): Promise<GitResult>;
export declare function gitShow(workspace: string, n?: number): Promise<GitResult>;
export declare function gitUndo(workspace: string, n?: number): Promise<GitResult>;
export declare function gitStatus(workspace: string): Promise<GitResult>;
export declare function gitLastCommit(workspace: string): Promise<GitResult>;
export declare function gitAddAll(workspace: string): Promise<GitResult>;
export declare function gitIsClean(workspace: string): Promise<boolean>;
export declare function gitCommit(workspace: string, message: string): Promise<GitResult>;
export declare function gitFileCount(workspace: string): Promise<number>;
export {};
