import {
    Blocks,
    ChevronRight,
    Clapperboard,
    GraduationCap,
    History as HistoryIcon,
    Image as ImageIcon,
    Images,
    LibraryBig,
    MessageCircle,
    ChevronLeft,
    PanelsTopLeft,
    Palette,
    PenTool,
    Plus,
    ShoppingBag,
    Sparkles,
    TerminalSquare,
    Trophy,
    TvMinimalPlay,
    Users,
    Video,
    Wallet,
    FileText,
} from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { BrandLogoFrame } from "@/components/brand/brand-logo";
import { Kbd } from "@/components/ui/base/kbd";
import { Tooltip } from "@/components/ui/base/tooltip";
import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { useWorkspaceLogout } from "@/hooks/use-workspace-logout";
import { aceternityMotion } from "@/lib/aceternity-motion";
import { cn } from "@/lib/utils";
import { preloadWorkspaceRoute } from "@/lib/workspace-route-modules";
import { useUserStore, type FeatureAvailability } from "@/stores/use-user-store";
import { useSkillLibraryAccess } from "@/lib/skill-access";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { WorkspaceSidebarCheckin } from "./workspace-sidebar-checkin";
import { WorkspaceSidebarStorageMeter } from "./workspace-sidebar-storage-meter";
import { trackSiteTrafficAction } from "@/services/site-traffic";
import { openSpaceDirectory } from "./team-space-directory";
import { teamIdFromPath } from "@/lib/team-query-keys";
import { useQuery } from "@tanstack/react-query";
import { getPublicNavigationMenu, type NavigationMenuItem } from "@/services/api/navigation-menu";
import { AppModal } from "@/components/ui/product/app-modal";

export type WorkspaceNavItem = {
    id: string;
    title: string;
    icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
    to?: string;
    shortcut?: string;
    badge?: string | number;
    action?: "search" | "logout" | "contact";
    contactCards?: NavigationMenuItem["contactCards"];
    children?: WorkspaceNavItem[];
};

type WorkspaceNavGroup = {
    heading?: string;
    items: WorkspaceNavItem[];
};

function toolItem(slug: NavigationToolSlug, to: string, t: TFunction): WorkspaceNavItem {
    const tool = navigationTools.find((item) => item.slug === slug);
    return { id: slug, title: tool ? t(tool.labelKey) : slug, icon: tool?.icon, to };
}

function buildNav(features: FeatureAvailability, t: TFunction, canUseSkills: boolean): { groups: WorkspaceNavGroup[]; footer: WorkspaceNavItem[] } {
    const creationWorkshopChildren = [
        ...(features.imageWorkbenchEnabled ? [{ id: "toolbox-image", title: t("nav.sidebar.toolboxImage"), icon: ImageIcon, to: "/toolbox/image" }] : []),
        ...(features.videoWorkbenchEnabled ? [{ id: "toolbox-video", title: t("nav.sidebar.toolboxVideo"), icon: Video, to: "/toolbox/video" }] : []),
    ];
    const groups: WorkspaceNavGroup[] = [
        {
            items: [
                { ...toolItem("create", "/", t), id: "home", title: t("shell.palette.home") },
                ...(features.assetsEnabled ? [{ ...toolItem("assets", "/assets", t), title: t("nav.sidebar.assets") }] : []),
                { ...toolItem("canvas", "/canvas", t), title: t("nav.sidebar.canvas") },
                ...(canUseSkills ? [{ ...toolItem("skills", "/skills", t), title: t("nav.sidebar.skills") }] : []),
            ],
        },
        {
            heading: t("nav.sections.create"),
            items: [
                { id: "inspirations", title: t("nav.sidebar.inspirations"), icon: Sparkles, to: "/create" },
                ...(creationWorkshopChildren.length ? [{ id: "creation-workshop", title: t("nav.sidebar.creationWorkshop"), icon: Palette, children: creationWorkshopChildren }] : []),
                ...(features.shortDramaEnabled ? [{ ...toolItem("projects", "/projects", t), title: t("nav.sidebar.projects") }] : []),
                ...(features.ecommerceEnabled ? [{ id: "ecommerce", title: t("nav.sidebar.ecommerce"), icon: ShoppingBag, to: "/ecommerce" }] : []),
                ...(features.pluginCenterEnabled ? [{ ...toolItem("plugins", "/plugins", t), title: t("nav.sidebar.plugins") }] : []),
            ],
        },
        {
            heading: t("nav.sidebar.communityHeading"),
            items: [
                { id: "learning", title: t("nav.sidebar.learning"), icon: GraduationCap, to: "/linghua/learning" },
                { id: "community-works", title: t("nav.sidebar.communityWorks"), icon: TvMinimalPlay, to: "/linghua/community" },
                { id: "challenges", title: t("nav.sidebar.challenges"), icon: Trophy, to: "/linghua/challenges" },
            ],
        },
    ];

    // 管理、设置和退出登录不再占据参考站式侧栏底部，而是通过用户卡片菜单进入。
    // 路由和写操作仍保留，避免把用户端导航变成无法访问的装饰。
    return { groups, footer: [] };
}

