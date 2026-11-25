import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type UIEvent as ReactUIEvent } from "react";
import { ArrowUp, Search } from "lucide-react";
import { useNavigate } from "react-router";
import { useReducedMotion } from "motion/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { CommunityCategoryTabs } from "@/components/community/community-category-tabs";
import { CommunityCanvasPreviewModal } from "@/components/community/community-canvas-preview-modal";
import { CommunityWorkDetailModal } from "@/components/community/community-work-detail-modal";
import { CommunityPublishButton } from "@/components/community/community-publish-button";
import { CommunityWorkCard } from "@/components/community/community-work-card";
import { StudioFeaturedSkills } from "@/components/home/studio-project-grid";
import { StudioHeroBanner } from "@/components/home/studio-hero-banner";
import { HomeCreationComposer, type HomeCreationLaunchState } from "@/components/home/home-creation-composer";
import { CreationRecentCanvases } from "@/pages/create/creation-recent-canvases";
import { getCommunityWorks, type PublicCommunityWork } from "@/services/api/community";
import { getPublicHomeCarousel } from "@/services/api/home-carousel";
import { DEFAULT_HOME_CAROUSEL } from "@/lib/home-carousel";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { useUserStore } from "@/stores/use-user-store";
import { useAuthEntry } from "@/hooks/use-auth-entry";
import "@/pages/studio-home.css";

const PROMPT_FLOW_PATHS = [
    "M -80 96 H 120 L 168 54 H 330 L 374 96 H 520 L 565 142 H 730 L 775 96 H 930 L 976 54 H 1280",
    "M -60 220 H 180 L 220 260 H 390 L 430 220 H 590 L 640 166 H 790 L 834 220 H 1020 L 1064 268 H 1260",
    "M -120 384 H 90 L 136 334 H 310 L 354 384 H 490 L 534 430 H 700 L 742 384 H 900 L 946 334 H 1240",
    "M -80 520 H 220 L 262 478 H 410 L 454 520 H 620 L 662 560 H 820 L 866 520 H 1020 L 1068 478 H 1280",
] as const;

