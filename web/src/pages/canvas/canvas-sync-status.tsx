import { useTranslation } from "react-i18next";
import { CloudOutlined } from "@ant-design/icons";
import { LoaderCircle } from "lucide-react";
import { useSyncProgressStore } from "@/stores/use-sync-progress-store";
import "./canvas-sync-status.css";

export function CanvasSyncStatus({ projectId }: { projectId: string }) {
    const { t } = useTranslation();
    const progress = useSyncProgressStore((state) => state.syncingProjects[projectId]);
    const saving = progress?.phase === "pending" || progress?.phase === "saving" || progress?.phase === "uploading" || progress?.localPhase === "pending" || progress?.localPhase === "error" || progress?.phase === "error" || Boolean(progress?.errorKind);
    const tone = saving ? "pending" : progress?.phase === "done" ? "done" : "idle";
    const label = saving ? t("canvasPage.syncStatus.syncing") : progress?.phase === "done" ? t("canvasPage.syncStatus.synced") : t("canvasPage.syncStatus.notSynced");
    return (
        <span className={`canvas-sync-status-trigger canvas-sync-status-trigger--${tone} inline-flex size-8 shrink-0 items-center justify-center rounded-full`} role="status" aria-label={label} title={label}>
            {saving ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <CloudOutlined className="size-5" />}
        </span>
    );
}
