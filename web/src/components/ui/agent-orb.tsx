import { CraneOrb } from "@/themes/yunhe-xianguan/marks";
import type { ThemeAgentOrbState } from "@/themes/types";
import { useThemePack } from "@/themes/use-theme-pack";

export type AgentOrbState = ThemeAgentOrbState;

/** 「工作中」对应运行和排队；「完成」对应已完成；其余（待命、等审批、失败、取消）都按待命画。 */
export function agentOrbStateForAvatar(avatarState: string): AgentOrbState {
    if (avatarState === "running" || avatarState === "queued") return "work";
    if (avatarState === "completed") return "done";
    return "idle";
}

/** 助手圆球：优先使用当前皮肤主题包的形象，未定义时使用云鹤圆窗。 */
export function AgentOrb({ size = 60, state = "idle", className }: { size?: number; state?: AgentOrbState; color?: string; className?: string }) {
    const ThemeOrb = useThemePack()?.agentOrb;
    const Orb = ThemeOrb ?? CraneOrb;
    return <Orb size={size} state={state} className={className} />;
}
