import { App, Button, Skeleton } from "antd";
import { ArrowRight, Check, Clock3, ExternalLink, Heart, Plus, Share2, Sparkles, ThumbsUp, Upload } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { EmptyState } from "@/components/ui/product/empty-state";
import { UserAvatar } from "@/components/layout/user-avatar";
import { UserGroupAvatarRing, UserGroupBadge } from "@/components/layout/user-group-badge";
import { loadProfileSession } from "@/services/profile-session";
import { getMyCommunityWorks, type CommunityWorkRecord } from "@/services/api/community";
import { listRemoteAssetsPage } from "@/services/api/user-data";
import { useUserStore } from "@/stores/use-user-store";
import "./profile-center.css";

type ProfileTab = "published" | "history" | "liked";
type ProfileSubmissionsResponse = { works: CommunityWorkRecord[] };

export default function ProfileCenterPage() {
    const { message } = App.useApp();
    const user = useUserStore((state) => state.user);
    const [activeTab, setActiveTab] = useState<ProfileTab>("published");
    const userId = user?.id;
    const profileQuery = useQuery({
        queryKey: ["user-profile", userId],
        queryFn: ({ signal }) => loadProfileSession(userId, signal),
        enabled: Boolean(userId),
        retry: false,
        refetchOnWindowFocus: false,
    });
    const submissionsQuery = useQuery<ProfileSubmissionsResponse, Error>({
        queryKey: ["profile-center-submissions", userId],
        queryFn: getMyCommunityWorks,
        enabled: Boolean(userId),
        staleTime: 30_000,
    });
    const assetsQuery = useQuery({
        queryKey: ["profile-center-assets", userId],
        queryFn: ({ signal }) => listRemoteAssetsPage({ page: 1, pageSize: 1, signal }),
        enabled: Boolean(userId),
        staleTime: 30_000,
    });

    const profileUser = profileQuery.data?.user || user;
    const submissions = submissionsQuery.data?.works || [];
    const approvedSubmissions = submissions.filter((item) => item.status === "approved").length;
    const bannerUrl = "/short-drama-styles/cyberpunk-neon.jpg";

    const shareProfile = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            message.success("个人中心链接已复制");
        } catch {
            message.warning("当前浏览器不支持自动复制，请手动复制地址栏链接");
        }
    };

    if (!profileUser) return null;

    return (
        <main className="profile-center-page">
            <section className="profile-center-cover" aria-label="个人中心封面">
                <img src={bannerUrl} alt="" />
                <div className="profile-center-cover-shade" aria-hidden="true" />
            </section>
            <div className="profile-center-content">
                <section className="profile-center-identity" aria-labelledby="profile-center-title">
                    <UserGroupAvatarRing className="profile-center-avatar-ring">
                        <UserAvatar user={profileUser} className="profile-center-avatar" />
                    </UserGroupAvatarRing>
                    <div className="profile-center-identity-copy">
                        <div className="profile-center-title-row">
                            <div>
                                <p className="profile-center-eyebrow">个人中心</p>
                                <div className="profile-center-name-row">
                                    <h1 id="profile-center-title">{profileUser.displayName || profileUser.username}</h1>
                                    <UserGroupBadge />
                                </div>
                                <p className="profile-center-handle">@{profileUser.username}</p>
                            </div>
                            <span className="profile-center-role">{profileUser.role === "admin" ? "管理员" : "创作者"}</span>
                        </div>
                        <div className="profile-center-stats" aria-label="创作统计">
                            <span>
                                <strong>{submissionsQuery.isPending ? "…" : submissionsQuery.isError ? "—" : submissions.length}</strong>投稿
                            </span>
                            <span>
                                <strong>{submissionsQuery.isPending ? "…" : submissionsQuery.isError ? "—" : approvedSubmissions}</strong>已发布
                            </span>
                            <span>
                                <strong>{assetsQuery.isPending ? "…" : assetsQuery.isError ? "—" : (assetsQuery.data?.total ?? 0)}</strong>素材
                            </span>
                        </div>
                        <div className="profile-center-actions">
                            <Button title="分享主页" icon={<Share2 className="size-4" />} onClick={() => void shareProfile()}>
                                分享主页
                            </Button>
                        </div>
                    </div>
                </section>

                <nav className="profile-center-tabs" aria-label="个人中心内容" role="tablist">
                    {(
                        [
                            ["published", "发布", Upload],
                            ["history", "浏览过创作过程", Clock3],
                            ["liked", "点赞", Heart],
                        ] as const
                    ).map(([key, label, Icon]) => (
                        <button key={key} type="button" role="tab" aria-selected={activeTab === key} className={activeTab === key ? "is-active" : ""} onClick={() => setActiveTab(key)}>
                            <Icon aria-hidden="true" />
                            <span>{label}</span>
                        </button>
                    ))}
                </nav>

                <section className="profile-center-panel" role="tabpanel" aria-live="polite">
                    {activeTab === "published" ? (
                        <PublishedWorksPanel submissions={submissions} query={submissionsQuery} />
                    ) : activeTab === "history" ? (
                        <EmptyState
                            icon={Clock3}
                            title="还没有浏览记录"
                            description="你浏览过的创作过程会显示在这里。"
                            action={
                                <Link className="profile-center-empty-action" to="/">
                                    去首页看看
                                </Link>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={ThumbsUp}
                            title="还没有点赞作品"
                            description="喜欢的作品会集中保存在这里。"
                            action={
                                <Link className="profile-center-empty-action" to="/linghua/community">
                                    发现作品
                                </Link>
                            }
                        />
                    )}
                </section>
            </div>
        </main>
    );
}