const navigationIcons = { PenTool, Images, PanelsTopLeft, Clapperboard, Users, ShoppingBag, Image: ImageIcon, Video, LibraryBig, Blocks, History: HistoryIcon, GraduationCap, TvMinimalPlay, Trophy, MessageCircle };
function applyPublicNavigationMenu(groups: WorkspaceNavGroup[], configured: NavigationMenuItem[]): { groups: WorkspaceNavGroup[]; footer: WorkspaceNavItem[] } {
    const grouped = new Map<string, { order: number; entries: Array<{ order: number; item: WorkspaceNavItem }> }>();
    const contactMenu = configured.find((menu) => menu.id === "contact-us");

    for (const menu of configured) {
        if (menu.id === "contact-us") continue;
        const group = grouped.get(menu.groupTitle) || { order: menu.groupOrder, entries: [] };
        group.order = Math.min(group.order, menu.groupOrder);
        group.entries.push({
            order: menu.sortOrder,
            item: {
                id: menu.id,
                title: menu.title,
                to: menu.path,
                icon: navigationIcons[menu.icon as keyof typeof navigationIcons] || PenTool,
            },
        });
        grouped.set(menu.groupTitle, group);
    }

    const customGroups = [...grouped.entries()]
        .sort((left, right) => left[1].order - right[1].order || left[0].localeCompare(right[0]))
        .map(([heading, group]) => ({ heading, items: group.entries.sort((left, right) => left.order - right.order).map((entry) => entry.item) }))
        .filter((group) => group.items.length > 0);
    const customOnlyGroups = customGroups.map((group) => ({ ...group, items: group.items.filter((item) => !["learning", "community-works", "challenges"].includes(item.id)) })).filter((group) => group.items.length > 0);
    const merged = [...groups];
    for (const group of customOnlyGroups) {
        const existing = merged.find((item) => item.heading === group.heading);
        if (existing) existing.items.push(...group.items);
        else merged.push(group);
    }
    return {
        groups: merged,
        footer: [
            { id: "cli-skill", title: "CLI & Skill", icon: TerminalSquare, to: "/cli-skill", badge: "BETA" },
            ...(contactMenu ? [{ id: contactMenu.id, title: contactMenu.title, icon: navigationIcons[contactMenu.icon as keyof typeof navigationIcons] || MessageCircle, action: "contact" as const, contactCards: contactMenu.contactCards }] : []),
        ],
    };
}

