import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Grid2X2, Heart, Play, Search, Share2, Trophy } from "lucide-react";
import { Tag } from "antd";
import { Link, useParams } from "react-router";

import { CommunityCreatorAvatar } from "@/components/community/community-creator-avatar";
import { CommunityCategoryTabs } from "@/components/community/community-category-tabs";
import { CommunityCanvasPreviewModal } from "@/components/community/community-canvas-preview-modal";
import { CommunityPublishButton } from "@/components/community/community-publish-button";
import { CommunityWorkCard } from "@/components/community/community-work-card";
import { getCommunityWork, getCommunityWorks, getCreatorChallenges, getMyCommunityWorks, type CreatorChallenge } from "@/services/api/community";
import { CommunityVideoPlayer } from "@/components/community-video-player";
import "./community-pages.css";

type PublicWork = NonNullable<Awaited<ReturnType<typeof getCommunityWorks>>["works"]>[number];

export function TvShowPage() {
    return <CommunityWorksListing title="社区作品" eyebrow="社区频道" description="发现社区创作者正在放映的作品" basePath="/linghua/community" />;
}

function CommunityWorksListing({ title, eyebrow, description, basePath }: { title: string; eyebrow: string; description: string; basePath: string }) {
    const [keyword, setKeyword] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [canvasWork, setCanvasWork] = useState<PublicWork | null>(null);
    const query = useQuery({ queryKey: ["public-community-works", "page", keyword, activeCategory], queryFn: () => getCommunityWorks({ keyword, categoryId: activeCategory === "all" ? undefined : activeCategory, pageSize: 48 }), staleTime: 30_000 });
    const visibleWorks = query.data?.works || [];
    const isTvShow = basePath === "/linghua/community";
    return (
        <main className={`community-page${isTvShow ? " community-page--tv-show" : ""}`}>
            <div className="community-page__inner">
                <header className={`community-page__heading community-page__heading--gallery${isTvShow ? " community-page__heading--tv-show" : ""}`}>
                    {isTvShow ? (
                        <h1>{title}</h1>
                    ) : (
                        <>
                            <div className="community-page__heading-copy">
                                <span>{eyebrow} / 01</span>
                                <h1>{title}</h1>
                                <p>{description}，按活动和赛道浏览正在发生的创作。</p>
                            </div>
                            <div className="community-page__header-actions">
                                <Link to="/linghua/community/mine" className="community-page__header-link">
                                    我的投稿 <ArrowRight aria-hidden="true" />
                                </Link>
                                <Link to="/linghua/challenges" className="community-page__header-link">
                                    <Trophy aria-hidden="true" /> 活动赛事 <ArrowRight aria-hidden="true" />
                                </Link>
                            </div>
                        </>
                    )}
                </header>
                <div className="community-page__toolbar">
                    <CommunityCategoryTabs activeCategory={activeCategory} onChange={setActiveCategory} />
                    <div className="community-page__toolbar-actions">
                        <label className="community-page__search">
                            <Search aria-hidden="true" />
                            <span className="sr-only">搜索社区作品</span>
                            <input type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={isTvShow ? "搜索作品" : "搜索作品、创作者或活动"} />
                        </label>
                        {isTvShow ? <CommunityPublishButton className="community-page__publish-button" /> : null}
                    </div>
                </div>
                {!isTvShow ? (
                    <div className="community-page__results-meta">
                        <span>{visibleWorks.length} 件公开作品</span>
                    </div>
                ) : null}
                {query.isLoading ? (
                    <div className="community-works-grid">
                        {Array.from({ length: 8 }, (_, index) => (
                            <div className="community-work-skeleton" key={index} />
                        ))}
                    </div>
                ) : query.isError ? (
                    <button type="button" className="community-page__state" onClick={() => void query.refetch()}>
                        加载失败，点击重试
                    </button>
                ) : visibleWorks.length ? (
                    <div className="community-works-grid">
                        {visibleWorks.map((work) => (
                            <CommunityWorkCard key={work.id} work={work} basePath={basePath} onViewProcess={setCanvasWork} />
                        ))}
                    </div>
                ) : (
                    <p className="community-page__state">当前分类暂时没有已审核通过的作品</p>
                )}
            </div>
            <CommunityCanvasPreviewModal work={canvasWork} onClose={() => setCanvasWork(null)} />
        </main>
    );
}