export default function StudioHomePage() {
    const navigate = useNavigate();
    const { openAuth } = useAuthEntry();
    const reducedMotion = useReducedMotion();
    const { t } = useTranslation();
    const brandName = useAppearanceStore((state) => state.appearance.brandName);
    const userId = useUserStore((state) => state.user?.id);
    const promptRef = useRef<HTMLTextAreaElement>(null);
    const promptFlowRippleRef = useRef<SVGSVGElement>(null);
    const promptFlowSpotlightFrameRef = useRef<number | null>(null);
    const promptFlowRippleFrameRef = useRef<number | null>(null);
    const homePageRef = useRef<HTMLElement>(null);
    const communityLoadMoreRef = useRef<HTMLDivElement>(null);
    const [prompt, setPrompt] = useState("");
    const [keyword, setKeyword] = useState("");
    const [debouncedKeyword, setDebouncedKeyword] = useState("");
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [activeCommunityCategory, setActiveCommunityCategory] = useState("all");
    const [canvasWork, setCanvasWork] = useState<PublicCommunityWork | null>(null);
    const [detailWork, setDetailWork] = useState<PublicCommunityWork | null>(null);
    const communityWorksQuery = useInfiniteQuery({
        queryKey: ["public-community-works", "home", activeCommunityCategory, debouncedKeyword],
        queryFn: ({ pageParam, signal }) =>
            getCommunityWorks(
                {
                    pageSize: 10,
                    categoryId: activeCommunityCategory === "all" ? undefined : activeCommunityCategory,
                    keyword: debouncedKeyword || undefined,
                    cursor: pageParam || undefined,
                },
                { signal },
            ),
        initialPageParam: "",
        getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
        staleTime: 30_000,
    });
    const homeCarouselQuery = useQuery({ queryKey: ["public-home-carousel"], queryFn: getPublicHomeCarousel, staleTime: 60_000 });
    const homeCarousel = homeCarouselQuery.data?.homeCarousel || DEFAULT_HOME_CAROUSEL;

    useEffect(
        () => () => {
            if (promptFlowSpotlightFrameRef.current !== null) cancelAnimationFrame(promptFlowSpotlightFrameRef.current);
            if (promptFlowRippleFrameRef.current !== null) cancelAnimationFrame(promptFlowRippleFrameRef.current);
        },
        [],
    );

    const communityWorks = communityWorksQuery.data?.pages.flatMap((page) => page.works) || [];

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 250);
        return () => window.clearTimeout(timer);
    }, [keyword]);

    useEffect(() => {
        const root = homePageRef.current;
        const target = communityLoadMoreRef.current;
        if (!root || !target || !communityWorksQuery.hasNextPage || communityWorksQuery.isFetchingNextPage || communityWorksQuery.isFetchNextPageError || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) void communityWorksQuery.fetchNextPage();
            },
            { root, rootMargin: "420px 0px" },
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [communityWorksQuery.fetchNextPage, communityWorksQuery.hasNextPage, communityWorksQuery.isFetchNextPageError, communityWorksQuery.isFetchingNextPage]);

    const startCreation = (launch: HomeCreationLaunchState) => {
        navigate("/create", { state: launch });
    };

    const movePromptSpotlight = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.pointerType === "touch") return;
        const section = event.currentTarget;
        const { clientX, clientY } = event;
        if (promptFlowSpotlightFrameRef.current !== null) cancelAnimationFrame(promptFlowSpotlightFrameRef.current);
        promptFlowSpotlightFrameRef.current = requestAnimationFrame(() => {
            promptFlowSpotlightFrameRef.current = null;
            const bounds = section.getBoundingClientRect();
            section.style.setProperty("--flow-light-x", `${clientX - bounds.left}px`);
            section.style.setProperty("--flow-light-y", `${clientY - bounds.top}px`);
            section.dataset.flowSpotlight = "active";
        });
    };

    const hidePromptSpotlight = (event: ReactPointerEvent<HTMLElement>) => {
        if (promptFlowSpotlightFrameRef.current !== null) cancelAnimationFrame(promptFlowSpotlightFrameRef.current);
        promptFlowSpotlightFrameRef.current = null;
        delete event.currentTarget.dataset.flowSpotlight;
    };

    const pulsePromptFlow = (event: ReactMouseEvent<HTMLElement>) => {
        if (event.button !== 0 || event.detail === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        if (event.target instanceof Element && event.target.closest("button, a, input, textarea, [contenteditable], .creation-home, .ant-modal-root, .ant-dropdown, .ant-select-dropdown, .ant-popover")) return;
        const layer = promptFlowRippleRef.current;
        if (!layer) return;
        if (promptFlowRippleFrameRef.current !== null) cancelAnimationFrame(promptFlowRippleFrameRef.current);
        const bounds = event.currentTarget.getBoundingClientRect();
        layer.style.setProperty("--flow-ripple-x", `${event.clientX - bounds.left}px`);
        layer.style.setProperty("--flow-ripple-y", `${event.clientY - bounds.top}px`);
        const startedAt = performance.now();
        const animate = (now: number) => {
            const progress = Math.min((now - startedAt) / 720, 1);
            const eased = 1 - (1 - progress) ** 2;
            layer.style.setProperty("--flow-ripple-radius", `${20 + eased * 280}px`);
            layer.style.opacity = `${(1 - progress) * 0.85}`;
            promptFlowRippleFrameRef.current = progress < 1 ? requestAnimationFrame(animate) : null;
        };
        promptFlowRippleFrameRef.current = requestAnimationFrame(animate);
    };

    const handleHomeScroll = (event: ReactUIEvent<HTMLElement>) => {
        const visible = event.currentTarget.scrollTop > 520;
        setShowScrollTop((current) => (current === visible ? current : visible));
    };

    return (
        <main ref={homePageRef} className="home-page hide-scrollbar" onScroll={handleHomeScroll}>
            <div className="home-page__content">
                <section
                    className="home-prompt-section home-command-center"
                    aria-labelledby="home-prompt-title"
                    onPointerEnter={movePromptSpotlight}
                    onPointerMove={movePromptSpotlight}
                    onPointerLeave={hidePromptSpotlight}
                    onPointerCancel={hidePromptSpotlight}
                    onClick={pulsePromptFlow}
                    data-motion={reducedMotion ? "reduced" : "full"}
                >
                    <svg className="home-prompt-section__flow-lines" viewBox="0 0 1200 640" preserveAspectRatio="none" aria-hidden="true">
                        <g className="home-prompt-section__flow-base">
                            {PROMPT_FLOW_PATHS.map((path) => (
                                <path key={`base-${path}`} d={path} pathLength="1" />
                            ))}
                        </g>
                        <g className="home-prompt-section__flow-motion">
                            {PROMPT_FLOW_PATHS.map((path) => (
                                <path key={`motion-${path}`} d={path} pathLength="1" />
                            ))}
                        </g>
                    </svg>
                    <svg className="home-prompt-section__flow-focus" viewBox="0 0 1200 640" preserveAspectRatio="none" aria-hidden="true">
                        <g>
                            {PROMPT_FLOW_PATHS.map((path) => (
                                <path key={`focus-${path}`} d={path} pathLength="1" />
                            ))}
                        </g>
                    </svg>
                    <svg ref={promptFlowRippleRef} className="home-prompt-section__flow-ripple" viewBox="0 0 1200 640" preserveAspectRatio="none" aria-hidden="true">
                        <g>
                            {PROMPT_FLOW_PATHS.map((path) => (
                                <path key={`ripple-${path}`} d={path} pathLength="1" />
                            ))}
                        </g>
                    </svg>
                    <p className="home-prompt-section__eyebrow">{t("create.home.capabilityLine")}</p>
                    <h2 id="home-prompt-title">{t("create.home.promptTitle")}</h2>
                    <HomeCreationComposer prompt={prompt} onPromptChange={setPrompt} promptRef={promptRef} onStart={startCreation} />
                    <StudioFeaturedSkills />
                    {userId ? <CreationRecentCanvases onRequireLogin={() => openAuth()} /> : null}
                </section>

                <StudioHeroBanner brandName={brandName} config={homeCarousel} />

                <section className="home-inspirations" aria-labelledby="home-inspirations-title">
                    <div className="home-section-heading">
                        <h2 id="home-inspirations-title">{t("create.home.communityTitle")}</h2>
                        <div className="home-section-heading__links">
                            <label className="home-inspiration-search">
                                <Search aria-hidden="true" />
                                <span className="sr-only">{t("create.home.communitySearchLabel")}</span>
                                <input type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={t("create.home.communitySearchPlaceholder")} />
                            </label>
                            <CommunityPublishButton className="home-section-publish-button" />
                        </div>
                    </div>
                    <div className="home-inspiration-categories">
                        <CommunityCategoryTabs activeCategory={activeCommunityCategory} onChange={setActiveCommunityCategory} />
                    </div>
                    {communityWorksQuery.isLoading ? (
                        <p className="home-inspiration-empty" role="status">
                            {t("create.home.loadingCommunity")}
                        </p>
                    ) : communityWorksQuery.isError ? (
                        <div className="home-inspiration-empty" role="status">
                            <span>{t("create.home.communityLoadError")}</span>
                            <button type="button" onClick={() => void communityWorksQuery.refetch()}>
                                {t("create.home.retry")}
                            </button>
                        </div>
                    ) : communityWorks.length === 0 ? (
                        <div className="home-inspiration-empty" role="status">
                            <span>{debouncedKeyword ? t("create.home.noMatchingCommunity") : activeCommunityCategory !== "all" ? t("create.home.noCategoryCommunity") : t("create.home.noApprovedCommunity")}</span>
                        </div>
                    ) : null}
                    {!communityWorksQuery.isLoading && !communityWorksQuery.isError && communityWorks.length ? (
                        <div className="home-inspiration-grid">
                            {communityWorks.map((work) => (
                                <CommunityWorkCard key={work.id} work={work} onOpen={setDetailWork} onViewProcess={setCanvasWork} />
                            ))}
                        </div>
                    ) : null}
                    {communityWorksQuery.isFetchNextPageError ? (
                        <div className="home-inspiration-feed-status" role="status">
                            <span>{t("create.home.loadMoreError")}</span>
                            <button type="button" onClick={() => void communityWorksQuery.fetchNextPage()}>
                                {t("create.home.retry")}
                            </button>
                        </div>
                    ) : communityWorksQuery.isFetchingNextPage ? (
                        <p className="home-inspiration-feed-status" role="status">
                            {t("create.home.loadingMore")}
                        </p>
                    ) : communityWorksQuery.hasNextPage ? (
                        typeof IntersectionObserver === "undefined" ? (
                            <div className="home-inspiration-feed-status">
                                <button type="button" onClick={() => void communityWorksQuery.fetchNextPage()}>
                                    {t("create.home.loadMore")}
                                </button>
                            </div>
                        ) : null
                    ) : communityWorks.length ? (
                        <p className="home-inspiration-feed-status" role="status">
                            {t("create.home.feedEnd")}
                        </p>
                    ) : null}
                    {communityWorksQuery.hasNextPage ? <div ref={communityLoadMoreRef} className="home-inspiration-load-sentinel" aria-hidden="true" /> : null}
                </section>
            </div>
            {showScrollTop ? (
                <button type="button" className="home-scroll-to-top" aria-label={t("create.home.scrollTop")} title={t("create.home.scrollTop")} onClick={() => homePageRef.current?.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" })}>
                    <ArrowUp aria-hidden="true" />
                </button>
            ) : null}
            <CommunityCanvasPreviewModal work={canvasWork} onClose={() => setCanvasWork(null)} />
            <CommunityWorkDetailModal work={detailWork} onClose={() => setDetailWork(null)} onSelectWork={setDetailWork} />
        </main>
    );
}
