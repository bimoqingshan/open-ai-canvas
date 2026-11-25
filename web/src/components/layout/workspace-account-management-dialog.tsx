import { useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Skeleton, Tag } from "antd";
import { ArrowDownLeft, ArrowRight, Bell, CheckCheck, ChevronRight, Coins, FileText, History, RefreshCw, TerminalSquare, UserRound, UsersRound, WalletCards, X, type LucideIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { AnnouncementContent } from "@/components/ui/announcement-content";
import { AppModal } from "@/components/ui/product/app-modal";
import { EmptyState } from "@/components/ui/product/empty-state";
import { formatCredits } from "@/constant/credits";
import { announcementImageUrl, getAnnouncementFeed, markAnnouncementsRead, type AnnouncementFeed, type SystemAnnouncement } from "@/services/api/announcements";
import { getWallet, type WalletHistoryEntry } from "@/services/api/wallet";
import { arkPortraitOverviewQueryKey, getArkPortraitOverview } from "@/services/api/ark-portraits";
import { settingsConfigSections, type ConfigSection, type ConfigSectionKey } from "@/pages/settings";
import { RUNNINGHUB_PLUGIN_ID } from "@/lib/plugins/builtin/workflows";
import { usePluginStore } from "@/stores/use-plugin-store";
import { useUserStore } from "@/stores/use-user-store";
import "./workspace-account-management-dialog.css";

const SettingsPage = lazy(() => import("@/pages/settings"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const TeamsPage = lazy(() => import("@/pages/teams"));

type AccountPortalSection = "billing" | "history" | "teams" | "messages" | "cli";
type AccountSection = AccountPortalSection | ConfigSectionKey;
type AccountNavItem = { key: AccountSection; label: string; icon: ReactNode; beta?: boolean };

const configNavOrder: ConfigSectionKey[] = ["models", "preferences", "prompts", "channels", "runninghub", "agent-memory", "storage", "ark-assets", "feedbacks", "diagnostics"];
const accountNavItems: AccountNavItem[] = [
    { key: "profile", label: "个人信息", icon: <UserRound aria-hidden="true" /> },
    { key: "billing", label: "账单记录", icon: <FileText aria-hidden="true" /> },
    { key: "history", label: "创作历史", icon: <History aria-hidden="true" /> },
    { key: "teams", label: "团队管理", icon: <UsersRound aria-hidden="true" /> },
    { key: "messages", label: "站内消息", icon: <Bell aria-hidden="true" /> },
];

export function WorkspaceAccountManagementDialog({ open, onClose, onWallet }: { open: boolean; onClose: () => void; onWallet: () => void }) {
    const [activeSection, setActiveSection] = useState<AccountSection>("profile");
    const navigate = useNavigate();
    const { t } = useTranslation();
    const scrollRef = useRef<HTMLDivElement>(null);
    const features = useUserStore((state) => state.features);
    const user = useUserStore((state) => state.user);
    const runningHubEnabled = usePluginStore((state) => state.runtimeStatuses[RUNNINGHUB_PLUGIN_ID] === "enabled");
    const arkOverviewQuery = useQuery({ queryKey: arkPortraitOverviewQueryKey, queryFn: ({ signal }) => getArkPortraitOverview(signal), enabled: Boolean(user && open), staleTime: 60_000 });
    const enabledConfigSections = useMemo(
        () => settingsConfigSections.filter(({ key }) => key !== "profile" && (key !== "channels" || features.customChannelsEnabled) && (key !== "runninghub" || runningHubEnabled) && (key !== "ark-assets" || arkOverviewQuery.data?.enabled)),
        [arkOverviewQuery.data?.enabled, features.customChannelsEnabled, runningHubEnabled],
    );
    const groupedSettings = useMemo(() => {
        const ordered = configNavOrder.map((key) => enabledConfigSections.find((section) => section.key === key)).filter((section): section is ConfigSection => Boolean(section));
        return [
            {
                label: "偏好与工具",
                items: ordered
                    .filter((section) => ["models", "preferences", "prompts", "channels", "runninghub", "agent-memory"].includes(section.key))
                    .map((section) => ({
                        key: section.key,
                        label: t(`settings.sections.${section.key}.label`),
                        icon: section.icon,
                    })),
            },
            {
                label: "资源与支持",
                items: ordered
                    .filter((section) => ["storage", "ark-assets", "feedbacks", "diagnostics"].includes(section.key))
                    .map((section) => ({
                        key: section.key,
                        label: section.key === "storage" ? t("account.layout.oss.title") : section.key === "feedbacks" ? t("account.settings.feedbacks.title") : t(`settings.sections.${section.key}.label`),
                        icon: section.icon,
                    })),
            },
            { label: "实验功能", items: [{ key: "cli" as const, label: "CLI & Skill", icon: <TerminalSquare aria-hidden="true" />, beta: true }] },
        ].filter((group) => group.items.length > 0);
    }, [enabledConfigSections, t]);
    const accountItems = useMemo(() => accountNavItems.filter((item) => (item.key !== "history" || features.taskCenterEnabled) && (item.key !== "teams" || features.teamsEnabled)), [features.taskCenterEnabled, features.teamsEnabled]);

    useEffect(() => {
        if (open) {
            setActiveSection("profile");
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
        }
    }, [open]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [activeSection]);

    const closeAndNavigate = (path: string) => {
        onClose();
        navigate(path);
    };
    const closeAndWallet = () => {
        onClose();
        window.setTimeout(onWallet, 220);
    };
    const renderNavItem = ({ key, label, icon, beta }: AccountNavItem) => (
        <button key={key} type="button" className={"workspace-account-management-nav-item" + (activeSection === key ? " is-active" : "")} aria-current={activeSection === key ? "page" : undefined} onClick={() => setActiveSection(key)}>
            {icon}
            <span>{label}</span>
            {beta ? <Tag className="workspace-account-management-beta">Beta</Tag> : null}
            <ChevronRight aria-hidden="true" />
        </button>
    );

    return (
        <AppModal open={open} flush title={null} footer={null} centered closable={false} keyboard width="min(1280px, calc(100vw - 48px))" rootClassName="workspace-account-management-modal" aria-label="账户管理" onCancel={onClose}>
            <div className="workspace-account-management-shell">
                <aside className="workspace-account-management-sidebar">
                    <nav aria-label="账户管理分类" className="workspace-account-management-nav">
                        <NavGroup label="账户" items={accountItems} renderNavItem={renderNavItem} />
                        {groupedSettings.map((group) => (
                            <NavGroup key={group.label} label={group.label} items={group.items as AccountNavItem[]} renderNavItem={renderNavItem} />
                        ))}
                    </nav>
                </aside>
                <div className="workspace-account-management-main">
                    <header className="workspace-account-management-header">
                        <Button className="workspace-account-management-mobile-close" type="text" aria-label="关闭账户管理" title="关闭" onClick={onClose}>
                            <X className="size-4" aria-hidden="true" />
                        </Button>
                    </header>
                    <div ref={scrollRef} className="workspace-account-management-scroll">
                        {isConfigSection(activeSection) ? (
                            <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
                                <SettingsPage embeddedSection={activeSection} />
                            </Suspense>
                        ) : activeSection === "billing" ? (
                            <BillingPanel onWallet={closeAndWallet} />
                        ) : activeSection === "messages" ? (
                            <MessagesPanel />
                        ) : activeSection === "history" ? (
                            <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
                                <TasksPage embedded />
                            </Suspense>
                        ) : activeSection === "teams" ? (
                            <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
                                <TeamsPage embedded onNavigate={onClose} />
                            </Suspense>
                        ) : (
                            <div className="workspace-account-management-beta-panel">
                                <span className="workspace-account-management-status-icon">
                                    <TerminalSquare aria-hidden="true" />
                                </span>
                                <div>
                                    <div className="workspace-account-management-status-heading">
                                        <h2>CLI &amp; Skill</h2>
                                        <Tag color="blue">Beta</Tag>
                                    </div>
                                    <p>外部 Agent 接入能力正在建设中。</p>
                                    <Button onClick={() => closeAndNavigate("/cli-skill")} icon={<ArrowRight className="size-4" />}>
                                        查看 CLI &amp; Skill 页面
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppModal>
    );
}

function NavGroup({ label, items, renderNavItem }: { label: string; items: AccountNavItem[]; renderNavItem: (item: AccountNavItem) => ReactNode }) {
    if (!items.length) return null;
    return (
        <div className="workspace-account-management-nav-group">
            <span className="workspace-account-management-nav-group-label">{label}</span>
            {items.map(renderNavItem)}
        </div>
    );
}

function isConfigSection(section: AccountSection): section is ConfigSectionKey {
    return settingsConfigSections.some((item) => item.key === section);
}

function BillingPanel({ onWallet }: { onWallet: () => void }) {
    const user = useUserStore((state) => state.user);
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const [page, setPage] = useState(1);
    const walletQuery = useQuery({ queryKey: ["account-management-ledger", user?.id, page], queryFn: () => getWallet(page, 12), enabled: Boolean(user) && creditsEnabled, staleTime: 0, refetchOnMount: "always", retry: false });
    const wallet = walletQuery.data;
    const totalPages = Math.max(1, Math.ceil((wallet?.total || 0) / (wallet?.pageSize || 12)));
    return (
        <section className="workspace-account-ledger" aria-label="积分账单" aria-busy={walletQuery.isPending || walletQuery.isFetching}>
            <div className="workspace-account-ledger-toolbar">
                <div>
                    <h2>账单记录</h2>
                    <p>记录充值、兑换、消费、退款与账户调整。</p>
                </div>
                {creditsEnabled ? (
                    <Button type="primary" icon={<Coins className="size-4" />} onClick={onWallet}>
                        充值 / 兑换
                    </Button>
                ) : null}
            </div>
            {!creditsEnabled ? (
                <UnavailablePanel icon={WalletCards} title="积分功能暂未启用" detail="当前账户没有可用的积分账单。" />
            ) : walletQuery.isPending ? (
                <Skeleton active paragraph={{ rows: 8 }} />
            ) : walletQuery.isError ? (
                <div className="workspace-account-inline-error" role="alert">
                    <span>{walletQuery.error instanceof Error ? walletQuery.error.message : "读取积分流水失败"}</span>
                    <Button size="small" icon={<RefreshCw className="size-3.5" />} onClick={() => void walletQuery.refetch()}>
                        重试
                    </Button>
                </div>
            ) : wallet?.entries.length ? (
                <>
                    <div className="workspace-account-ledger-list">
                        {wallet.entries.map((entry) => (
                            <LedgerRow key={entry.id} entry={entry} />
                        ))}
                    </div>
                    <div className="workspace-account-ledger-pagination">
                        <span>共 {wallet.total.toLocaleString("zh-CN")} 条</span>
                        <Button aria-label="上一页积分流水" disabled={page <= 1 || walletQuery.isFetching} icon={<ArrowDownLeft className="size-4 rotate-45" />} onClick={() => setPage((value) => Math.max(1, value - 1))} />
                        <span>
                            {page} / {totalPages}
                        </span>
                        <Button aria-label="下一页积分流水" disabled={page >= totalPages || walletQuery.isFetching} icon={<ArrowRight className="size-4" />} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} />
                    </div>
                </>
            ) : (
                <EmptyState size="compact" title="暂无积分流水" />
            )}
        </section>
    );
}

function LedgerRow({ entry }: { entry: WalletHistoryEntry }) {
    const billing = entry.type === "billing";
    const positive = !billing && entry.amountMicrocredits > 0;
    const labels: Record<string, string> = { consume: "模型调用", refund: "消费退款", payment_topup: "在线充值", redeem: "兑换码充值", checkin_bonus: "每日签到", signup_bonus: "注册赠送" };
    const title = billing ? "模型调用" : labels[entry.type] || entry.note || "积分调整";
    const details = billing
        ? [entry.billingStatus === "settled" ? `实扣 ${formatCredits(entry.chargedMicrocredits, 6)} 积分` : entry.billingStatus === "refunded" ? "已退回预扣积分" : "计费处理中", entry.scene, entry.model, entry.note].filter(Boolean).join(" · ")
        : [entry.scene, entry.model, entry.note].filter(Boolean).join(" · ");
    const amount = billing ? -entry.chargedMicrocredits : entry.amountMicrocredits;
    return (
        <article className="workspace-account-ledger-row">
            <span className={`workspace-account-ledger-icon${positive ? " is-positive" : ""}`}>{positive ? <Coins aria-hidden="true" /> : <ArrowDownLeft aria-hidden="true" />}</span>
            <div className="workspace-account-ledger-title">
                <strong>{title}</strong>
                <span>{details || "积分账户变动"}</span>
            </div>
            <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("zh-CN", { hour12: false })}</time>
            {(!billing || entry.billingStatus === "settled") && (
                <b className={positive ? "is-positive" : ""}>
                    {positive ? "+" : ""}
                    {formatCredits(amount, 6)}
                </b>
            )}
        </article>
    );
}

function MessagesPanel() {
    const userId = useUserStore((state) => state.user?.id);
    const queryClient = useQueryClient();
    const { message } = App.useApp();
    const queryKey = ["system-announcements", userId] as const;
    const feedQuery = useQuery({ queryKey, queryFn: getAnnouncementFeed, enabled: Boolean(userId), staleTime: 0, refetchOnMount: "always", retry: false });
    const feed = feedQuery.data;
    const [markingRead, setMarkingRead] = useState(false);
    const markAllRead = async () => {
        if (!feed?.unreadCount || !feed.announcements.length || markingRead) return;
        setMarkingRead(true);
        try {
            const result = await markAnnouncementsRead(feed.announcements.map((item) => item.id));
            queryClient.setQueryData<AnnouncementFeed>(queryKey, (current) => (current ? { ...current, unreadCount: result.unreadCount } : current));
            message.success("站内消息已全部标为已读");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "标记已读失败");
        } finally {
            setMarkingRead(false);
        }
    };
    return (
        <section className="workspace-account-messages" aria-label="站内消息" aria-busy={feedQuery.isPending || feedQuery.isFetching}>
            <div className="workspace-account-ledger-toolbar">
                <div>
                    <h2>站内消息</h2>
                    <p>平台发布的维护、功能与服务通知。</p>
                </div>
                <Button icon={<CheckCheck className="size-4" />} disabled={!feed?.unreadCount || markingRead} loading={markingRead} onClick={() => void markAllRead()}>
                    全部标为已读{feed?.unreadCount ? ` · ${feed.unreadCount}` : ""}
                </Button>
            </div>
            {feedQuery.isPending ? (
                <Skeleton active paragraph={{ rows: 8 }} />
            ) : feedQuery.isError ? (
                <div className="workspace-account-inline-error" role="alert">
                    <span>{feedQuery.error instanceof Error ? feedQuery.error.message : "读取站内消息失败"}</span>
                    <Button size="small" icon={<RefreshCw className="size-3.5" />} onClick={() => void feedQuery.refetch()}>
                        重试
                    </Button>
                </div>
            ) : feed?.announcements.length ? (
                <div className="workspace-account-message-list">
                    {feed.announcements.map((announcement) => (
                        <AnnouncementRow key={announcement.id} announcement={announcement} />
                    ))}
                </div>
            ) : (
                <EmptyState size="compact" title="暂无站内消息" />
            )}
        </section>
    );
}

function AnnouncementRow({ announcement }: { announcement: SystemAnnouncement }) {
    const levelLabel = { critical: "重要", warning: "提醒", success: "完成", info: "公告" }[announcement.level];
    return (
        <article className={`workspace-account-message-row is-${announcement.level}`}>
            <div className="workspace-account-message-heading">
                <span className="workspace-account-message-dot" aria-hidden="true" />
                <h3>{announcement.title}</h3>
                <Tag>{levelLabel}</Tag>
                {announcement.pinned ? <Tag color="blue">置顶</Tag> : null}
            </div>
            <time dateTime={announcement.publishedAt}>{new Date(announcement.publishedAt).toLocaleString("zh-CN", { hour12: false })}</time>
            {announcement.imageUrl ? <img className="workspace-account-message-image" src={announcementImageUrl(announcement)} alt="公告配图" loading="lazy" /> : null}
            <AnnouncementContent content={announcement.content} className="workspace-account-message-content" />
        </article>
    );
}

function UnavailablePanel({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
    return (
        <div className="workspace-account-unavailable">
            <span className="workspace-account-management-status-icon">
                <Icon aria-hidden="true" />
            </span>
            <strong>{title}</strong>
            <p>{detail}</p>
        </div>
    );
}
