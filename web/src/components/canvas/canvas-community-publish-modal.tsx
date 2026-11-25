import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { App, Button, Checkbox, Input, Modal, Progress, Select, Switch } from "antd";
import { Check, ImagePlus, LoaderCircle, Upload, Video } from "lucide-react";
import { Link } from "react-router";

import { AppModal } from "@/components/ui/product/app-modal";
import { getCommunityWorkOptions, getMyCommunityWorks, submitCommunityWork, type CommunityWorkRecord, type CreatorChallenge } from "@/services/api/community";
import { uploadResourceFile, type RemoteResource } from "@/services/api/resources";
import "./canvas-community-publish-modal.css";

export type CanvasCommunityPublishProjectOption = { id: string; title: string };

type Props = {
    projectId?: string;
    projectOptions?: CanvasCommunityPublishProjectOption[];
    teamId?: string;
    projectTitle?: string;
    open: boolean;
    onClose: () => void;
    beforeSubmit: () => Promise<boolean | void>;
};

type UploadState = { resource: RemoteResource | null; name: string; preview: string; progress: number; uploading: boolean };

const emptyUpload: UploadState = { resource: null, name: "", preview: "", progress: 0, uploading: false };

function videoDuration(file: File) {
    return new Promise<number>((resolve, reject) => {
        const video = document.createElement("video");
        const objectUrl = URL.createObjectURL(file);
        const cleanup = () => {
            URL.revokeObjectURL(objectUrl);
            video.removeAttribute("src");
            video.load();
        };
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            const duration = video.duration;
            cleanup();
            if (!Number.isFinite(duration) || duration <= 0) reject(new Error("无法读取视频时长"));
            else resolve(Math.floor(duration * 1000));
        };
        video.onerror = () => {
            cleanup();
            reject(new Error("视频无法读取，请更换文件"));
        };
        video.src = objectUrl;
    });
}