function WorkspaceSwitcher({ collapsed, onNavigate, onExpand, onCollapse }: { collapsed: boolean; onNavigate: () => void; onExpand: () => void; onCollapse: () => void }) {
    const appearance = useAppearanceStore((state) => state.appearance);
    const { t } = useTranslation();
    const user = useUserStore((state) => state.user);
    const teamsEnabled = useUserStore((state) => state.features.teamsEnabled);
    // 未上传自定义 Logo 时用内置取景框字形（与欢迎页、登录框、加载页同一个 /logo.svg），放在墨色实底方块里；
    // 自定义 Logo 的配色不可预知，改用中性浅底方块承托。
    const mark = (
        <BrandLogoFrame
            className={cn("app-workspace-brand-mark grid shrink-0 place-items-center", !appearance.logoConfigured && "is-builtin")}
            logoClassName="size-5 object-contain"
            alt=""
            fallback={<span className="app-workspace-brand-glyph" aria-hidden />}
        />
    );
    return (
        <div className={cn("app-workspace-sidebar-brand-row relative shrink-0", collapsed && "is-collapsed")}>
            {user && teamsEnabled ? (
                <button
                    type="button"
                    onClick={() => {
                        onNavigate();
                        openSpaceDirectory();
                    }}
                    className="app-workspace-sidebar-brand-button group"
                    aria-label="切换空间"
                    aria-haspopup="dialog"
                >
                    {mark}
                    {!collapsed ? <span className="app-workspace-brand-wordmark truncate">{appearance.brandName}</span> : null}
                </button>
            ) : (
                <Link to="/" onClick={onNavigate} className="app-workspace-sidebar-brand-button group" aria-label={t("shell.brandHome", { brand: appearance.brandName })}>
                    {mark}
                    {!collapsed ? <span className="app-workspace-brand-wordmark truncate">{appearance.brandName}</span> : null}
                </Link>
            )}
            <button
                type="button"
                className="product-icon-button app-workspace-brand-toggle"
                aria-label={t(collapsed ? "shell.expandSidebarMenu" : "shell.collapseSidebar")}
                title={t(collapsed ? "shell.expandSidebarMenu" : "shell.collapseSidebar")}
                onClick={collapsed ? onExpand : onCollapse}
            >
                <span className="app-workspace-brand-toggle-glyph" aria-hidden="true">
                    {collapsed ? <ChevronRight strokeWidth={1.8} /> : <ChevronLeft strokeWidth={1.8} />}
                    <span className="app-workspace-brand-toggle-divider" />
                </span>
            </button>
        </div>
    );
}

