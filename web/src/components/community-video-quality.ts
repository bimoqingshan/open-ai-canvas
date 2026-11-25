export type CommunityVideoSource = {
    url: string;
    label?: string;
    quality?: string | number;
    width?: number;
    height?: number;
};

export function communityVideoSourceResolution(source: CommunityVideoSource) {
    const explicit = Number(source.height || source.quality || 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const match = String(source.label || "").match(/(\d{3,4})p?/i);
    return match ? Number(match[1]) : 0;
}

export function communityVideoSourceLabel(source: CommunityVideoSource) {
    const explicit = String(source.label || source.quality || "").trim();
    if (/^(source|original|origin)$/i.test(explicit)) return "原画";
    if (/^playback$/i.test(explicit)) return "兼容播放";
    if (explicit) return /p$/i.test(explicit) || /自动|原画/i.test(explicit) ? explicit : `${explicit}P`;
    const resolution = communityVideoSourceResolution(source);
    return resolution ? `${resolution}P` : "原画";
}

export function communityVideoQualityOptions(sources: CommunityVideoSource[], sourceUrl: string) {
    const playable = sources.filter((source) => source?.url && !/^playback$/i.test(String(source.quality || "")) && source.label !== "兼容播放");
    const hasHlsOriginal = playable.some((source) => /\.m3u8(?:$|[?#])/i.test(source.url) && communityVideoSourceLabel(source) === "原画");
    const visible = playable.filter((source) => !(hasHlsOriginal && source.url === sourceUrl));
    const hasOriginal = visible.some((source) => /^(source|original|origin)$/i.test(String(source.quality || "")) || communityVideoSourceLabel(source) === "原画");
    const unique = new Map<string, CommunityVideoSource>();
    [...visible, ...(hasOriginal ? [] : [{ url: sourceUrl, label: "原画", quality: "source" }])].forEach((source) => {
        if (source?.url) unique.set(source.url, { ...source, label: communityVideoSourceLabel(source) });
    });
    return [...unique.values()].sort((a, b) => communityVideoSourceResolution(b) - communityVideoSourceResolution(a) || String(a.label || "").localeCompare(String(b.label || ""), "zh-CN"));
}

function chooseAtOrBelow(sources: CommunityVideoSource[], target: number) {
    const known = sources.filter((source) => communityVideoSourceResolution(source) > 0).sort((a, b) => communityVideoSourceResolution(b) - communityVideoSourceResolution(a));
    return known.find((source) => communityVideoSourceResolution(source) <= target) || known[known.length - 1] || sources[0];
}

export function pickCommunityVideoSource(sources: CommunityVideoSource[], bandwidthMbps: number | null, initialQuality: string | number = 540) {
    if (!sources.length) return undefined;
    if (bandwidthMbps === null || !Number.isFinite(bandwidthMbps) || bandwidthMbps <= 0) {
        const target = Number(String(initialQuality).replace(/p$/i, ""));
        return chooseAtOrBelow(sources, Number.isFinite(target) && target > 0 ? target : 540);
    }

    const target = bandwidthMbps >= 12 ? 2160 : bandwidthMbps >= 5 ? 1080 : bandwidthMbps >= 2.5 ? 720 : 540;
    return chooseAtOrBelow(sources, target);
}

export function communityVideoBandwidthMbps(bytes: number, elapsedMs: number, minimumBytes = 32 * 1024) {
    if (!Number.isFinite(bytes) || bytes < minimumBytes || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return null;
    return ((bytes * 8) / elapsedMs / 1000) * 0.75;
}

type MeasureOptions = {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    now?: () => number;
    maxBytes?: number;
    minimumBytes?: number;
};

export async function measureCommunityVideoBandwidth(url: string, options: MeasureOptions = {}) {
    const fetcher = options.fetcher || fetch;
    const maxBytes = options.maxBytes || 256 * 1024;
    const minimumBytes = options.minimumBytes || 32 * 1024;
    const now = options.now || (() => performance.now());
    if (!url || maxBytes <= 0 || minimumBytes <= 0) return null;

    const startedAt = now();
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
        const response = await fetcher(url, {
            headers: { Range: `bytes=0-${maxBytes - 1}` },
            cache: "no-store",
            credentials: "omit",
            signal: options.signal,
        });
        if (!response.ok || !response.body) return null;
        reader = response.body.getReader();
        let bytes = 0;
        while (bytes < maxBytes) {
            const result = await reader.read();
            if (result.done) break;
            bytes += result.value.byteLength;
        }
        const elapsedMs = now() - startedAt;
        if (bytes < minimumBytes) return null;
        return communityVideoBandwidthMbps(bytes, elapsedMs, minimumBytes);
    } catch {
        return null;
    } finally {
        await reader?.cancel().catch(() => undefined);
    }
}