export function CommunityWorkDetailPage() {
    const { id = "" } = useParams();
    const basePath = "/linghua/community";
    const query = useQuery({ queryKey: ["public-community-work", id], queryFn: () => getCommunityWork(id), enabled: Boolean(id), staleTime: 30_000 });
    const work = query.data?.work;
    const relatedQuery = useQuery({
        queryKey: ["public-community-work-related", work?.categoryId || "all", id],
        queryFn: () => getCommunityWorks({ categoryId: work?.categoryId, pageSize: 48 }),
        enabled: Boolean(work),
        staleTime: 30_000,
    });
    const [liked, setLiked] = useState(false);
    const [shared, setShared] = useState(false);
    const [playRequest, setPlayRequest] = useState(0);
    const railRef = useRef<HTMLDivElement>(null);
    const handleShare = async () => {
        if (!work) return;
        const shareUrl = window.location.href;
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
    useEffect(() => {
        const documentElementOverflow = document.documentElement.style.overflow;
        const bodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        return () => {
            document.documentElement.style.overflow = documentElementOverflow;
            document.body.style.overflow = bodyOverflow;
        };
    }, []);
    if (query.isLoading)
        return (
            <main className="community-page">
                <p className="community-page__state">正在加载作品…</p>
            </main>
        );
    if (query.isError || !work)
        return (
            <main className="community-page">
                <div className="community-page__inner">
                    <Link to="/" className="community-back-link">
                        <ArrowLeft aria-hidden="true" /> 返回首页
                    </Link>
                    <p className="community-page__state">作品不存在或已下架</p>
                </div>
            </main>
        );
    return (
        <main className="community-page community-detail-page">
            <div className="community-detail">
                <header className="community-detail__topbar">
                    <Link to="/" className="community-detail__back">
                        <ArrowLeft aria-hidden="true" />
                        返回首页
                    </Link>
                    <div className="community-detail__identity">
                        <CommunityCreatorAvatar work={work} className="community-detail__identity-avatar" />
                        <div>
                            <strong>{work.creatorName}</strong>
                            <span>{work.title}</span>
                        </div>
                    </div>
                </header>

                <section className="community-detail__showcase" aria-label="作品放映">
                    <div id="community-video" className="community-detail__stage">
                        <CommunityVideoPlayer src={work.videoUrl} poster={work.coverUrl} sources={work.videoSources} title={work.title} playRequest={playRequest} />
                    </div>
                    <nav className="community-detail__action-bar" aria-label="作品操作">
                        <button type="button" className="community-detail__watch" onClick={() => setPlayRequest((value) => value + 1)}>
                            <Play aria-hidden="true" />
                            立即观看
                        </button>
                        {work.publicCanvas && work.canvasUrl ? (
                            <a className="community-detail__toolbar-action" href={work.canvasUrl} target="_blank" rel="noreferrer noopener">
                                <Grid2X2 aria-hidden="true" />
                                查看制作过程
                            </a>
                        ) : null}
                        <span className="community-detail__toolbar-divider" aria-hidden="true" />
                        <button
                            type="button"
                            className={`community-detail__toolbar-icon${liked ? " is-active" : ""}`}
                            aria-label={liked ? "取消喜欢" : "喜欢"}
                            aria-pressed={liked}
                            onClick={() => setLiked((value) => !value)}
                            title={liked ? "取消喜欢" : "喜欢"}
                        >
                            <Heart aria-hidden="true" />
                        </button>
                        <button type="button" className="community-detail__toolbar-icon" aria-label={shared ? "链接已复制" : "分享"} onClick={handleShare} title={shared ? "链接已复制" : "分享"}>
                            <Share2 aria-hidden="true" />
                        </button>
                    </nav>
                </section>

                {relatedQuery.data?.works?.length ? (
                    <section className="community-detail__rail" aria-label="切换社区作品">
                        <div className="community-detail__rail-nav">
                            <button type="button" className="community-detail__rail-control" aria-label="切换到上一组作品" onClick={() => scrollRail(-1)}>
                                <ChevronLeft aria-hidden="true" />
                            </button>
                            <div ref={railRef} className="community-detail__rail-track">
                                {relatedQuery.data.works.slice(0, 14).map((item) => (
                                    <Link
                                        key={item.id}
                                        to={`${basePath}/${encodeURIComponent(item.id)}`}
                                        className={`community-detail__rail-item${item.id === work.id ? " is-active" : ""}`}
                                        aria-label={`切换到作品：${item.title}`}
                                        aria-current={item.id === work.id ? "page" : undefined}
                                    >
                                        <img src={item.coverUrl} alt="" loading="lazy" />
                                        <span>{item.title}</span>
                                    </Link>
                                ))}
                            </div>
                            <button type="button" className="community-detail__rail-control" aria-label="切换到下一组作品" onClick={() => scrollRail(1)}>
                                <ChevronRight aria-hidden="true" />
                            </button>
                        </div>
                    </section>
                ) : null}
            </div>
        </main>
    );
}

export function MyCommunityWorksPage() {
    const query = useQuery({ queryKey: ["my-community-works"], queryFn: getMyCommunityWorks });
    return (
        <main className="community-page">
            <div className="community-page__inner">
                <header className="community-page__heading">
                    <div>
                        <span>创作者中心</span>
                        <h1>我的投稿</h1>
                        <p>查看社区作品审核进度与处理说明</p>
                    </div>
                    <div className="community-page__header-actions">
                        <Link to="/canvas" className="community-page__header-link">
                            去画布投稿 <ArrowRight aria-hidden="true" />
                        </Link>
                        <Link to="/" className="community-page__header-link">
                            <ArrowLeft aria-hidden="true" /> 首页社区作品
                        </Link>
                    </div>
                </header>
                {query.isLoading ? (
                    <p className="community-page__state">正在加载投稿…</p>
                ) : query.isError ? (
                    <button type="button" className="community-page__state" onClick={() => void query.refetch()}>
                        加载失败，点击重试
                    </button>
                ) : query.data?.works.length ? (
                    <div className="community-submissions">
                        {query.data.works.map((work) => (
                            <article className="community-submission" key={work.id}>
                                <div className="community-submission__heading">
                                    <div>
                                        <h2>{work.title}</h2>
                                        <p>{work.description}</p>
                                    </div>
                                    <Tag color={work.status === "approved" ? "green" : work.status === "rejected" ? "red" : "gold"}>{work.status === "approved" ? "审核通过" : work.status === "rejected" ? "已驳回" : "审核中"}</Tag>
                                </div>
                                <div className="community-submission__meta">
                                    <span>提交于 {new Date(work.createdAt).toLocaleString("zh-CN")}</span>
                                    {work.challengeTitle ? (
                                        <span>
                                            <Trophy aria-hidden="true" />
                                            {work.challengeTitle}
                                            {work.trackTitle ? ` · ${work.trackTitle}` : ""}
                                        </span>
                                    ) : null}
                                    {work.status === "approved" ? (
                                        <Link to={`/linghua/community/${encodeURIComponent(work.id)}`}>
                                            查看公开作品 <ExternalLink aria-hidden="true" />
                                        </Link>
                                    ) : null}
                                </div>
                                {work.status === "rejected" && work.reviewNote ? (
                                    <p className="community-submission__note">
                                        <strong>审核说明</strong>
                                        {work.reviewNote}
                                    </p>
                                ) : null}
                            </article>
                        ))}
                    </div>
                ) : (
                    <p className="community-page__state">还没有投稿记录</p>
                )}
            </div>
        </main>
    );
}

export function CreatorChallengesPage() {
    const challengeQuery = useQuery({ queryKey: ["creator-challenges"], queryFn: getCreatorChallenges, staleTime: 30_000 });
    return (
        <main className="community-page community-page--challenges">
            <div className="community-page__inner">
                <header className="community-page__heading community-challenges-heading">
                    <div>
                        <h1>活动赛事</h1>
                    </div>
                    <div className="community-page__header-actions">
                        <Link to="/linghua/community/mine" className="community-page__header-link">
                            我的投稿 <ArrowRight aria-hidden="true" />
                        </Link>
                        <Link to="/" className="community-page__header-link">
                            <ArrowLeft aria-hidden="true" /> 首页社区作品
                        </Link>
                    </div>
                </header>
                {challengeQuery.isLoading ? (
                    <p className="community-page__state">正在加载活动…</p>
                ) : challengeQuery.isError ? (
                    <p className="community-page__state">活动暂时无法加载</p>
                ) : challengeQuery.data?.challenges.length ? (
                    <div className="community-challenge-grid">
                        {challengeQuery.data.challenges.map((challenge) => {
                            const dateLine = [challenge.startsAt && new Date(challenge.startsAt).toLocaleDateString("zh-CN"), challenge.endsAt && new Date(challenge.endsAt).toLocaleDateString("zh-CN")].filter(Boolean).join(" - ");
                            return <ChallengeCard key={challenge.id} challenge={challenge} poster={getChallengePoster(challenge.description)} dateLine={dateLine} />;
                        })}
                    </div>
                ) : (
                    <p className="community-page__state">当前没有开放的活动赛事</p>
                )}
            </div>
        </main>
    );
}

export function CreatorChallengeDetailPage() {
    const { id = "" } = useParams();
    const challengeQuery = useQuery({ queryKey: ["creator-challenges"], queryFn: getCreatorChallenges, staleTime: 30_000 });
    const challenge = challengeQuery.data?.challenges.find((item) => item.id === id);
    const workQuery = useQuery({ queryKey: ["public-community-works", "challenge-detail", id], queryFn: () => getCommunityWorks({ challengeId: id, pageSize: 48 }), enabled: Boolean(id && challenge), staleTime: 30_000 });
    if (challengeQuery.isLoading)
        return (
            <main className="community-page">
                <p className="community-page__state">正在加载活动…</p>
            </main>
        );
    if (challengeQuery.isError || !challenge)
        return (
            <main className="community-page">
                <div className="community-page__inner">
                    <Link to="/linghua/challenges" className="community-back-link">
                        <ArrowLeft aria-hidden="true" /> 返回赛事列表
                    </Link>
                    <p className="community-page__state">活动不存在或暂不可用</p>
                </div>
            </main>
        );
    const dateLine = [challenge.startsAt && new Date(challenge.startsAt).toLocaleDateString("zh-CN"), challenge.endsAt && new Date(challenge.endsAt).toLocaleDateString("zh-CN")].filter(Boolean).join(" - ");
    const poster = getChallengePoster(challenge.description);
    return (
        <main className="community-page community-page--challenge-detail">
            <div className="community-page__inner">
                <header className="community-page__heading community-challenge-detail__topbar">
                    <Link to="/linghua/challenges" className="community-back-link">
                        <ArrowLeft aria-hidden="true" /> 返回赛事列表
                    </Link>
                    <div className="community-page__header-actions">
                        <Link to="/linghua/community/mine" className="community-page__header-link">
                            我的投稿 <ArrowRight aria-hidden="true" />
                        </Link>
                        <Link to="/" className="community-page__header-link">
                            <ArrowLeft aria-hidden="true" /> 首页社区作品
                        </Link>
                    </div>
                </header>
                <section className="community-challenge-detail">
                    <div className="community-challenge-detail__intro">
                        <div>
                            <span className={`community-challenge__status is-${challenge.status}`}>{challengeStatusLabel(challenge.status)}</span>
                            <h1>{challenge.title}</h1>
                            <p className="community-challenge-detail__dates">活动时间：{dateLine || "长期有效"}</p>
                            <div className="community-challenge__tracks">
                                {challenge.tracks.map((track) => (
                                    <span key={track.id}>{track.name}</span>
                                ))}
                            </div>
                        </div>
                        {challenge.status === "active" ? (
                            <Link to="/canvas" className="community-challenge-detail__submit">
                                前往画布投稿 <ArrowRight aria-hidden="true" />
                            </Link>
                        ) : (
                            <span className="community-challenge-detail__closed">{challenge.status === "upcoming" ? "活动开始后开放投稿" : challenge.status === "inactive" ? "活动已停用" : "投稿已结束"}</span>
                        )}
                    </div>
                    {poster ? <img className="community-challenge-detail__poster" src={poster} alt={`${challenge.title}活动主视觉`} /> : null}
                    {challenge.description ? <ChallengeMarkdown source={challenge.description} /> : null}
                </section>
                <section className="community-challenge-detail__works-section">
                    <div className="community-challenge-detail__section-heading">
                        <h2>参赛作品</h2>
                        {workQuery.data?.works.length ? <span>{workQuery.data.works.length} 件</span> : null}
                    </div>
                    {workQuery.isLoading ? (
                        <p className="community-page__state">正在加载参赛作品…</p>
                    ) : workQuery.isError ? (
                        <p className="community-challenge__empty">参赛作品暂时无法加载</p>
                    ) : workQuery.data?.works.length ? (
                        <div className="community-challenge-detail__works">
                            {workQuery.data.works.map((work) => (
                                <CommunityWorkCard key={work.id} work={work} />
                            ))}
                        </div>
                    ) : (
                        <p className="community-challenge__empty">还没有审核通过的参赛作品</p>
                    )}
                </section>
            </div>
        </main>
    );
}

function ChallengeCard({ challenge, poster, dateLine }: { challenge: CreatorChallenge; poster?: string; dateLine: string }) {
    return (
        <Link to={`/linghua/challenges/${encodeURIComponent(challenge.id)}`} className="community-challenge-card">
            <div className="community-challenge-card__image">
                {poster ? (
                    <img src={poster} alt="" loading="lazy" />
                ) : (
                    <div className="community-challenge-card__placeholder">
                        <Trophy aria-hidden="true" />
                    </div>
                )}
                <span className={`community-challenge__status is-${challenge.status}`}>{challengeStatusLabel(challenge.status)}</span>
                <span className="community-challenge-card__prize">{getChallengePrizeSummary(challenge.description)}</span>
            </div>
            <div className="community-challenge-card__body">
                <h2>{challenge.title}</h2>
                <p>{dateLine || "长期有效"}</p>
                <span>
                    查看详情 <ArrowRight aria-hidden="true" />
                </span>
            </div>
        </Link>
    );
}

function ChallengeMarkdown({ source }: { source: string }) {
    return (
        <div className="community-challenge__details">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ children, href }) => (
                        <a href={href} target="_blank" rel="noreferrer noopener">
                            {children}
                        </a>
                    ),
                    table: ({ children }) => (
                        <div className="community-challenge__table-wrap">
                            <table>{children}</table>
                        </div>
                    ),
                    img: ({ src, alt }) => (!isLocalChallengeImage(src) || alt === "活动主视觉" ? null : <img className={alt === "客服二维码" ? "community-challenge__qr" : undefined} src={src} alt={alt || ""} loading="lazy" />),
                }}
            >
                {source}
            </ReactMarkdown>
        </div>
    );
}

function getChallengePoster(description: string) {
    const match = description.match(/!\[活动主视觉\]\(([^)]+)\)/u);
    return match && isLocalChallengeImage(match[1]) ? match[1] : undefined;
}

function isLocalChallengeImage(src?: string) {
    return Boolean(src && src.startsWith("/") && !src.startsWith("//"));
}

function getChallengePrizeSummary(description: string) {
    const match = description.match(/\|\s*合计\s*\|\s*[^|]+\|\s*[^|]+\|\s*([^|]+)\|\s*[^|]+\|\s*([^|]+)\s*\|/u);
    return match ? `${match[1].trim()}现金 · ${match[2].trim()}积分` : "创作赛事 · 丰厚奖励";
}

function challengeStatusLabel(status: CreatorChallenge["status"]) {
    return status === "active" ? "进行中" : status === "upcoming" ? "预报名" : status === "ended" ? "已结束" : "已停用";
}
