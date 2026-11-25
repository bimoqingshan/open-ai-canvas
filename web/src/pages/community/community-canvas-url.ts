export function publicCanvasShareToken(canvasUrl: string, origin: string) {
    const trustedOrigin = new URL(origin).origin;
    const shareUrl = new URL(canvasUrl, trustedOrigin);
    if (shareUrl.origin !== trustedOrigin || shareUrl.username || shareUrl.password) throw new Error("公开画布地址无效");
    const match = shareUrl.pathname.match(/^\/share\/canvas\/([^/]+)\/?$/);
    if (!match) throw new Error("公开画布地址无效");
    const token = decodeURIComponent(match[1]);
    if (!token) throw new Error("公开画布地址无效");
    return token;
}

export function communityCanvasEmbedUrl(canvasUrl: string, origin: string) {
    const token = publicCanvasShareToken(canvasUrl, origin);
    return `/share/canvas/${encodeURIComponent(token)}?embed=1`;
}
