import { Popover } from "antd";
import { CircleUserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AuthLoginLink } from "@/components/auth/auth-login-link";
import { WorkspaceAccountCard } from "./workspace-account-card";
import { WorkspaceAccountManagementDialog } from "./workspace-account-management-dialog";
import { UserAvatar } from "./user-avatar";
import { UserGroupAvatarRing } from "./user-group-badge";
import { openWorkspaceWallet } from "@/lib/workspace-wallet";
import { useUserStore } from "@/stores/use-user-store";

/** 顶部账户入口展示完整账户菜单。 */
export function WorkspaceAccountMenu() {
    const user = useUserStore((state) => state.user);
    const hydrated = useUserStore((state) => state.hydrated);
    const [menuOpen, setMenuOpen] = useState(false);
    const [managementOpen, setManagementOpen] = useState(false);
    const { t } = useTranslation();
    if (!hydrated) {
        return <span className="size-9 animate-pulse rounded-[var(--r-md)] bg-foreground/[.06]" aria-hidden />;
    }

    return user ? (
        <>
            <Popover
                trigger={["hover", "focus", "click"]}
                placement="bottomRight"
                arrow={false}
                rootClassName="workspace-account-popover"
                open={menuOpen}
                onOpenChange={setMenuOpen}
                content={
                    <div className="workspace-topbar-account-menu">
                        <WorkspaceAccountCard
                            onNavigate={() => setMenuOpen(false)}
                            onWallet={() => {
                                setMenuOpen(false);
                                openWorkspaceWallet();
                            }}
                            onAccountManagement={() => {
                                setMenuOpen(false);
                                setManagementOpen(true);
                            }}
                        />
                    </div>
                }
            >
                <button type="button" className="app-workspace-topbar-icon-button app-workspace-account-trigger" aria-label={t("shell.accountMenu")} title={user.displayName || user.username}>
                    <UserGroupAvatarRing>
                        <UserAvatar user={user} className="size-6" />
                    </UserGroupAvatarRing>
                </button>
            </Popover>
            <WorkspaceAccountManagementDialog open={managementOpen} onClose={() => setManagementOpen(false)} onWallet={() => openWorkspaceWallet()} />
        </>
    ) : (
        <AuthLoginLink className="inline-flex items-center gap-2 px-2 text-xs text-foreground/55" aria-label={t("shell.login")} title={t("shell.login")}>
            <CircleUserRound className="size-5" />
            <span className="hidden sm:inline">{t("shell.guestShort")}</span>
        </AuthLoginLink>
    );
}