function NavItem({
    item,
    activeId,
    onSelect,
    onOpenSearch,
    onLogout,
    onContact,
    level = 0,
    collapsed = false,
}: {
    item: WorkspaceNavItem;
    activeId: string;
    onSelect: (id: string) => void;
    onOpenSearch: () => void;
    onLogout: () => void;
    onContact: () => void;
    level?: number;
    collapsed?: boolean;
}) {
    const hasChildren = Boolean(item.children?.length);
    const isDirectActive = activeId === item.id || (item.id === "settings" && activeId.startsWith("settings:"));
    const hasActiveChild = Boolean(item.children?.some((child) => child.id === activeId || child.children?.some((grandchild) => grandchild.id === activeId)));
    const isActive = isDirectActive || hasActiveChild;
    const [isOpen, setIsOpen] = useState(false);
    const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number } | null>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reducedMotion = useReducedMotion();

    const clearCloseTimer = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };
    const openSubmenu = (target: HTMLElement) => {
        if (!hasChildren) return;
        clearCloseTimer();
        const rect = target.getBoundingClientRect();
        setSubmenuPosition({ top: rect.top, left: rect.right + 8 });
        setIsOpen(true);
    };
    const scheduleClose = () => {
        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => {
            setIsOpen(false);
            closeTimerRef.current = null;
        }, 120);
    };
    useEffect(() => clearCloseTimer, []);

    const Icon = item.icon;
    const rowStyle = !collapsed && level ? ({ paddingLeft: `${level * 12 + 8}px` } as CSSProperties) : undefined;

    const rowContent = (
        <>
            <span className="app-workspace-nav-main flex min-w-0 items-center gap-2">
                {Icon ? (
                    <span className="app-workspace-nav-icon" aria-hidden>
                        <Icon className="size-4.5 shrink-0" strokeWidth={2.2} />
                    </span>
                ) : (
                    <span className="size-1.5 shrink-0 rounded-full bg-current opacity-40" aria-hidden />
                )}
                {!collapsed ? <span className="app-workspace-nav-title truncate">{item.title}</span> : null}
            </span>
            <span className="app-workspace-nav-meta flex shrink-0 items-center gap-2">
                {item.shortcut ? <Kbd className="hidden group-hover:inline-flex">{item.shortcut}</Kbd> : null}
                {item.badge !== undefined ? (
                    <span
                        className={cn(
                            "flex items-center justify-center rounded-full font-medium tabular-nums",
                            item.id === "cli-skill" ? "bg-foreground/10 px-1.5 py-px text-[9px] leading-3 text-foreground/70" : "min-w-5 bg-primary/10 px-2 py-0.5 text-[var(--fs-tiny)] text-primary",
                        )}
                    >
                        {item.badge}
                    </span>
                ) : null}
                {hasChildren ? <ChevronRight className="size-3.5 shrink-0 text-foreground/40" strokeWidth={2} /> : null}
            </span>
        </>
    );

    const rowClassName = cn(
        "app-workspace-nav-link group relative isolate flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--r-md)] px-3 py-2 text-[var(--fs-body)] transition-[color,transform] duration-200 select-none",
        collapsed && "is-collapsed",
        isActive ? "is-active font-medium" : "text-foreground/62 hover:bg-surface-hover hover:text-foreground",
    );
    const activePill = isDirectActive ? <motion.span layoutId="workspace-nav-active-pill" className="app-workspace-nav-active-pill" aria-hidden transition={reducedMotion ? { duration: 0 } : aceternityMotion.spring.dock} /> : null;

    const handleClick = () => {
        if (item.action === "search") {
            onOpenSearch();
            return;
        }
        if (item.action === "logout") {
            onLogout();
            return;
        }
        if (item.action === "contact") {
            onContact();
            return;
        }
        if (hasChildren) {
            return;
        }
        if (item.to === "/" || item.to === "/create") trackSiteTrafficAction("open_create");
        if (item.to === "/ecommerce") trackSiteTrafficAction("open_ecommerce");
        onSelect(item.id);
    };

    // 局部 const：闭包内 TS 保留窄化，供 preload 回调使用。
    const linkTo = item.to;

    const submenu =
        hasChildren && isOpen && submenuPosition && typeof document !== "undefined"
            ? createPortal(
                  <div
                      className="app-workspace-nav-submenu fixed z-[1200] min-w-[196px] rounded-[var(--r-md)] border border-border bg-surface p-1.5 shadow-[0_14px_36px_rgba(0,0,0,0.16)]"
                      style={{ top: submenuPosition.top, left: submenuPosition.left }}
                      role="group"
                      aria-label={item.title}
                      onMouseEnter={clearCloseTimer}
                      onMouseLeave={scheduleClose}
                  >
                      <div className="mb-1 px-2.5 py-1 text-xs font-medium text-foreground/45">{item.title}</div>
                      <div className="flex flex-col gap-0.5">
                          {item.children!.map((child) => (
                              <NavItem key={child.id} item={child} activeId={activeId} onSelect={onSelect} onOpenSearch={onOpenSearch} onLogout={onLogout} onContact={onContact} level={0} collapsed={false} />
                          ))}
                      </div>
                  </div>,
                  document.body,
              )
            : null;

    return (
        <div className="relative flex w-full flex-col" onMouseEnter={(event) => openSubmenu(event.currentTarget)} onMouseLeave={scheduleClose} onFocusCapture={(event) => openSubmenu(event.currentTarget)}>
            {linkTo ? (
                <Tooltip title={collapsed ? item.title : undefined} placement="right" delay={250} className="workspace-nav-tooltip" triggerClassName="w-full">
                    <Link
                        to={linkTo}
                        viewTransition
                        aria-current={isActive ? "page" : undefined}
                        className={rowClassName}
                        data-nav-id={item.id}
                        style={rowStyle}
                        aria-label={collapsed ? item.title : undefined}
                        onClick={handleClick}
                        onFocus={() => preloadWorkspaceRoute(linkTo)}
                        onPointerDown={() => preloadWorkspaceRoute(linkTo)}
                        onPointerEnter={() => preloadWorkspaceRoute(linkTo)}
                    >
                        {activePill}
                        {rowContent}
                    </Link>
                </Tooltip>
            ) : (
                <Tooltip title={collapsed ? item.title : undefined} placement="right" delay={250} className="workspace-nav-tooltip" triggerClassName="w-full">
                    <button
                        type="button"
                        className={rowClassName}
                        data-nav-id={item.id}
                        style={rowStyle}
                        aria-label={collapsed ? item.title : undefined}
                        onClick={handleClick}
                        aria-haspopup={hasChildren ? "true" : undefined}
                        aria-expanded={hasChildren ? isOpen : undefined}
                    >
                        {activePill}
                        {rowContent}
                    </button>
                </Tooltip>
            )}
            {submenu}
        </div>
    );
}

