import { Button } from "antd";
import { Check, ChevronDown, CircleUserRound, Gift, LogOut, Monitor, Moon, Settings, ShieldCheck, Sun } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { useWorkspaceLogout } from "@/hooks/use-workspace-logout";
import { useThemeStore, type ThemeMode } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { LanguageMenu } from "./language-menu";
import { UserAvatar } from "./user-avatar";
import { UserGroupAvatarRing, UserGroupBadge } from "./user-group-badge";
import { WorkspaceCreditMark } from "./workspace-credit-mark";
import "./workspace-account-card.css";

type WorkspaceAccountCardProps = {
    onWallet: () => void;
    onNavigate: () => void;
    onAccountManagement: () => void;
};

/** 账户菜单按身份、余额和账户操作分区展示。 */
export function WorkspaceAccountCard({ onWallet, onNavigate, onAccountManagement }: WorkspaceAccountCardProps) {
    const user = useUserStore((state) => state.user);
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const referralAvailable = useUserStore((state) => state.referralAvailable);
    const themeMode = useThemeStore((state) => state.themeMode);
    const setThemeMode = useThemeStore((state) => state.setThemeMode);
    const { t } = useTranslation();
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);
    const { availableMicrocredits, refreshing, refresh } = useWalletBalance(user?.id, creditsEnabled);
    const { handleLogout, loggingOut } = useWorkspaceLogout();
    if (!user) return null;
    const balance = availableMicrocredits === null ? null : (availableMicrocredits / 1_000_000).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
    const loadingBalance = balance === null && refreshing;

    return (
        <section className="workspace-account-card" aria-label={t("shell.account.region")}>
            <header className="workspace-account-card-identity">
                <UserGroupAvatarRing className="workspace-account-card-avatar-ring">
                    <UserAvatar user={user} className="workspace-account-card-avatar" />
                </UserGroupAvatarRing>
                <div className="workspace-account-card-copy">
                    <div className="workspace-account-card-name">
                        <strong title={user.displayName || user.username}>{user.displayName || user.username}</strong>
                        <UserGroupBadge />
                    </div>
                    <span className="workspace-account-card-meta">@{user.username}</span>
                </div>
                <span className="workspace-account-card-role">{user.role === "admin" ? t("shell.account.admin") : t("shell.account.creator")}</span>
            </header>
            {creditsEnabled ? (
                <div className="workspace-account-card-wallet">
                    <div className="workspace-account-card-wallet-heading">
                        <span className="workspace-account-card-balance-label">
                            <WorkspaceCreditMark className="is-compact" />
                            {t("shell.account.availableCredits")}
                        </span>
                    </div>
                    <div className="workspace-account-card-balance-row">
                        <strong className="workspace-account-card-balance" aria-busy={loadingBalance}>
                            {balance ?? "—"}
                        </strong>
                        <button type="button" onClick={balance === null ? () => void refresh() : onWallet}>
                            {balance === null ? (loadingBalance ? t("nav.sidebar.loading") : t("shell.account.refreshBalance")) : t("shell.account.topup")}
                        </button>
                    </div>
                </div>
            ) : null}
            <nav className="workspace-account-card-actions" aria-label={t("shell.account.actions")}>
                <Link to="/profile" onClick={onNavigate}>
                    <CircleUserRound aria-hidden />
                    <span>{t("settings.sections.profile.label")}</span>
                </Link>
                <button type="button" onClick={onAccountManagement}>
                    <Settings aria-hidden />
                    <span>{t("shell.account.settings")}</span>
                </button>
                <div className="workspace-account-language-row">
                    <LanguageMenu variant="account" />
                </div>
                {referralAvailable ? (
                    <Link to="/referral" onClick={onNavigate}>
                        <Gift aria-hidden />
                        <span>{t("shell.account.referral")}</span>
                    </Link>
                ) : null}
                <div className="workspace-account-card-theme">
                    <button type="button" className="workspace-account-card-theme-trigger" aria-expanded={themeMenuOpen} aria-controls="workspace-account-theme-options" onClick={() => setThemeMenuOpen((open) => !open)}>
                        <Sun aria-hidden />
                        <span>{t("settings.preferences.theme")}</span>
                        <small>{themeMode === "system" ? t("settings.preferences.themeSystem") : themeMode === "light" ? t("settings.preferences.themeLight") : t("settings.preferences.themeDark")}</small>
                        <ChevronDown aria-hidden />
                    </button>
                    <div id="workspace-account-theme-options" className="workspace-account-card-theme-control" role="radiogroup" aria-label={t("settings.preferences.theme")} hidden={!themeMenuOpen}>
                        {[
                            { value: "system" as ThemeMode, label: t("settings.preferences.themeSystem"), icon: <Monitor aria-hidden /> },
                            { value: "light" as ThemeMode, label: t("settings.preferences.themeLight"), icon: <Sun aria-hidden /> },
                            { value: "dark" as ThemeMode, label: t("settings.preferences.themeDark"), icon: <Moon aria-hidden /> },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={themeMode === option.value}
                                onClick={() => {
                                    setThemeMode(option.value);
                                    setThemeMenuOpen(false);
                                }}
                            >
                                {option.icon}
                                <span>{option.label}</span>
                                {themeMode === option.value ? <Check aria-hidden /> : null}
                            </button>
                        ))}
                    </div>
                </div>
                {user.role === "admin" ? (
                    <Link to="/admin" onClick={onNavigate}>
                        <ShieldCheck aria-hidden />
                        <span>{t("shell.account.adminConsole")}</span>
                    </Link>
                ) : null}
                <Button danger type="text" icon={<LogOut aria-hidden />} loading={loggingOut} onClick={() => void handleLogout()}>
                    {t("shell.account.logout")}
                </Button>
            </nav>
        </section>
    );
}
