import path from "path";


const ALLOWED_ROOTS = [
    process.env.MCP_ROOT_OLD ?? "D:/Aptar/Product Regulatory/Code/frontend",
    process.env.MCP_ROOT_NEW ?? "D:/Aptar/Product Regulatory/Code/frontend-mcp"
].filter(Boolean).map(p => path.resolve(p));


export function ensureInsideAllowed(p: string) {
    const abs = path.resolve(p);
    const ok = ALLOWED_ROOTS.some(root => abs === root || abs.startsWith(root + path.sep));
    if (!ok) throw new Error(`Path not allowed by MCP policy: ${abs}`);
    return abs;
}