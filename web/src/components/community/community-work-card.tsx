import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ImageOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CommunityCreatorAvatar } from "@/components/community/community-creator-avatar";
import type { PublicCommunityWork } from "@/services/api/community";

import "./community-work-card.css";

type PublicWork = PublicCommunityWork;

export function CommunityWorkCard({ work, basePath = "/community", onOpen, onViewProcess }: { work: PublicWork; basePath?: string; onOpen?: (work: PublicWork) => void; onViewProcess?: (work: PublicWork) => void }) {
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hovered, setHovered] = useState(false);
    const [coverFailed, setCoverFailed] = useState(false);

    useEffect(() => setCoverFailed(false), [work.coverUrl]);

    const showPreview = () => {
        setHovered(true);
        void videoRef.current?.play().catch(() => setHovered(false));
    };

    const hidePreview = () => {
        setHovered(false);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    const cardContent = (
        <>
            <div className="community-work-card__cover">
                {coverFailed ? (
                    <div className="community-work-card__cover-fallback" aria-label={t("create.home.coverUnavailable")}>
                        <ImageOff aria-hidden="true" />
                        <span>{t("create.home.coverUnavailable")}</span>
                    </div>
                ) : null}
                <img className={coverFailed ? "is-failed" : undefined} src={work.coverUrl} alt="" loading="lazy" onError={() => setCoverFailed(true)} />
                <video ref={videoRef} src={work.videoUrl} muted loop playsInline preload="none" aria-hidden="true" onError={() => setHovered(false)} />
                <div className="community-work-card__cover-shade" />
            </div>
            <div className="community-work-card__body">
                <div className="community-work-card__title-row">
                    <h2>{work.title}</h2>
                    <div className="community-work-card__meta">
                        <span className="community-work-card__creator">
                            <CommunityCreatorAvatar work={work} className="community-work-card__avatar" />
                            <span className="community-work-card__creator-name">{work.creatorName}</span>
                        </span>
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <article className={`community-work-card${hovered ? " is-hovered" : ""}`} onMouseEnter={showPreview} onMouseLeave={hidePreview}>
            {onOpen ? (
                <button type="button" className="community-work-card__link community-work-card__open" aria-label={t("create.home.openWork", { title: work.title })} aria-haspopup="dialog" onClick={() => onOpen(work)}>
                    {cardContent}
                </button>
            ) : (
                <Link to={`${basePath}/${encodeURIComponent(work.id)}`} className="community-work-card__link" aria-label={t("create.home.openWork", { title: work.title })}>
                    {cardContent}
                </Link>
            )}
            {work.publicCanvas && work.canvasUrl && onViewProcess ? (
                <button type="button" className="community-work-card__process" onClick={() => onViewProcess(work)}>
                    {t("create.home.viewProcess")}
                </button>
            ) : null}
        </article>
    );
}
