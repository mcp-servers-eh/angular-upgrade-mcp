export const parseVersion = (version: string): { major: number, minor: number, patch: number } | null => {
    const match = version.replace(/[^0-9.]/g, '').match(/^(\d+)\.(\d+)\.(\d+)/);
    if (match) {
        return {
            major: parseInt(match[1]),
            minor: parseInt(match[2]),
            patch: parseInt(match[3])
        };
    }
    return null;
}