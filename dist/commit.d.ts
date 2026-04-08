export declare function buildCommitMessage(files: string[], opts?: {
    failed?: boolean;
}): string;
export declare function commitWorkspace(workspace: string, opts?: {
    failed?: boolean;
}): Promise<void>;