export function CanvasCommunityPublishModal({ projectId, projectOptions, teamId, projectTitle, open, onClose, beforeSubmit }: Props) {
    const { message } = App.useApp();
    const videoInput = useRef<HTMLInputElement>(null);
    const coverInput = useRef<HTMLInputElement>(null);
    const [video, setVideo] = useState<UploadState>(emptyUpload);
    const [cover, setCover] = useState<UploadState>(emptyUpload);
    const [selectedProjectId, setSelectedProjectId] = useState(projectId);
    const [title, setTitle] = useState(projectTitle || "未命名画布");
    const [description, setDescription] = useState("");
    const [socialUrl, setSocialUrl] = useState("");
    const [challenges, setChallenges] = useState<CreatorChallenge[]>([]);
    const [challengeId, setChallengeId] = useState<string>();
    const [trackId, setTrackId] = useState<string>();
    const [publicCanvas, setPublicCanvas] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [termsOpen, setTermsOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [myWorks, setMyWorks] = useState<CommunityWorkRecord[] | null>(null);

    const selectedChallenge = challenges.find((item) => item.id === challengeId);
    const boundProjectId = projectId || selectedProjectId;
    const existingSubmission = myWorks === null ? undefined : myWorks.find((work) => work.canvasProjectId === boundProjectId && (work.teamId || "") === (teamId || "")) || null;

    useEffect(() => {
        if (!open) return;
        const initialProjectId = projectId || projectOptions?.[0]?.id;
        const initialProject = projectOptions?.find((item) => item.id === initialProjectId);
        setSelectedProjectId(initialProjectId);
        setTitle(projectTitle || initialProject?.title || "未命名画布");
        setDescription("");
        setSocialUrl("");
        setChallengeId(undefined);
        setTrackId(undefined);
        setPublicCanvas(false);
        setTermsAccepted(false);
        setVideo(emptyUpload);
        setCover(emptyUpload);
        setMyWorks(null);
        getCommunityWorkOptions()
            .then((result) => setChallenges(result.challenges))
            .catch((error) => {
                message.error(error instanceof Error ? error.message : "读取创作者挑战赛失败");
            });
        getMyCommunityWorks()
            .then((result) => setMyWorks(result.works))
            .catch((error) => {
                setMyWorks([]);
                message.error(error instanceof Error ? error.message : "读取投稿状态失败");
            });
    }, [message, open, projectId, projectOptions, projectTitle]);

    useEffect(
        () => () => {
            if (video.preview) URL.revokeObjectURL(video.preview);
            if (cover.preview) URL.revokeObjectURL(cover.preview);
        },
        [cover.preview, video.preview],
    );

    const upload = async (file: File, kind: "video" | "image") => {
        const setState = kind === "video" ? setVideo : setCover;
        const localPreview = URL.createObjectURL(file);
        setState({ resource: null, name: file.name, preview: localPreview, progress: 0, uploading: true });
        try {
            const durationMs = kind === "video" ? await videoDuration(file) : undefined;
            if (kind === "video" && (durationMs ?? 0) < 30_000) throw new Error("视频时长不能少于 30 秒");
            const resource = await uploadResourceFile(file, kind, { fileName: file.name, durationMs }, (uploaded, total) => {
                setState((current) => ({ ...current, progress: total ? Math.round((uploaded / total) * 100) : 0 }));
            });
            setState({ resource, name: file.name, preview: localPreview, progress: 100, uploading: false });
        } catch (error) {
            URL.revokeObjectURL(localPreview);
            setState(emptyUpload);
            message.error(error instanceof Error ? error.message : "文件上传失败");
        }
    };

    const chooseVideo = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void upload(file, "video");
    };

    const chooseCover = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            message.error("封面必须是图片文件");
            return;
        }
        void upload(file, "image");
    };

    const publish = async () => {
        if (!boundProjectId) {
            message.warning("请选择要绑定的画布项目");
            return;
        }
        if (!video.resource || !cover.resource || video.uploading || cover.uploading) {
            message.warning("请先上传视频和封面");
            return;
        }
        if (!title.trim() || !description.trim() || !termsAccepted) {
            message.warning("请填写必填信息并同意发布协议");
            return;
        }
        setSubmitting(true);
        try {
            const saved = await beforeSubmit();
            if (saved === false) return;
            const result = await submitCommunityWork({
                canvasProjectId: boundProjectId,
                ...(teamId ? { teamId } : {}),
                videoResourceId: video.resource.id,
                coverResourceId: cover.resource.id,
                title: title.trim(),
                description: description.trim(),
                socialUrl: socialUrl.trim(),
                challengeId,
                trackId,
                publicCanvas,
                termsAccepted,
            });
            setMyWorks((current) => [{ ...result.work, canvasProjectId: boundProjectId }, ...(current || []).filter((work) => work.id !== result.work.id)]);
            message.success("作品已提交，审核通过后将在社区展示");
            onClose();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "提交作品失败");
        } finally {
            setSubmitting(false);
        }
    };

    const status = existingSubmission?.status;
    const showSubmissionStatus = status === "pending" || status === "approved";

    return (
        <>
            <AppModal rootClassName="canvas-community-publish-modal" open={open} centered width="min(900px, calc(100vw - 24px))" title="发布社区作品" onCancel={onClose} footer={null}>
                {existingSubmission === undefined ? (
                    <div className="community-publish-status" role="status">
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                        正在查询投稿状态…
                    </div>
                ) : showSubmissionStatus ? (
                    <div className="community-publish-status" role="status">
                        <div className="community-publish-status-icon">
                            <Check aria-hidden="true" />
                        </div>
                        <h2>{status === "pending" ? "作品已提交审核" : "作品已通过审核"}</h2>
                        <p>{status === "pending" ? "该画布已有投稿记录，正在等待管理员审核。" : "该作品已在社区展示，无需重复提交。"}</p>
                        <div className="community-publish-status-actions">
                            <Button onClick={onClose}>知道了</Button>
                            <Button type="primary">
                                <Link to="/linghua/community/mine" onClick={onClose}>
                                    查看我的投稿
                                </Link>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="community-publish-form">
                        <p className="community-publish-intro">作品审核通过后将展示在社区作品中。</p>
                        {existingSubmission?.status === "rejected" ? (
                            <p className="community-publish-rejected" role="status">
                                上次投稿未通过审核{existingSubmission.reviewNote ? `：${existingSubmission.reviewNote}` : "，请修改后重新提交。"}
                            </p>
                        ) : null}
                        <div className="community-publish-grid">
                            <div className="community-publish-uploads">
                                <div>
                                    <div className="community-publish-label">
                                        作品视频 <span>时长不少于 30 秒</span>
                                    </div>
                                    <input ref={videoInput} className="sr-only" type="file" accept="video/*" onChange={chooseVideo} />
                                    <button type="button" className="community-upload-tile community-upload-video" onClick={() => videoInput.current?.click()} aria-label="上传作品视频">
                                        {video.preview ? <video src={video.preview} muted playsInline preload="metadata" /> : <Video aria-hidden="true" />}
                                        <span>
                                            {video.uploading ? (
                                                <>
                                                    <LoaderCircle className="animate-spin" /> 上传中 {video.progress}%
                                                </>
                                            ) : (
                                                video.name || "点击上传视频"
                                            )}
                                        </span>
                                    </button>
                                    {video.uploading ? <Progress percent={video.progress} size="small" showInfo={false} /> : null}
                                </div>
                                <div>
                                    <div className="community-publish-label">
                                        作品封面 <span>推荐 16:9</span>
                                    </div>
                                    <input ref={coverInput} className="sr-only" type="file" accept="image/*" onChange={chooseCover} />
                                    <button type="button" className="community-upload-tile community-upload-cover" onClick={() => coverInput.current?.click()} aria-label="上传作品封面">
                                        {cover.preview ? (
                                            <img src={cover.preview} alt="封面预览" />
                                        ) : (
                                            <>
                                                <ImagePlus aria-hidden="true" />
                                                <span>点击上传图片</span>
                                            </>
                                        )}
                                        {cover.uploading ? (
                                            <span className="community-upload-progress">
                                                <LoaderCircle className="animate-spin" /> {cover.progress}%
                                            </span>
                                        ) : null}
                                    </button>
                                </div>
                            </div>
                            <div className="community-publish-fields">
                                {projectOptions ? (
                                    <label className="community-publish-project-select">
                                        <span className="community-publish-label">
                                            绑定画布项目 <b>*</b>
                                        </span>
                                        <Select
                                            showSearch
                                            optionFilterProp="label"
                                            value={selectedProjectId}
                                            placeholder="选择要绑定的画布项目"
                                            options={projectOptions.map((project) => ({ value: project.id, label: project.title || "未命名画布" }))}
                                            onChange={(value) => {
                                                setSelectedProjectId(value);
                                                const selectedProject = projectOptions.find((project) => project.id === value);
                                                if (selectedProject) setTitle(selectedProject.title || "未命名画布");
                                            }}
                                        />
                                    </label>
                                ) : null}
                                <label className="community-publish-label" htmlFor="community-work-title">
                                    作品名称 <b>*</b>
                                </label>
                                <Input id="community-work-title" maxLength={80} showCount value={title} onChange={(event) => setTitle(event.target.value)} placeholder="请输入作品名称" />
                                <label className="community-publish-label" htmlFor="community-work-description">
                                    作品描述 <b>*</b>
                                </label>
                                <Input.TextArea id="community-work-description" maxLength={500} showCount rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="介绍作品的创作思路和看点" />
                                <div className="community-publish-selects">
                                    <label>
                                        <span className="community-publish-label">活动标签</span>
                                        <Select
                                            allowClear
                                            value={challengeId}
                                            placeholder="选择活动（选填）"
                                            options={challenges.map((item) => ({ value: item.id, label: item.activityTag }))}
                                            onChange={(value) => {
                                                setChallengeId(value);
                                                setTrackId(undefined);
                                            }}
                                        />
                                    </label>
                                    <label>
                                        <span className="community-publish-label">参赛赛道</span>
                                        <Select allowClear disabled={!selectedChallenge} value={trackId} placeholder="选择参赛赛道" options={selectedChallenge?.tracks.map((track) => ({ value: track.id, label: track.name })) || []} onChange={setTrackId} />
                                    </label>
                                </div>
                                <label className="community-publish-label" htmlFor="community-work-social">
                                    社媒作品链接 <span>选填</span>
                                </label>
                                <Input id="community-work-social" type="url" value={socialUrl} onChange={(event) => setSocialUrl(event.target.value)} placeholder="粘贴您在社交平台发布该作品的链接" />
                                <div className="community-publish-toggle">
                                    <div>
                                        <strong>公开画布</strong>
                                        <span>创建长期有效的只读分享链接</span>
                                    </div>
                                    <Switch checked={publicCanvas} onChange={setPublicCanvas} aria-label="公开画布" />
                                </div>
                                <div className="community-publish-terms">
                                    <Checkbox checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)}>
                                        我已确认拥有作品发布权限并同意
                                    </Checkbox>
                                    <Button type="link" onClick={() => setTermsOpen(true)}>
                                        《社区作品发布协议》
                                    </Button>
                                </div>
                                <div className="community-publish-actions">
                                    <Button onClick={onClose}>取消</Button>
                                    <Button type="primary" icon={<Upload className="size-4" />} loading={submitting} disabled={!termsAccepted || !video.resource || !cover.resource} onClick={() => void publish()}>
                                        发布并提交审核
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </AppModal>
            <Modal
                rootClassName="community-publish-terms-modal"
                open={termsOpen}
                title="社区作品发布协议"
                onCancel={() => setTermsOpen(false)}
                footer={
                    <Button
                        type="primary"
                        onClick={() => {
                            setTermsAccepted(true);
                            setTermsOpen(false);
                        }}
                        icon={<Check className="size-4" />}
                    >
                        我已阅读
                    </Button>
                }
            >
                <div className="space-y-3 text-sm leading-6 text-foreground/75">
                    <p>您保留作品及画布内容的权利，并确认拥有上传视频、封面和公开分享所需的授权。</p>
                    <p>作品经平台审核通过后，会展示在社区作品页；平台仅为展示和传播作品而使用您提交的媒体与作品信息。</p>
                    <p>开启“公开画布”会为当前画布创建长期有效的只读链接，任何获得链接的人都可以查看画布内容。</p>
                </div>
            </Modal>
        </>
    );
}