function NavGroup({
    group,
    activeId,
    onNavigate,
    onOpenSearch,
    onLogout,
    onContact,
    collapsed,
}: {
    group: WorkspaceNavGroup;
    activeId: string;
    onNavigate: () => void;
    onOpenSearch: () => void;
    onLogout: () => void;
    onContact: () => void;
    collapsed: boolean;
}) {
    const hasActive = group.items.some((item) => item.id === activeId || (item.id === "settings" && activeId.startsWith("settings:")));
    const [isOpen, setIsOpen] = useState(true);

    // 激活项所在分组自动展开，保证当前位置可见。
    useEffect(() => {
        if (hasActive) setIsOpen(true);
    }, [hasActive]);

    const content = (
        <div className="flex flex-col gap-1">
            {group.items.map((item) => (
                <NavItem key={item.id} item={item} activeId={activeId} onSelect={onNavigate} onOpenSearch={onOpenSearch} onLogout={onLogout} onContact={onContact} collapsed={collapsed} />
            ))}
        </div>
    );

    // 无标题分组（核心导航入口）常驻展示，不做折叠。
    if (!group.heading || collapsed) {
        return (
            <div className="app-workspace-nav-group flex shrink-0 flex-col" data-nav-group-heading={group.heading || ""}>
                {content}
            </div>
        );
    }

    return (
        <div className="app-workspace-nav-group flex shrink-0 flex-col" data-nav-group-heading={group.heading}>
            <button type="button" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen} className="app-workspace-nav-group-toggle select-none">
                <span className="app-workspace-nav-group-label">{group.heading}</span>
                <ChevronRight className={cn("size-3.5 shrink-0 text-foreground/35 transition-transform duration-200", isOpen && "rotate-90")} strokeWidth={2} />
            </button>
            {isOpen ? <div className="min-h-0">{content}</div> : null}
        </div>
    );
}

// 菜单项 id 与实际路由不一定同名：/toolbox/image 和 /toolbox/video 共用 toolbox 前缀，
// 只取首段会让两者都匹配不到任何菜单项，侧栏因此没有高亮。
export function workspaceNavActiveId(pathname: string, section?: string | null) {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "toolbox" && segments[1]) return `toolbox-${segments[1]}`;
    const slug = segments[0] || "home";
    if (slug === "create") return "home";
    return slug === "settings" && section ? `settings:${section}` : slug;
}

