export declare function planStatus(): Promise<{
    active: boolean;
    deniedTools?: string[];
}>;
export declare function planOn(): Promise<{
    ok: boolean;
    message: string;
}>;
export declare function planOff(): Promise<{
    ok: boolean;
    message: string;
}>;
