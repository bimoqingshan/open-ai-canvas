import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/components/ui/product/app-modal";
import { HomeCarouselRichText, safeHomeCarouselHref } from "@/components/home/home-carousel-rich-text";
import { DEFAULT_HOME_CAROUSEL, homeCarouselDocumentHasContent, type HomeCarouselConfig, type HomeCarouselSlide } from "@/lib/home-carousel";

const DEFAULT_INTERVAL_MS = 6500;

type RegionCarousel = {
    currentIndex: number;
    progress: number;
    select: (index: number) => void;
};

function useRegionCarousel(slides: HomeCarouselSlide[], autoplayEnabled: boolean, intervalMs: number, paused: boolean): RegionCarousel {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [timerToken, setTimerToken] = useState(0);
    const elapsedRef = useRef(0);
    const runStartedAtRef = useRef<number | null>(null);
    const runRevisionRef = useRef(0);
    const safeIntervalMs = Number.isInteger(intervalMs) && intervalMs >= 3000 && intervalMs <= 15000 ? intervalMs : DEFAULT_INTERVAL_MS;

    useEffect(() => {
        if (currentIndex < slides.length) return;
        setCurrentIndex(0);
        elapsedRef.current = 0;
        setProgress(0);
    }, [currentIndex, slides.length]);

    const isPaused = paused || !autoplayEnabled || slides.length < 2;
    useEffect(() => {
        if (isPaused) return;
        const version = runRevisionRef.current;
        const startedAt = performance.now();
        runStartedAtRef.current = startedAt;
        const timer = window.setInterval(() => {
            const elapsed = elapsedRef.current + performance.now() - startedAt;
            if (elapsed >= safeIntervalMs) {
                window.clearInterval(timer);
                elapsedRef.current = 0;
                runStartedAtRef.current = null;
                setProgress(0);
                setCurrentIndex((current) => (current + 1) % slides.length);
                return;
            }
            setProgress(Math.max(0, elapsed / safeIntervalMs));
        }, 60);
        return () => {
            window.clearInterval(timer);
            if (runRevisionRef.current === version && runStartedAtRef.current === startedAt) {
                elapsedRef.current = Math.min(safeIntervalMs, elapsedRef.current + performance.now() - startedAt);
                runStartedAtRef.current = null;
            }
        };
    }, [currentIndex, isPaused, safeIntervalMs, slides.length, timerToken]);

    const select = (index: number) => {
        if (!slides.length) return;
        runRevisionRef.current += 1;
        runStartedAtRef.current = null;
        elapsedRef.current = 0;
        setProgress(0);
        setCurrentIndex((index + slides.length) % slides.length);
        setTimerToken((current) => current + 1);
    };

    return { currentIndex, progress, select };
}

