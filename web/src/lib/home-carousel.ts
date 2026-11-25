import type { JSONContent } from "@tiptap/core";

export type HomeCarouselSlide = {
    id: string;
    enabled: boolean;
    title: string;
    description: string;
    videoUrl: string;
    posterUrl: string;
    altText: string;
    detailEnabled: boolean;
    detailTitle: string;
    detailContent: JSONContent;
    detailButtonLabel: string;
    actionLabel: string;
    actionUrl: string;
};

export type HomeCarouselRegion = "primary" | "banner" | "support";

export type HomeCarouselRegionRefs = {
    primary: string[];
    banner: string[];
    support: string[];
};

export type HomeCarouselConfig = {
    autoplayEnabled: boolean;
    intervalMs: number;
    slides: HomeCarouselSlide[];
    regionRefs: HomeCarouselRegionRefs;
};

export const EMPTY_HOME_CAROUSEL_DOCUMENT: JSONContent = { type: "doc", content: [] };

export const DEFAULT_HOME_CAROUSEL: HomeCarouselConfig = {
    autoplayEnabled: true,
    intervalMs: 6500,
    regionRefs: {
        primary: ["minimax-h3", "director-studio", "fantasy-storytelling"],
        banner: ["seedance-2-5", "fantasy-storytelling", "minimax-h3"],
        support: ["director-studio", "seedance-2-5"],
    },
    slides: [
        {
            id: "minimax-h3",
            enabled: true,
            title: "MiniMax-H3",
            description: "让运动、光线与空间保持同一个叙事方向。",
            videoUrl: "/home-banner/minimax-h3-wide.mp4",
            posterUrl: "/short-drama-styles/cyberpunk-neon.jpg",
            altText: "MiniMax-H3 视频生成推荐",
            detailEnabled: false,
            detailTitle: "",
            detailContent: EMPTY_HOME_CAROUSEL_DOCUMENT,
            detailButtonLabel: "了解详情",
            actionLabel: "开始创作",
            actionUrl: "/create",
        },
        {
            id: "seedance-2-5",
            enabled: true,
            title: "Seedance 2.5",
            description: "把动作、镜头与光线组织成连贯的动态画面。",
            videoUrl: "/home-banner/seedance-2-5-wide.mp4",
            posterUrl: "/short-drama-styles/urban-live-action.jpg",
            altText: "Seedance 2.5 视频生成推荐",
            detailEnabled: false,
            detailTitle: "",
            detailContent: EMPTY_HOME_CAROUSEL_DOCUMENT,
            detailButtonLabel: "了解详情",
            actionLabel: "开始创作",
            actionUrl: "/create",
        },
        {
            id: "director-studio",
            enabled: true,
            title: "导演工作台",
            description: "从人物、空间与光线出发，梳理镜头表达。",
            videoUrl: "/home-banner/director-studio-wide.mp4",
            posterUrl: "/short-drama-styles/suspense-noir.jpg",
            altText: "导演工作台推荐",
            detailEnabled: false,
            detailTitle: "",
            detailContent: EMPTY_HOME_CAROUSEL_DOCUMENT,
            detailButtonLabel: "了解详情",
            actionLabel: "开始创作",
            actionUrl: "/create",
        },
        {
            id: "fantasy-storytelling",
            enabled: true,
            title: "奇幻叙事",
            description: "从一个画面开始，让故事继续向前。",
            videoUrl: "/home-banner/studio-feature-wide.mp4",
            posterUrl: "/short-drama-styles/fantasy-3d.jpg",
            altText: "奇幻视觉创作推荐",
            detailEnabled: false,
            detailTitle: "",
            detailContent: EMPTY_HOME_CAROUSEL_DOCUMENT,
            detailButtonLabel: "了解详情",
            actionLabel: "开始创作",
            actionUrl: "/create",
        },
    ],
};

export function normalizeHomeCarousel(value?: Partial<HomeCarouselConfig> | null): HomeCarouselConfig {
    const slides = Array.isArray(value?.slides) ? value.slides : DEFAULT_HOME_CAROUSEL.slides;
    const slideIds = new Set(slides.map((slide) => slide.id));
    const legacyIds = slides.map((slide) => slide.id);
    const normalizeRefs = (refs: unknown, fallback: string[]) => {
        if (!Array.isArray(refs)) return fallback.filter((id) => slideIds.has(id));
        const seen = new Set<string>();
        return refs.filter((id): id is string => typeof id === "string" && slideIds.has(id) && !seen.has(id) && Boolean(seen.add(id)));
    };
    const configuredRefs = value?.regionRefs;
    const hasConfiguredRefs = Boolean(configuredRefs && (Array.isArray(configuredRefs.primary) || Array.isArray(configuredRefs.banner) || Array.isArray(configuredRefs.support)));
    const primaryFallback = DEFAULT_HOME_CAROUSEL.regionRefs.primary.filter((id) => slideIds.has(id));
    const bannerFallback = DEFAULT_HOME_CAROUSEL.regionRefs.banner.filter((id) => slideIds.has(id));
    const supportFallback = DEFAULT_HOME_CAROUSEL.regionRefs.support.filter((id) => slideIds.has(id));
    return {
        autoplayEnabled: value?.autoplayEnabled !== false,
        intervalMs: Number.isInteger(value?.intervalMs) ? Number(value?.intervalMs) : DEFAULT_HOME_CAROUSEL.intervalMs,
        regionRefs: {
            primary: normalizeRefs(configuredRefs?.primary, hasConfiguredRefs ? legacyIds : primaryFallback.length ? primaryFallback : legacyIds),
            banner: normalizeRefs(configuredRefs?.banner, hasConfiguredRefs ? [] : bannerFallback),
            support: normalizeRefs(configuredRefs?.support, hasConfiguredRefs ? [] : supportFallback),
        },
        slides: slides.map((slide, index) => ({
            ...DEFAULT_HOME_CAROUSEL.slides[index % DEFAULT_HOME_CAROUSEL.slides.length],
            ...slide,
            detailContent: isDocument(slide?.detailContent) ? structuredClone(slide.detailContent) : structuredClone(EMPTY_HOME_CAROUSEL_DOCUMENT),
        })),
    };
}

export function homeCarouselDocumentHasContent(document?: JSONContent | null) {
    const visit = (node?: JSONContent): boolean => Boolean(node && ((typeof node.text === "string" && node.text.trim()) || node.content?.some(visit)));
    return Boolean(document?.content?.some(visit));
}

function isDocument(value: unknown): value is JSONContent {
    return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as JSONContent).type === "doc");
}