function configuredNavigationActiveID(groups: WorkspaceNavGroup[], pathname: string) {
    const matches = groups.flatMap((group) => group.items).filter((item) => item.to && (item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`)));
    return matches.sort((left, right) => (right.to?.length || 0) - (left.to?.length || 0))[0]?.id;
}

export function WorkspaceSidebarNav({ collapsed, onNavigate, onOpenSearch, onExpand, onCollapse }: { collapsed: boolean; onNavigate: () => void; onOpenSearch: () => void; onExpand: () => void; onCollapse: () => void }) {
    const { pathname } = useLocation();
    const [searchParams] = useSearchParams();
    const [contactOpen, setContactOpen] = useState(false);
    const features = useUserStore((state) => state.features);
    const user = useUserStore((state) => state.user);
    const { handleLogout } = useWorkspaceLogout();
    const { t, i18n } = useTranslation();
    const canUseSkills = useSkillLibraryAccess();
    const publicNavigationQuery = useQuery({ queryKey: ["public-navigation-menu"], queryFn: getPublicNavigationMenu, staleTime: 0 });
    const baseNavigation = useMemo(() => buildNav(features, t, canUseSkills), [features, t, i18n.language, canUseSkills]);
    const configuredNavigation = useMemo(() => (publicNavigationQuery.data ? { ...baseNavigation, ...applyPublicNavigationMenu(baseNavigation.groups, publicNavigationQuery.data.items) } : baseNavigation), [baseNavigation, publicNavigationQuery.data]);
    const teamId = features.teamsEnabled ? teamIdFromPath(pathname) : undefined;
    const base = teamId ? `/teams/${encodeURIComponent(teamId)}` : "";
    const { groups, footer } = teamId
        ? {
              groups: [
                  {
                      items: [
                          ...configuredNavigation.groups[0].items
                              .filter((item) => item.id === "canvas" || item.id === "assets" || (features.creditsEnabled && item.id === "home"))
                              .map((item) => ({ ...item, to: `${base}${item.id === "home" ? "/create" : item.to}` })),
                          { id: "team-members", title: "成员与邀请", icon: Users, to: `${base}/members` },
                          ...(features.creditsEnabled ? [{ id: "team-wallet", title: "团队积分", icon: Wallet, to: `${base}/wallet` }] : []),
                      ],
                  },
              ],
              footer: [],
          }
        : configuredNavigation;
    const section = pathname.slice(base.length).split("/")[1];
    const configuredActiveId = teamId ? undefined : configuredNavigationActiveID(configuredNavigation.groups, pathname);
    const activeId = teamId && (section === "members" || section === "wallet") ? `team-${section}` : pathname === "/teams" ? "teams" : configuredActiveId || workspaceNavActiveId(pathname.slice(base.length) || "/canvas", searchParams.get("section"));
    const footerNavigation = footer.map((item) => (
        <NavItem
            key={item.id}
            item={item.id === "contact-us" && item.title === "联系我们" ? { ...item, title: t("create.home.contactUs") } : item}
            activeId={activeId}
            onSelect={onNavigate}
            onOpenSearch={onOpenSearch}
            onLogout={() => void handleLogout()}
            onContact={() => setContactOpen(true)}
            collapsed={collapsed}
        />
    ));

    const scrollRef = useRef<HTMLDivElement>(null);
    const sectionsRef = useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = useState({ hasTopFade: false, hasBottomFade: false });
    const handleScroll = () => {
        const element = scrollRef.current;
        if (!element) return;
        const { scrollTop, scrollHeight, clientHeight } = element;
        const next = {
            hasTopFade: scrollTop > 0,
            hasBottomFade: scrollTop + clientHeight < scrollHeight - 1,
        };
        setScrollState((previous) => (previous.hasTopFade === next.hasTopFade && previous.hasBottomFade === next.hasBottomFade ? previous : next));
    };
    useEffect(() => {
        handleScroll();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(handleScroll);
        if (scrollRef.current) observer.observe(scrollRef.current);
        if (sectionsRef.current) observer.observe(sectionsRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div className={cn("app-workspace-sidebar-nav flex h-full shrink-0 flex-col", collapsed && "is-collapsed")}>
            <WorkspaceSwitcher collapsed={collapsed} onNavigate={onNavigate} onExpand={onExpand} onCollapse={onCollapse} />
            <Link to="/projects/new" onClick={onNavigate} className={cn("app-workspace-sidebar-create", collapsed && "is-collapsed")} aria-label={t("create.home.newProject")} title={collapsed ? t("create.home.newProject") : undefined}>
                <span className="app-workspace-sidebar-create-icon" aria-hidden>
                    <Plus />
                </span>
                {!collapsed ? <span>{t("create.home.newProject")}</span> : null}
            </Link>

            <LayoutGroup id="workspace-sidebar-nav">
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className={cn(
                        "app-workspace-sidebar-scroll-area flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-3 pt-7",
                        collapsed && "is-collapsed",
                        scrollState.hasTopFade && "has-top-fade",
                        scrollState.hasBottomFade && "has-bottom-fade",
                    )}
                >
                    <div ref={sectionsRef} className="app-workspace-sidebar-sections">
                        <nav className="app-workspace-sidebar-navigation" aria-label={t("nav.sections.create")}>
                            {groups.map((group, index) => (
                                <NavGroup key={index} group={group} activeId={activeId} onNavigate={onNavigate} onOpenSearch={onOpenSearch} onLogout={() => void handleLogout()} onContact={() => setContactOpen(true)} collapsed={collapsed} />
                            ))}
                        </nav>
                    </div>
                </div>
            </LayoutGroup>

            <div className="app-workspace-sidebar-footer shrink-0 px-3 py-3">
                {user && !teamId ? (
                    <div className="app-workspace-sidebar-account">
                        <WorkspaceSidebarCheckin collapsed={collapsed} />
                        {footerNavigation.length ? <div className="flex flex-col gap-0.5">{footerNavigation}</div> : null}
                        <WorkspaceSidebarStorageMeter collapsed={collapsed} />
                    </div>
                ) : null}
                {footer.length && (!user || teamId) ? <div className="mt-2 flex flex-col gap-0.5">{footerNavigation}</div> : null}
            </div>
            {footer.some((item) => item.id === "contact-us") ? (
                <AppModal centered open={contactOpen} title={footer.find((item) => item.id === "contact-us")?.title} onCancel={() => setContactOpen(false)} footer={null} width="min(980px, calc(100vw - 28px))">
                    <div className="grid max-h-[72dvh] grid-cols-1 gap-3 overflow-y-auto p-1 sm:grid-cols-2 lg:grid-cols-3">
                        {(footer.find((item) => item.id === "contact-us")?.contactCards || []).map((card, index) => (
                            <article key={`${card.title}-${index}`} className="flex min-w-0 flex-col items-center rounded-lg border border-border bg-surface-subtle p-5 text-center">
                                {card.imageUrl ? (
                                    <img src={card.imageUrl} alt={`${card.title}二维码`} loading="lazy" className="mb-4 aspect-square w-full max-w-[220px] rounded-md bg-white object-contain p-2" />
                                ) : (
                                    <div className="mb-4 grid aspect-square w-full max-w-[220px] place-items-center rounded-md border border-dashed border-border bg-background px-4 text-sm text-foreground/45">二维码图片未配置</div>
                                )}
                                <h3 className="text-base font-medium">{card.title}</h3>
                                {card.description ? <p className="mt-1 whitespace-pre-line text-sm text-foreground/60">{card.description}</p> : null}
                            </article>
                        ))}
                        {footer.find((item) => item.id === "contact-us")?.contactCards?.length === 0 ? <p className="col-span-full py-10 text-center text-sm text-foreground/55">联系信息暂未配置</p> : null}
                    </div>
                </AppModal>
            ) : null}
        </div>
    );
}