export function StudioHeroBanner({ brandName, config }: { brandName: string; config: HomeCarouselConfig }) {
    const { t } = useTranslation();
    const slides = useMemo(
        () =>
            config.slides
                .filter((item) => item.enabled)
                .map((item) => {
                    const defaults = DEFAULT_HOME_CAROUSEL.slides.find((slide) => slide.id === item.id);
                    if (!defaults) return item;
                    const translations: Record<string, { title?: string; description: string; altText: string }> = {
                        "minimax-h3": { description: t("create.home.slideMinimaxDescription"), altText: t("create.home.slideMinimaxAlt") },
                        "seedance-2-5": { description: t("create.home.slideSeedanceDescription"), altText: t("create.home.slideSeedanceAlt") },
                        "director-studio": { title: t("create.home.slideDirectorTitle"), description: t("create.home.slideDirectorDescription"), altText: t("create.home.slideDirectorAlt") },
                        "fantasy-storytelling": { title: t("create.home.slideFantasyTitle"), description: t("create.home.slideFantasyDescription"), altText: t("create.home.slideFantasyAlt") },
                    };
                    const translated = translations[item.id];
                    if (!translated) return item;
                    return {
                        ...item,
                        title: item.title === defaults.title ? translated.title || item.title : item.title,
                        description: item.description === defaults.description ? translated.description : item.description,
                        altText: item.altText === defaults.altText ? translated.altText : item.altText,
                        detailButtonLabel: item.detailButtonLabel === defaults.detailButtonLabel ? t("create.home.heroDetails") : item.detailButtonLabel,
                        actionLabel: item.actionLabel === defaults.actionLabel ? t("create.composer.startCreating") : item.actionLabel,
                    };
                }),
        [config.slides, t],
    );
    const slidesById = useMemo(() => new Map(slides.map((item) => [item.id, item])), [slides]);
    const regionSlides = useMemo(() => {
        const resolve = (ids: string[], fallback: HomeCarouselSlide[]) => {
            const resolved = ids.map((id) => slidesById.get(id)).filter((item): item is HomeCarouselSlide => Boolean(item));
            return resolved.length ? resolved : fallback;
        };
        return {
            primary: resolve(config.regionRefs.primary, slides),
            banner: resolve(config.regionRefs.banner, slides.slice(1)),
            support: resolve(config.regionRefs.support, slides.slice(2)),
        };
    }, [config.regionRefs, slides, slidesById]);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [pageHidden, setPageHidden] = useState(false);
    const [detailSlide, setDetailSlide] = useState<HomeCarouselSlide | null>(null);
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        const updateVisibility = () => setPageHidden(document.hidden);
        updateVisibility();
        document.addEventListener("visibilitychange", updateVisibility);
        return () => document.removeEventListener("visibilitychange", updateVisibility);
    }, []);

    const paused = hovered || focused || pageHidden || Boolean(detailSlide) || reducedMotion === true;
    const primaryCarousel = useRegionCarousel(regionSlides.primary, config.autoplayEnabled, config.intervalMs, paused);
    const bannerCarousel = useRegionCarousel(regionSlides.banner, config.autoplayEnabled, config.intervalMs, paused);
    const primarySlide = regionSlides.primary[primaryCarousel.currentIndex];
    const bannerSlide = regionSlides.banner[bannerCarousel.currentIndex];
    const supportSlides = regionSlides.support.slice(0, 2);

    const renderAction = (target: HomeCarouselSlide, className: string, label: string) => {
        const href = safeHomeCarouselHref(target.actionUrl);
        if (!href || !label) return null;
        const external = /^https:\/\//i.test(href);
        const content = (
            <>
                {label}
                <ArrowRight aria-hidden="true" />
            </>
        );
        if (external)
            return (
                <a className={className} href={href} target="_blank" rel="noopener noreferrer">
                    {content}
                </a>
            );
        return (
            <Link className={className} to={href}>
                {content}
            </Link>
        );
    };

    const renderDots = (items: HomeCarouselSlide[], carousel: RegionCarousel, label: string, className = "") =>
        items.length > 1 ? (
            <div className={`home-hero__dots ${className}`} role="group" aria-label={label}>
                {items.map((item, index) => (
                    <button
                        key={item.id}
                        type="button"
                        aria-label={`${label} ${index + 1}: ${item.title}`}
                        aria-pressed={index === carousel.currentIndex}
                        onClick={(event) => {
                            event.stopPropagation();
                            carousel.select(index);
                        }}
                    >
                        <span className="home-hero__dot-track" aria-hidden="true">
                            <span style={{ transform: `scaleX(${index === carousel.currentIndex ? carousel.progress : 0})` }} />
                        </span>
                    </button>
                ))}
            </div>
        ) : null;

    const renderMosaicCard = (item: HomeCarouselSlide, index: number, variant: "main" | "banner" | "support", activeId: string | undefined, onSelect: (index: number) => void) => {
        const itemVideo = safeHomeCarouselHref(item.videoUrl);
        const itemPoster = safeHomeCarouselHref(item.posterUrl);
        const isMain = variant === "main";
        const itemHasDetail = Boolean(item.detailEnabled && homeCarouselDocumentHasContent(item.detailContent));
        return (
            <article
                className={`home-hero__mosaic-card home-hero__mosaic-card--${variant}`}
                data-active={item.id === activeId}
                key={`${item.id}-${index}`}
                role="listitem"
                tabIndex={0}
                aria-label={item.title}
                onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest("a,button")) return;
                    onSelect(index);
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(index);
                    }
                }}
            >
                <div className="home-hero__mosaic-media" aria-hidden="true">
                    {isMain && !reducedMotion && itemVideo ? (
                        <motion.video key={item.id} src={itemVideo} poster={itemPoster || undefined} autoPlay loop muted playsInline preload="metadata" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.55 }} />
                    ) : (
                        <motion.img key={item.id} src={itemPoster || undefined} alt="" initial={false} animate={{ opacity: 1 }} />
                    )}
                </div>
                {isMain ? renderDots(regionSlides.primary, primaryCarousel, t("create.home.heroMainLabel"), "home-hero__dots--primary") : null}
                <div className="home-hero__mosaic-shade" aria-hidden="true" />
                <div className="home-hero__content" key={`${item.id}-content`}>
                    <span className="home-hero__eyebrow">{isMain ? t("create.home.heroCanvas") : variant === "banner" ? t("create.home.heroEvent") : t("create.home.heroTutorial")}</span>
                    <h1>{item.title}</h1>
                    <p>{item.description}</p>
                    {isMain && (itemHasDetail || item.actionLabel) ? (
                        itemHasDetail ? (
                            <button
                                className="home-hero__action"
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setDetailSlide(item);
                                }}
                            >
                                {item.detailButtonLabel || t("create.home.heroDetails")}
                                <ArrowRight aria-hidden="true" />
                            </button>
                        ) : (
                            renderAction(item, "home-hero__action", item.actionLabel)
                        )
                    ) : null}
                </div>
            </article>
        );
    };

    if (!primarySlide && !bannerSlide && supportSlides.length === 0) return null;

    return (
        <>
            <section
                className="home-hero home-hero--mosaic"
                data-paused={paused}
                aria-label={`${brandName}${t("create.home.heroSectionLabel")}`}
                aria-roledescription={t("create.home.heroCarouselLabel")}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onFocus={() => setFocused(true)}
                onBlur={(event) => setFocused(Boolean(event.relatedTarget && event.currentTarget.contains(event.relatedTarget as Node)))}
                onKeyDown={(event) => {
                    if (event.key === "ArrowLeft") primaryCarousel.select(primaryCarousel.currentIndex - 1);
                    if (event.key === "ArrowRight") primaryCarousel.select(primaryCarousel.currentIndex + 1);
                }}
            >
                <header className="home-hero__heading">
                    <div className="home-hero__heading-copy">
                        <h2>{t("create.home.heroTitle")}</h2>
                        <span>{t("create.home.heroSubtitle")}</span>
                    </div>
                    <Link className="home-section-link" to="/create">
                        {t("create.home.heroLearn")}
                        <ArrowRight aria-hidden="true" />
                    </Link>
                </header>
                <div className="home-hero__mosaic" role="list" aria-label={t("create.home.heroSectionLabel")}>
                    {primarySlide ? renderMosaicCard(primarySlide, primaryCarousel.currentIndex, "main", primarySlide.id, primaryCarousel.select) : null}
                    <div className="home-hero__mosaic-side">
                        <div className="home-hero__mosaic-banner-wrap">
                            {bannerSlide ? renderMosaicCard(bannerSlide, bannerCarousel.currentIndex, "banner", bannerSlide.id, bannerCarousel.select) : null}
                            {renderDots(regionSlides.banner, bannerCarousel, t("create.home.heroBannerLabel"))}
                        </div>
                        <div className="home-hero__mosaic-bottom">{supportSlides.map((item, index) => renderMosaicCard(item, index, "support", undefined, () => undefined))}</div>
                    </div>
                </div>
            </section>

            <AppModal
                open={Boolean(detailSlide)}
                title={detailSlide?.detailTitle || detailSlide?.title || t("create.home.heroDetailTitle")}
                centered
                footer={null}
                width="min(820px, calc(100vw - 32px))"
                className="home-carousel-detail-modal"
                onCancel={() => setDetailSlide(null)}
                flush
            >
                {detailSlide ? (
                    <div className="home-carousel-detail">
                        {safeHomeCarouselHref(detailSlide.posterUrl) ? <img className="home-carousel-detail__image" src={safeHomeCarouselHref(detailSlide.posterUrl)} alt={detailSlide.altText} /> : null}
                        <div className="home-carousel-detail__body">
                            <HomeCarouselRichText document={detailSlide.detailContent} />
                            {renderAction(detailSlide, "home-carousel-detail__action", detailSlide.actionLabel)}
                        </div>
                    </div>
                ) : null}
            </AppModal>
        </>
    );
}