function PublishedWorksPanel({ submissions, query }: { submissions: CommunityWorkRecord[]; query: UseQueryResult<ProfileSubmissionsResponse, Error> }) {
    if (query.isPending)
        return (
            <div className="profile-center-grid-loading">
                <Skeleton active paragraph={{ rows: 4 }} />
            </div>
        );
    if (query.isError)
        return (
            <EmptyState
                icon={Sparkles}
                title="发布作品暂时无法加载"
                description="请稍后重试，或前往我的投稿查看审核进度。"
                action={
                    <Button size="small" onClick={() => void query.refetch()}>
                        重新加载
                    </Button>
                }
            />
        );

    const publishedWorks = submissions.filter((submission) => submission.status === "approved");
    if (!publishedWorks.length) {
        return (
            <EmptyState
                icon={Upload}
                title="还没有发布作品"
                description="作品不会自动发布。完成投稿并通过审核后，作品会显示在这里。"
                action={
                    <div className="profile-center-empty-actions">
                        <Link className="profile-center-empty-action" to="/linghua/community/mine">
                            查看我的投稿 <ArrowRight aria-hidden="true" />
                        </Link>
                        <Link className="profile-center-empty-action is-secondary" to="/canvas">
                            去画布投稿 <Plus aria-hidden="true" />
                        </Link>
                    </div>
                }
            />
        );
    }

    return (
        <div className="profile-center-published-list">
            <div className="profile-center-panel-heading">
                <div>
                    <p className="profile-center-eyebrow">社区作品</p>
                    <h2>已发布作品</h2>
                </div>
                <Link className="profile-center-panel-link" to="/linghua/community/mine">
                    管理投稿 <ArrowRight aria-hidden="true" />
                </Link>
            </div>
            <div className="profile-center-submission-list">
                {publishedWorks.map((submission) => (
                    <Link key={submission.id} to={`/linghua/community/${encodeURIComponent(submission.id)}`} className="profile-center-submission-row">
                        <span className="profile-center-submission-status is-approved">
                            <Check aria-hidden="true" />
                            已发布
                        </span>
                        <span className="profile-center-submission-copy">
                            <strong>{submission.title || "未命名作品"}</strong>
                            <span>{submission.description || "已通过审核的社区作品"}</span>
                        </span>
                        <span className="profile-center-submission-meta">
                            <time dateTime={submission.reviewedAt || submission.createdAt}>{new Date(submission.reviewedAt || submission.createdAt).toLocaleDateString("zh-CN")}</time>
                            <ExternalLink aria-hidden="true" />
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
