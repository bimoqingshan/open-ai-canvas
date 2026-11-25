import { useQuery } from "@tanstack/react-query";
import { Button, Skeleton } from "antd";
import { useMemo } from "react";

import { formatCredits } from "@/constant/credits";
import { getAccountActivity, type AccountActivityDay } from "@/services/api/profile";
import { useUserStore } from "@/stores/use-user-store";

export function AccountActivitySection() {
    const user = useUserStore((state) => state.user);
    const activityQuery = useQuery({
        queryKey: ["account-activity", user?.id],
        queryFn: ({ signal }) => getAccountActivity(signal),
        enabled: Boolean(user),
        staleTime: 5 * 60_000,
        retry: false,
    });
    const activity = activityQuery.data;
    const weeklyAverage = activity ? activity.summary.totalConsumedMicrocredits / Math.max(1, Math.ceil(activity.days.length / 7)) : 0;

    return (
        <section className="workspace-account-activity" aria-labelledby="workspace-account-activity-title" aria-busy={activityQuery.isPending || activityQuery.isFetching}>
            <header className="workspace-account-section-heading">
                <h3 id="workspace-account-activity-title">用量统计</h3>
                <span>最近 365 天</span>
            </header>
            {activityQuery.isPending ? (
                <Skeleton active paragraph={{ rows: 5 }} />
            ) : activityQuery.isError ? (
                <div className="workspace-account-inline-error" role="alert">
                    <span>{activityQuery.error instanceof Error ? activityQuery.error.message : "读取用量统计失败"}</span>
                    <Button size="small" onClick={() => void activityQuery.refetch()}>
                        重试
                    </Button>
                </div>
            ) : activity ? (
                <>
                    <div className="workspace-account-activity-metrics" aria-label="用量摘要">
                        <ActivityMetric value={formatCredits(activity.summary.totalConsumedMicrocredits, 1)} label="总消耗" />
                        <ActivityMetric value={formatCredits(activity.summary.dailyPeakMicrocredits, 1)} label="单日峰值" />
                        <ActivityMetric value={formatCredits(weeklyAverage, 1)} label="周均消耗" />
                        <ActivityMetric value={activity.summary.activeDays.toLocaleString("zh-CN")} label="活跃天数" />
                        <ActivityMetric value={activity.summary.longestStreak.toLocaleString("zh-CN")} label="最长连续活跃" />
                    </div>
                    <ActivityHeatmap days={activity.days} />
                </>
            ) : null}
        </section>
    );
}

function ActivityMetric({ value, label }: { value: string; label: string }) {
    return (
        <div className="workspace-account-activity-metric">
            <strong>{value}</strong>
            <span>{label}</span>
        </div>
    );
}

function ActivityHeatmap({ days }: { days: AccountActivityDay[] }) {
    const grid = useMemo(() => {
        if (!days.length) return [];
        const weekdayOffset = new Date(`${days[0].day}T00:00:00Z`).getUTCDay();
        const positive = days
            .map((day) => day.consumedMicrocredits)
            .filter((value) => value > 0)
            .sort((a, b) => a - b);
        const thresholds = [0.25, 0.5, 0.75].map((quantile) => positive[Math.floor((positive.length - 1) * quantile)] || 0);
        return [
            ...Array.from({ length: weekdayOffset }, (_, index) => ({ key: `empty-${index}`, level: 0, title: "" })),
            ...days.map((day) => ({
                key: day.day,
                level: !day.active ? 0 : day.consumedMicrocredits <= 0 ? 1 : day.consumedMicrocredits <= thresholds[0] ? 1 : day.consumedMicrocredits <= thresholds[1] ? 2 : day.consumedMicrocredits <= thresholds[2] ? 3 : 4,
                title: `${day.day} · ${day.consumedMicrocredits > 0 ? `${formatCredits(day.consumedMicrocredits, 2)} 积分消耗` : day.active ? "有活动" : "无活动"}`,
            })),
        ];
    }, [days]);
    const columnCount = Math.max(1, Math.ceil(grid.length / 7));

    return (
        <div className="workspace-account-heatmap-panel">
            <div className="workspace-account-heatmap-heading">
                <div>
                    <strong>积分活动</strong>
                    <span>按天记录积分消耗</span>
                </div>
                <span className="workspace-account-heatmap-legend" aria-label="用量强度图例">
                    <small>少</small>
                    {[0, 1, 2, 3, 4].map((level) => (
                        <i key={level} className={`is-level-${level}`} />
                    ))}
                    <small>多</small>
                </span>
            </div>
            <div className="workspace-account-heatmap-scroll" role="img" aria-label="最近 365 天积分活动热力图">
                <div className="workspace-account-heatmap-grid" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
                    {grid.map((cell) => (
                        <span key={cell.key} className={`is-level-${cell.level}`} title={cell.title} aria-hidden="true" />
                    ))}
                </div>
            </div>
        </div>
    );
}
