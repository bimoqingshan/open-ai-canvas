import { useEffect, useRef, useState } from "react";
import { App, Button } from "antd";
import { Copy, FolderTree, Workflow, X } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/components/ui/product/app-modal";
import { communityCanvasEmbedUrl, publicCanvasShareToken } from "@/pages/community/community-canvas-url";
import { getPublicCanvasShare } from "@/services/api/canvas-share";
import type { PublicCommunityWork } from "@/services/api/community";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";

import "./community-canvas-preview-modal.css";

type CommunityCanvasView = "canvas" | "assets";

export function CommunityCanvasPreviewModal({ work, onClose }: { work: PublicCommunityWork | null; onClose: () => void }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const navigate = useNavigate();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [copying, setCopying] = useState(false);
    const [previewView, setPreviewView] = useState<CommunityCanvasView>("canvas");
    useEffect(() => setPreviewView("canvas"), [work?.id]);

    const closePreview = () => {
        setPreviewView("canvas");
        onClose();
    };
    const sendPreviewView = (view: CommunityCanvasView) => {
        iframeRef.current?.contentWindow?.postMessage({ type: "community-canvas-view", view }, window.location.origin);
    };
    const changePreviewView = (view: CommunityCanvasView) => {
        setPreviewView(view);
        sendPreviewView(view);
    };
    const copyProject = async () => {
        if (!work?.canvasUrl) return;
        setCopying(true);
        try {
            const token = publicCanvasShareToken(work.canvasUrl, window.location.origin);
            const { project } = await getPublicCanvasShare(token);
            const projectId = useCanvasStore.getState().importProject({ ...project, title: `${project.title || work.title}${t("create.home.copySuffix")}` });
            if (!projectId) throw new Error(t("create.home.copyCreated"));
            message.success(t("create.home.copiedToCanvas"));
            closePreview();
            navigate(`/canvas/${encodeURIComponent(projectId)}`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("create.home.copyFailed"));
        } finally {
            setCopying(false);
        }
    };

    let previewUrl = "";
    if (work?.canvasUrl) {
        try {
            previewUrl = communityCanvasEmbedUrl(work.canvasUrl, window.location.origin);
        } catch {
            previewUrl = "";
        }
    }

    return (
        <AppModal open={Boolean(work)} onCancel={closePreview} footer={null} closable={false} centered width="min(1480px, 96vw)" rootClassName="community-canvas-modal" flush>
            {work && previewUrl ? (
                <div className="community-canvas-modal__shell">
                    <div className="community-canvas-modal__bar">
                        <div>
                            <span>{t("create.home.readOnly")}</span>
                            <strong>{work.title}</strong>
                        </div>
                        <div className="community-canvas-modal__view-switch" role="group" aria-label={t("create.home.processView")}>
                            <button
                                type="button"
                                className={previewView === "canvas" ? "is-active" : ""}
                                aria-label={t("create.home.canvasView")}
                                aria-pressed={previewView === "canvas"}
                                title={t("create.home.canvasView")}
                                onClick={() => changePreviewView("canvas")}
                            >
                                <Workflow aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                className={previewView === "assets" ? "is-active" : ""}
                                aria-label={t("create.home.assetsView")}
                                aria-pressed={previewView === "assets"}
                                title={t("create.home.assetsView")}
                                onClick={() => changePreviewView("assets")}
                            >
                                <FolderTree aria-hidden="true" />
                            </button>
                        </div>
                        <div className="community-canvas-modal__actions">
                            <span>{t("create.home.createPrompt")}</span>
                            <Button type="primary" className="community-canvas-modal__copy-button" size="small" icon={<Copy className="size-3.5" />} loading={copying} onClick={() => void copyProject()}>
                                {t("create.home.copyProject")}
                            </Button>
                            <button type="button" aria-label={t("create.home.closeProcess")} onClick={closePreview}>
                                <X aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    <iframe ref={iframeRef} title={`${t("create.home.viewProcess")}: ${work.title}`} src={previewUrl} onLoad={() => sendPreviewView(previewView)} />
                </div>
            ) : null}
        </AppModal>
    );
}
