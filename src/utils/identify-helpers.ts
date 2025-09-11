export const identifyComponents = (srcStructure: string[]): string[] => {
    return srcStructure.filter(item =>
        item.endsWith('.component.ts') ||
        item.endsWith('.component.html') ||
        item.endsWith('.component.scss') ||
        item.endsWith('.component.css')
    );
}

export const identifyServices = (srcStructure: string[]): string[] => {
    return srcStructure.filter(item =>
        item.endsWith('.service.ts') ||
        item.endsWith('.guard.ts') ||
        item.endsWith('.interceptor.ts') ||
        item.endsWith('.resolver.ts')
    );
}

export const identifyAssets = (srcStructure: string[]): string[] => {
    return srcStructure.filter(item =>
        item.endsWith('.css') ||
        item.endsWith('.scss') ||
        item.endsWith('.sass') ||
        item.endsWith('.less') ||
        item.endsWith('.png') ||
        item.endsWith('.jpg') ||
        item.endsWith('.jpeg') ||
        item.endsWith('.gif') ||
        item.endsWith('.svg') ||
        item.endsWith('.ico') ||
        item.endsWith('.woff') ||
        item.endsWith('.woff2') ||
        item.endsWith('.ttf') ||
        item.endsWith('.eot')
    );
}

export const identifyRoutingFiles = (srcStructure: string[]): string[] => {
    return srcStructure.filter(item =>
        item.includes('routing') ||
        item.includes('route') ||
        item.endsWith('-routing.module.ts')
    );
}
