import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { currentLocale } from "@/i18n";

import { WorkspaceAccountMenu } from "@/components/layout/workspace-account-menu";
import { WorkspaceCreditMark } from "@/components/layout/workspace-credit-mark";
import { WorkspaceTopBarExtensionSlot } from "@/components/layout/workspace-top-bar-extension";
import { useUserStore } from "@/stores/use-user-store";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { useSpaceCreditOverview } from "@/hooks/use-space-credit-overview";
import { openWorkspaceWallet } from "@/lib/workspace-wallet";
import { teamCredits, teamIdFromPath } from "@/lib/team-query-keys";
import { openSpaceDirectory } from "./team-space-directory";

export function WorkspaceTopBar({ sidebarOpen, onToggleSidebar }: { sidebarOpen: boolean; onToggleSidebar: () => void }) {
    const { t } = useTranslation();
    const user = useUserStore((state) => state.user);
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const teamsEnabled = useUserStore((state) => state.features.teamsEnabled);
    const { pathname } = useLocation();
    const teamId = teamIdFromPath(pathname);
    const { availableMicrocredits } = useWalletBalance(user?.id, creditsEnabled && !teamsEnabled);
    const overview = useSpaceCreditOverview();
    const data = overview.isError ? undefined : overview.data;
    const scopedCredit = data?.spaces.find((space) => space.teamId === teamId);
    const spaceCredit = teamId ? scopedCredit : data?.personal;
    const spaceBalance = spaceCredit ? teamCredits(spaceCredit.availableMicrocredits) : "—";
    const spaceTitle = teamId ? "本空间积分" : "个人积分";
    const teamTotal = !teamId && data?.spaces.length ? `团队 ${teamCredits(data.spaces.reduce((sum, space) => sum + space.availableMicrocredits, 0))}` : "";
    const spaceLabel = [spaceTitle, spaceBalance, teamTotal].filter(Boolean).join(" ") + "，查看各空间额度";
    const balance = availableMicrocredits === null ? "--" : (availableMicrocredits / 1_000_000).toLocaleString(currentLocale(), { maximumFractionDigits: 2 });

    return (
        <header className="app-workspace-topbar">
            <button type="button" className="app-workspace-mobile-menu app-workspace-topbar-icon-button" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? t("shell.collapseSidebar") : t("shell.expandSidebar")} onClick={onToggleSidebar}>
                {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </button>
            <WorkspaceTopBarExtensionSlot />
            <div className="app-workspace-topbar-actions">
                {creditsEnabled && (
                    <div className="app-workspace-topbar-wallet">
                        {teamsEnabled && user ? (
                            <button type="button" className="app-workspace-topbar-credit-pill space-credit-pill" aria-haspopup="dialog" aria-label={spaceLabel} title={spaceLabel} onClick={openSpaceDirectory}>
                                <WorkspaceCreditMark className="is-compact" />
                                <span>{spaceTitle}</span>
                                <strong>{spaceBalance}</strong>
                                {teamTotal && <small>{teamTotal}</small>}
                            </button>
                        ) : (
                            <button type="button" className="app-workspace-topbar-credit-pill" aria-label={t("shell.openWallet", { balance })} onClick={() => openWorkspaceWallet()}>
                                <WorkspaceCreditMark className="is-compact" />
                                <span>{t("shell.credits")}</span>
                                <strong>{balance}</strong>
                            </button>
                        )}
                        {teamsEnabled && teamId ? (
                            <Link className="app-workspace-topbar-topup" to={`/teams/${encodeURIComponent(teamId)}/wallet`}>
                                查看额度
                            </Link>
                        ) : (
                            <button type="button" className="app-workspace-topbar-topup" onClick={() => openWorkspaceWallet({ tab: "topup", category: "credits" })}>
                                {t("account.wallet.tabTopup")}
                            </button>
                        )}
                    </div>
                )}
                <WorkspaceAccountMenu />
            </div>
        </header>
    );
}
