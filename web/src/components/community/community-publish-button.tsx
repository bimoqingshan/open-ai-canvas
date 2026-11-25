import { useState } from "react";
import { App } from "antd";
import { LoaderCircle, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { useAuthEntry } from "@/hooks/use-auth-entry";
import { CanvasCommunityPublishModal } from "@/components/canvas/canvas-community-publish-modal";
import { listRemoteCanvasProjectsPage, type CanvasLibrarySummary } from "@/services/api/user-data";
import { useUserStore } from "@/stores/use-user-store";

export function CommunityPublishButton({ className }: { className: string }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const navigate = useNavigate();
    const { openAuth } = useAuthEntry();
    const [searchParams] = useSearchParams();
    const userId = useUserStore((state) => state.user?.id);
    const [publishProjects, setPublishProjects] = useState<CanvasLibrarySummary[]>([]);
    const [publishResolving, setPublishResolving] = useState(false);
    const recentCanvasQuery = useQuery({
        queryKey: ["canvas-library", userId, "community-publish"],
        queryFn: ({ signal }) => listRemoteCanvasProjectsPage({ page: 1, pageSize: 40, sort: "updated", signal }),
        enabled: Boolean(userId),
        staleTime: 30_000,
    });

    const openPublishModal = async () => {
        if (!userId) {
            openAuth();
            return;
        }
        setPublishResolving(true);
        try {
            const queryResult = recentCanvasQuery.data ? { data: recentCanvasQuery.data, error: null } : await recentCanvasQuery.refetch();
            if (queryResult.error) throw queryResult.error;
            const projects = queryResult.data?.projects || [];
            if (!projects.length) {
                message.info(t("create.home.createCanvasFirst"));
                navigate("/canvas");
                return;
            }
            setPublishProjects(projects);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("create.home.recentCanvasError"));
        } finally {
            setPublishResolving(false);
        }
    };

    return (
        <>
            <button type="button" className={className} onClick={() => void openPublishModal()} disabled={publishResolving} aria-busy={publishResolving}>
                {publishResolving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                <span>{publishResolving ? t("create.home.preparing") : t("create.home.publishWork")}</span>
            </button>
            {publishProjects.length ? (
                <CanvasCommunityPublishModal
                    projectOptions={publishProjects}
                    teamId={searchParams.get("teamId") || undefined}
                    projectTitle={publishProjects[0].title || t("create.home.unnamedCanvas")}
                    open
                    onClose={() => setPublishProjects([])}
                    beforeSubmit={async () => true}
                />
            ) : null}
        </>
    );
}
