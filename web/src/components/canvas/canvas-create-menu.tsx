import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";

export type CanvasCreateCommand = {
    id: string;
    label: string;
    icon: ReactNode;
    badge?: string;
    section: "node" | "workflow" | "project" | "resource";
    onClick: () => void;
};

/** 添加节点菜单：展示项目操作和创作节点。 */
export function CanvasCreateMenu({ commands }: { commands: CanvasCreateCommand[] }) {
    const { t } = useTranslation();
    const themeKey = useActiveTheme();
    const theme = canvasThemes[themeKey];
    const projectCommands = commands.filter((command) => command.section === "project");
    const nodeCommands = [...commands.filter((command) => command.section === "node"), ...commands.filter((command) => command.section === "workflow")];
    const vars = {
        "--create-hover": theme.toolbar.itemHover,
        "--create-chip": theme.toolbar.itemHover,
        "--create-chip-hover": theme.toolbar.activeBg,
        "--tw-ring-color": theme.node.muted,
        color: theme.node.text,
    } as CSSProperties;

    return (
        <div className="flex flex-col" style={vars}>
            <header className="flex h-8 items-center justify-between gap-2 pl-2 pr-1">
                <h2 className="font-semibold leading-none" style={{ fontSize: "var(--fs-ui)" }}>
                    {t("canvasA.createMenu.title")}
                </h2>
                {projectCommands.map((command) => (
                    <button
                        key={command.id}
                        type="button"
                        className="inline-flex h-6 min-w-0 items-center gap-1 rounded-[var(--r-md)] px-2 font-medium outline-none transition-colors hover:bg-[var(--create-chip-hover)] focus-visible:ring-2 [&_svg]:size-3.5"
                        style={{ color: theme.node.muted, background: "var(--create-chip)", fontSize: "var(--fs-label)" }}
                        title={command.label}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={command.onClick}
                    >
                        {command.icon}
                        <span className="whitespace-nowrap">{command.label}</span>
                    </button>
                ))}
            </header>

            <div role="group" aria-label={t("canvasA.createMenu.nodesGroup")} className="mt-2 flex flex-col gap-0.5">
                {nodeCommands.map((command) => (
                    <button
                        key={command.id}
                        type="button"
                        className="group flex min-h-9 w-full min-w-0 items-center gap-2.5 rounded-[var(--r-md)] px-2.5 text-left outline-none transition-colors hover:bg-[var(--create-hover)] focus-visible:ring-2"
                        title={command.badge ? t("canvasA.createMenu.commandWithBadge", { label: command.label, badge: command.badge }) : command.label}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={command.onClick}
                    >
                        <span className="grid size-7 shrink-0 place-items-center opacity-75 transition-opacity group-hover:opacity-100 [&_svg]:size-[18px] [&_svg]:stroke-[1.75]">{command.icon}</span>
                        <span className="min-w-0 flex-1 truncate font-medium leading-none" style={{ fontSize: "var(--fs-caption)" }}>
                            {command.label}
                        </span>
                        {command.badge ? (
                            <span className="shrink-0 font-medium" style={{ color: theme.node.muted, fontSize: "var(--fs-label)" }}>
                                {command.badge}
                            </span>
                        ) : null}
                    </button>
                ))}
            </div>
        </div>
    );
}
