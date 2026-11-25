import { useEffect, useMemo, useRef, useState } from "react";
import { AppModal } from "@/components/ui/product/app-modal";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Grid2X2, Heart, Play, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CommunityCreatorAvatar } from "@/components/community/community-creator-avatar";
import { CommunityVideoPlayer } from "@/components/community-video-player";
import { getCommunityWorks, type PublicCommunityWork } from "@/services/api/community";

import "@/pages/community/community-pages.css";
import "./community-work-detail-modal.css";

type CommunityWorkDetailModalProps = {
    work: PublicCommunityWork | null;
    onClose: () => void;
    onSelectWork?: (work: PublicCommunityWork) => void;
};

export function CommunityWorkDetailModal({ work, onClose, onSelectWork }: CommunityWorkDetailModalProps) {
    const { t } = useTranslation();
    const [liked, setLiked] = useState(false);
    const [shared, setShared] = useState(false);
    const [playRequest, setPlayRequest] = useState(0);
    const railRef = useRef<HTMLDivElement>(null);
    const relatedQuery = useQuery({
        queryKey: ["public-community-work-related", work?.categoryId || "all", work?.id],
        queryFn: () => getCommunityWorks({ categoryId: work?.categoryId, pageSize: 48 }),
        enabled: Boolean(work),
        staleTime: 30_000,
    });

    useEffect(() => {
        setLiked(false);
        setShared(false);
        setPlayRequest(0);
    }, [work?.id]);

    const relatedWorks = useMemo(() => relatedQuery.data?.works?.slice(0, 14) || [], [relatedQuery.data?.works]);

    const handleShare = async () => {
        if (!work) return;
        const shareUrl = new URL(`/linghua/community/${encodeURIComponent(work.id)}`, window.location.origin).href;
        try {
            if (navigator.share) await navigator.share({ title: work.title, url: shareUrl });
            else await navigator.clipboard.writeText(shareUrl);
            setShared(true);
            window.setTimeout(() => setShared(false), 1800);
        } catch {
            // Sharing can be cancelled by the browser without affecting playback.
        }
    };

    const scrollRail = (direction: -1 | 1) => {
        railRef.current?.scrollBy({ left: direction * 300, behavior: "smooth" });
    };

    return (
        <AppModal open={Boolean(work)} onCancel={onClose} footer={null} closable={false} centered width="100vw" rootClassName="community-detail-modal" flush>
            {work ? (
                <div className="community-detail-modal__page">
                    <div className="community-detail">
                        <header className="community-detail__topbar">
                            <button type="button" className="community-detail__back" onClick={onClose} aria-label={t("create.home.closeDetails")}>
                                <ArrowLeft aria-hidden="true" />
                                {t("create.home.back")}
                            </button>
                            <div className="community-detail__identity">
                                <CommunityCreatorAvatar work={work} className="community-detail__identity-avatar" />
                                <div>
                                    <strong>{work.creatorName}</strong>
                                    <span>{work.title}</span>
                                </div>
                            </div>
                        </header>

                        <section className="community-detail__showcase" aria-label={t("create.home.showcase")}>
                            <div className="community-detail__stage">
                                <CommunityVideoPlayer src={work.videoUrl} poster={work.coverUrl} sources={work.videoSources} title={work.title} playRequest={playRequest} />
                            </div>
                            <nav className="community-detail__action-bar" aria-label={t("create.home.workActions")}>
                                <button type="button" className="community-detail__watch" onClick={() => setPlayRequest((value) => value + 1)}>
                                    <Play aria-hidden="true" />
                                    {t("create.home.watchNow")}
                                </button>
                                {work.publicCanvas && work.canvasUrl ? (
                                    <a className="community-detail__toolbar-action" href={work.canvasUrl} target="_blank" rel="noreferrer noopener">
                                        <Grid2X2 aria-hidden="true" />
                                        {t("create.home.viewProcess")}
                                    </a>
                                ) : null}
                                <span className="community-detail__toolbar-divider" aria-hidden="true" />
                                <button
                                    type="button"
                                    className={`community-detail__toolbar-icon${liked ? " is-active" : ""}`}
                                    aria-label={liked ? t("create.home.unlike") : t("create.home.like")}
                                    aria-pressed={liked}
                                    onClick={() => setLiked((value) => !value)}
                                    title={liked ? t("create.home.unlike") : t("create.home.like")}
                                >
                                    <Heart aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    className="community-detail__toolbar-icon"
                                    aria-label={shared ? t("create.home.linkCopied") : t("create.home.share")}
                                    onClick={() => void handleShare()}
                                    title={shared ? t("create.home.linkCopied") : t("create.home.share")}
                                >
                                    <Share2 aria-hidden="true" />
                                </button>
                            </nav>
                        </section>

                        {relatedWorks.length ? (
                            <section className="community-detail__rail" aria-label={t("create.home.switchWorks")}>
                                <div className="community-detail__rail-nav">
                                    <button type="button" className="community-detail__rail-control" aria-label={t("create.home.previousWorks")} onClick={() => scrollRail(-1)}>
                                        <ChevronLeft aria-hidden="true" />
                                    </button>
                                    <div ref={railRef} className="community-detail__rail-track">
                                        {relatedWorks.map((item) => (
                                            <button
                                                type="button"
                                                key={item.id}
                                                className={`community-detail__rail-item${item.id === work.id ? " is-active" : ""}`}
                                                aria-label={t("create.home.openWork", { title: item.title })}
                                                aria-current={item.id === work.id ? "page" : undefined}
                                                onClick={() => onSelectWork?.(item)}
                                            >
                                                <img src={item.coverUrl} alt="" loading="lazy" />
                                                <span>{item.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <button type="button" className="community-detail__rail-control" aria-label={t("create.home.nextWorks")} onClick={() => scrollRail(1)}>
                                        <ChevronRight aria-hidden="true" />
                                    </button>
                                </div>
                            </section>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </AppModal>
    );
}
