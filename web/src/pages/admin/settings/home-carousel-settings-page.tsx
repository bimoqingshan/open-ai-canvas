import { App, Button, Input, InputNumber, Select, Skeleton } from "antd";
import { ArrowDown, ArrowUp, ExternalLink, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router";
import type { JSONContent } from "@tiptap/core";

import { HomeCarouselRichText } from "@/components/home/home-carousel-rich-text";
import { HomeCarouselRichTextEditor } from "@/pages/admin/settings/components/home-carousel-rich-text-editor";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { AdminStatusBadge } from "@/pages/admin/components/admin-ui";
import { DEFAULT_HOME_CAROUSEL, EMPTY_HOME_CAROUSEL_DOCUMENT, normalizeHomeCarousel, type HomeCarouselConfig, type HomeCarouselSlide } from "@/lib/home-carousel";
import { getAdminHomeCarousel, updateAdminHomeCarousel } from "@/services/api/home-carousel";
import { Switch } from "@/pages/admin/ui/controls";
import { safeHomeCarouselHref } from "@/components/home/home-carousel-rich-text";
import "@/pages/admin/settings/home-carousel-settings.css";

const MAX_SLIDES = 8;

export default function HomeCarouselSettingsPage() {
    const { message, modal } = App.useApp();
    const [baseline, setBaseline] = useState<HomeCarouselConfig | null>(null);
    const [draft, setDraft] = useState<HomeCarouselConfig>(() => normalizeHomeCarousel(DEFAULT_HOME_CAROUSEL));
    const [selectedId, setSelectedId] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState("");
    const requestVersion = useRef(0);

    const dirty = Boolean(baseline) && JSON.stringify(draft) !== JSON.stringify(baseline);
    const blocker = useBlocker(dirty && !saving);
    const selectedSlide = useMemo(() => draft.slides.find((slide) => slide.id === selectedId) || draft.slides[0] || null, [draft.slides, selectedId]);

    const load = useCallback(
        async (initial = false) => {
            const version = ++requestVersion.current;
            if (initial) setLoading(true);
            else setRefreshing(true);
            try {
                const setting = await getAdminHomeCarousel();
                if (version !== requestVersion.current) return;
                const next = normalizeHomeCarousel(setting.homeCarousel);
                setBaseline(next);
                setDraft(next);
                setSelectedId((current) => (next.slides.some((slide) => slide.id === current) ? current : next.slides[0]?.id || ""));
                setLoadError("");
            } catch (error) {
                if (version !== requestVersion.current) return;
                const detail = error instanceof Error ? error.message : "读取首页轮播配置失败";
                setLoadError(detail);
                if (!initial) message.error(detail);
            } finally {
                if (version === requestVersion.current) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        },
        [message],
    );

    useEffect(() => {
        void load(true);
        return () => {
            requestVersion.current += 1;
        };
    }, [load]);

    useEffect(() => {
        if (blocker.state !== "blocked") return;
        modal.confirm({
            title: "放弃首页轮播调整？",
            content: "当前首页轮播草稿尚未保存，离开后这些调整会丢失。",
            okText: "放弃并离开",
            cancelText: "继续编辑",
            okButtonProps: { danger: true },
            onOk: () => blocker.proceed(),
            onCancel: () => blocker.reset(),
        });
    }, [blocker, modal]);

    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (!dirty || saving) return;
            event.preventDefault();
        };
        window.addEventListener("beforeunload", beforeUnload);
        return () => window.removeEventListener("beforeunload", beforeUnload);
    }, [dirty, saving]);

    const updateDraft = (update: (current: HomeCarouselConfig) => HomeCarouselConfig) => setDraft((current) => update(current));
    const updateSelected = (patch: Partial<HomeCarouselSlide>) => {
        if (!selectedSlide) return;
        updateDraft((current) => ({
            ...current,
            slides: current.slides.map((slide) => (slide.id === selectedSlide.id ? { ...slide, ...patch } : slide)),
        }));
    };

    const updateRegionRefs = (region: "primary" | "banner" | "support", ids: string[]) => {
        updateDraft((current) => ({ ...current, regionRefs: { ...current.regionRefs, [region]: ids } }));
    };

    const addSlide = () => {
        if (draft.slides.length >= MAX_SLIDES) return;
        const id = crypto.randomUUID().replaceAll("-", "");
        const slide: HomeCarouselSlide = {
            id,
            enabled: true,
            title: "新轮播项目",
            description: "",
            videoUrl: "",
            posterUrl: "",
            altText: "",
            detailEnabled: false,
            detailTitle: "",
            detailContent: structuredClone(EMPTY_HOME_CAROUSEL_DOCUMENT),
            detailButtonLabel: "了解详情",
            actionLabel: "开始创作",
            actionUrl: "/create",
        };
        updateDraft((current) => ({ ...current, slides: [...current.slides, slide] }));
        setSelectedId(id);
    };

    const removeSlide = () => {
        if (!selectedSlide || draft.slides.length <= 1) return;
        const currentIndex = draft.slides.findIndex((slide) => slide.id === selectedSlide.id);
        const nextSlides = draft.slides.filter((slide) => slide.id !== selectedSlide.id);
        updateDraft((current) => ({ ...current, slides: nextSlides }));
        setSelectedId(nextSlides[Math.max(0, currentIndex - 1)]?.id || nextSlides[0]?.id || "");
    };

    const moveSelected = (direction: -1 | 1) => {
        if (!selectedSlide) return;
        updateDraft((current) => {
            const index = current.slides.findIndex((slide) => slide.id === selectedSlide.id);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= current.slides.length) return current;
            const slides = [...current.slides];
            [slides[index], slides[target]] = [slides[target], slides[index]];
            return { ...current, slides };
        });
    };

    const requestRefresh = () => {
        if (!dirty) {
            void load(false);
            return;
        }
        modal.confirm({
            title: "放弃调整并重新读取？",
            content: "重新读取会丢弃当前首页轮播草稿。",
            okText: "放弃并刷新",
            cancelText: "继续编辑",
            okButtonProps: { danger: true },
            onOk: () => load(false),
        });
    };

    const restoreDefaults = () => {
        modal.confirm({
            title: "恢复首页轮播默认内容？",
            content: "当前草稿会替换为项目内置的四个推荐项目，保存后首页才会更新。",
            okText: "恢复默认内容",
            cancelText: "取消",
            onOk: () => {
                const next = normalizeHomeCarousel(DEFAULT_HOME_CAROUSEL);
                setDraft(next);
                setSelectedId(next.slides[0]?.id || "");
            },
        });
    };

    const save = async () => {
        if (!baseline || saving || !dirty) return;
        setSaving(true);
        try {
            const setting = await updateAdminHomeCarousel(draft);
            const next = normalizeHomeCarousel(setting.homeCarousel);
            setBaseline(next);
            setDraft(next);
            message.success("首页轮播已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存首页轮播失败");
        } finally {
            setSaving(false);
        }
    };

    const actions = (
        <div className="admin-home-carousel-actions">
            <Button icon={<RotateCcw className="size-4" />} disabled={loading || refreshing || saving} onClick={restoreDefaults}>
                恢复默认
            </Button>
            <Button disabled={loading || refreshing || saving} loading={refreshing} onClick={requestRefresh}>
                重新读取
            </Button>
            <Button type="primary" icon={<Save className="size-4" />} disabled={!dirty || loading || refreshing || saving} loading={saving} onClick={() => void save()}>
                保存
            </Button>
        </div>
    );

    return (
        <AdminPageFrame title="首页轮播" description="管理首页推荐画面、详情内容和跳转地址。" actions={actions} scroll>
            {loading ? (
                <div className="admin-home-carousel-loading">
                    <Skeleton active paragraph={{ rows: 7 }} />
                </div>
            ) : loadError ? (
                <div className="admin-home-carousel-error" role="alert">
                    <p>{loadError}</p>
                    <Button onClick={() => void load(true)}>重试</Button>
                </div>
            ) : (
                <div className="admin-home-carousel-layout">
                    <section className="admin-home-carousel-list" aria-labelledby="home-carousel-list-title">
                        <div className="admin-home-carousel-list-heading">
                            <div>
                                <h2 id="home-carousel-list-title">轮播项目</h2>
                                <p>
                                    {draft.slides.length}/{MAX_SLIDES} 个项目 · 使用箭头调整展示顺序
                                </p>
                            </div>
                            <Button icon={<Plus className="size-4" />} disabled={draft.slides.length >= MAX_SLIDES || saving} onClick={addSlide}>
                                新增
                            </Button>
                        </div>
                        <div className="admin-home-carousel-list-items" role="listbox" aria-label="选择首页轮播项目">
                            {draft.slides.map((slide, index) => (
                                <button key={slide.id} type="button" role="option" aria-selected={selectedSlide?.id === slide.id} className="admin-home-carousel-list-item" onClick={() => setSelectedId(slide.id)}>
                                    <span className="admin-home-carousel-list-item-index">{String(index + 1).padStart(2, "0")}</span>
                                    <span className="admin-home-carousel-list-item-copy">
                                        <strong>{slide.title || "未命名项目"}</strong>
                                        <small>{slide.enabled ? "首页展示" : "已停用"}</small>
                                    </span>
                                    <span className={`admin-home-carousel-list-item-state${slide.enabled ? " is-enabled" : ""}`} aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                        <div className="admin-home-carousel-global">
                            <div className="admin-home-carousel-global-row">
                                <span>
                                    <strong>自动轮播</strong>
                                    <small>悬停、键盘聚焦或切换标签页时会自动暂停</small>
                                </span>
                                <Switch checked={draft.autoplayEnabled} disabled={saving} aria-label="启用首页轮播自动切换" onChange={(checked) => updateDraft((current) => ({ ...current, autoplayEnabled: checked }))} />
                            </div>
                            <label className="admin-home-carousel-interval">
                                <span>切换间隔</span>
                                <InputNumber
                                    min={3}
                                    max={15}
                                    step={1}
                                    value={draft.intervalMs / 1000}
                                    disabled={saving || !draft.autoplayEnabled}
                                    addonAfter="秒"
                                    onChange={(value) => updateDraft((current) => ({ ...current, intervalMs: Math.round(Number(value || 6.5) * 1000) }))}
                                />
                            </label>
                            <div className="admin-home-carousel-regions">
                                <div className="admin-home-carousel-regions-heading">
                                    <strong>首页展示区域</strong>
                                    <small>同一项目可以被多个区域复用；每个区域独立轮播。</small>
                                </div>
                                {(
                                    [
                                        ["primary", "主视觉"],
                                        ["banner", "右上横幅"],
                                        ["support", "辅助卡片"],
                                    ] as const
                                ).map(([region, label]) => (
                                    <label className="admin-home-carousel-region-field" key={region}>
                                        <span>{label}</span>
                                        <Select
                                            mode="multiple"
                                            value={draft.regionRefs[region]}
                                            options={draft.slides.map((slide) => ({ label: slide.title || "未命名项目", value: slide.id }))}
                                            disabled={saving}
                                            onChange={(ids) => updateRegionRefs(region, ids)}
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                    </section>

                    {selectedSlide ? (
                        <section className="admin-home-carousel-editor" aria-labelledby="home-carousel-editor-title">
                            <div className="admin-home-carousel-editor-heading">
                                <div>
                                    <span className="admin-home-carousel-eyebrow">项目配置</span>
                                    <h2 id="home-carousel-editor-title">{selectedSlide.title || "未命名项目"}</h2>
                                </div>
                                <div className="admin-home-carousel-row-actions">
                                    <Button
                                        type="text"
                                        icon={<ArrowUp className="size-4" />}
                                        disabled={saving || draft.slides.findIndex((slide) => slide.id === selectedSlide.id) <= 0}
                                        aria-label="上移轮播项目"
                                        title="上移"
                                        onClick={() => moveSelected(-1)}
                                    />
                                    <Button
                                        type="text"
                                        icon={<ArrowDown className="size-4" />}
                                        disabled={saving || draft.slides.findIndex((slide) => slide.id === selectedSlide.id) >= draft.slides.length - 1}
                                        aria-label="下移轮播项目"
                                        title="下移"
                                        onClick={() => moveSelected(1)}
                                    />
                                    <Button type="text" danger icon={<Trash2 className="size-4" />} disabled={saving || draft.slides.length <= 1} aria-label="删除轮播项目" title="删除" onClick={removeSlide} />
                                </div>
                            </div>

                            <div className="admin-home-carousel-status-row">
                                <span>
                                    <strong>在首页展示</strong>
                                    <small>关闭后项目会保留在配置中，但不会进入轮播。</small>
                                </span>
                                <Switch checked={selectedSlide.enabled} disabled={saving} aria-label="在首页展示此轮播项目" onChange={(checked) => updateSelected({ enabled: checked })} />
                            </div>

                            <div className="admin-home-carousel-fields">
                                <label className="admin-home-carousel-field">
                                    <span>标题</span>
                                    <Input value={selectedSlide.title} maxLength={80} showCount disabled={saving} onChange={(event) => updateSelected({ title: event.target.value })} />
                                </label>
                                <label className="admin-home-carousel-field">
                                    <span>说明</span>
                                    <Input.TextArea value={selectedSlide.description} maxLength={180} showCount autoSize={{ minRows: 2, maxRows: 4 }} disabled={saving} onChange={(event) => updateSelected({ description: event.target.value })} />
                                </label>
                                <label className="admin-home-carousel-field">
                                    <span>视频地址</span>
                                    <Input value={selectedSlide.videoUrl} maxLength={2048} placeholder="/home-banner/example.mp4 或 https://…" disabled={saving} onChange={(event) => updateSelected({ videoUrl: event.target.value })} />
                                </label>
                                <label className="admin-home-carousel-field">
                                    <span>封面图片地址</span>
                                    <Input value={selectedSlide.posterUrl} maxLength={2048} placeholder="/short-drama-styles/example.jpg 或 https://…" disabled={saving} onChange={(event) => updateSelected({ posterUrl: event.target.value })} />
                                </label>
                                <label className="admin-home-carousel-field">
                                    <span>图片替代文字</span>
                                    <Input value={selectedSlide.altText} maxLength={160} disabled={saving} onChange={(event) => updateSelected({ altText: event.target.value })} />
                                </label>
                            </div>

                            <div className="admin-home-carousel-detail-toggle">
                                <span>
                                    <strong>配置详情内容</strong>
                                    <small>开启后，首页主按钮先打开富文本详情，再按详情按钮跳转。</small>
                                </span>
                                <Switch checked={selectedSlide.detailEnabled} disabled={saving} aria-label="启用轮播详情" onChange={(checked) => updateSelected({ detailEnabled: checked })} />
                            </div>

                            {selectedSlide.detailEnabled ? (
                                <div className="admin-home-carousel-detail-fields">
                                    <label className="admin-home-carousel-field">
                                        <span>详情标题</span>
                                        <Input value={selectedSlide.detailTitle} maxLength={120} disabled={saving} placeholder={selectedSlide.title} onChange={(event) => updateSelected({ detailTitle: event.target.value })} />
                                    </label>
                                    <div className="admin-home-carousel-field">
                                        <span>详情正文</span>
                                        <HomeCarouselRichTextEditor key={selectedSlide.id} value={selectedSlide.detailContent as JSONContent} disabled={saving} onChange={(detailContent) => updateSelected({ detailContent })} />
                                    </div>
                                    <div className="admin-home-carousel-action-fields">
                                        <label className="admin-home-carousel-field">
                                            <span>首页详情按钮文字</span>
                                            <Input value={selectedSlide.detailButtonLabel} maxLength={40} disabled={saving} placeholder="了解详情" onChange={(event) => updateSelected({ detailButtonLabel: event.target.value })} />
                                        </label>
                                        <label className="admin-home-carousel-field">
                                            <span>详情按钮文字</span>
                                            <Input value={selectedSlide.actionLabel} maxLength={40} disabled={saving} placeholder="开始创作" onChange={(event) => updateSelected({ actionLabel: event.target.value })} />
                                        </label>
                                        <label className="admin-home-carousel-field">
                                            <span>详情跳转地址</span>
                                            <Input
                                                value={selectedSlide.actionUrl}
                                                maxLength={2048}
                                                disabled={saving}
                                                placeholder="/create 或 https://…"
                                                onChange={(event) => updateSelected({ actionUrl: event.target.value })}
                                                suffix={selectedSlide.actionUrl ? <ExternalLink className="size-3.5 text-foreground/40" aria-hidden="true" /> : null}
                                            />
                                        </label>
                                    </div>
                                </div>
                            ) : (
                                <div className="admin-home-carousel-action-fields">
                                    <label className="admin-home-carousel-field">
                                        <span>首页按钮文字</span>
                                        <Input value={selectedSlide.actionLabel} maxLength={40} disabled={saving} placeholder="开始创作" onChange={(event) => updateSelected({ actionLabel: event.target.value })} />
                                    </label>
                                    <label className="admin-home-carousel-field">
                                        <span>首页跳转地址</span>
                                        <Input
                                            value={selectedSlide.actionUrl}
                                            maxLength={2048}
                                            disabled={saving}
                                            placeholder="/create 或 https://…"
                                            onChange={(event) => updateSelected({ actionUrl: event.target.value })}
                                            suffix={selectedSlide.actionUrl ? <ExternalLink className="size-3.5 text-foreground/40" aria-hidden="true" /> : null}
                                        />
                                    </label>
                                </div>
                            )}

                            <div className="admin-home-carousel-preview-block">
                                <div className="admin-home-carousel-preview-heading">
                                    <span>当前项目预览</span>
                                    <AdminStatusBadge label={selectedSlide.enabled ? "首页展示" : "已停用"} tone={selectedSlide.enabled ? "success" : "neutral"} />
                                </div>
                                <div className="admin-home-carousel-preview" aria-label="首页轮播画面预览">
                                    {safeHomeCarouselHref(selectedSlide.videoUrl) ? (
                                        <video key={selectedSlide.videoUrl} src={safeHomeCarouselHref(selectedSlide.videoUrl)} poster={safeHomeCarouselHref(selectedSlide.posterUrl) || undefined} muted loop autoPlay playsInline />
                                    ) : safeHomeCarouselHref(selectedSlide.posterUrl) ? (
                                        <img src={safeHomeCarouselHref(selectedSlide.posterUrl)} alt={selectedSlide.altText} />
                                    ) : (
                                        <div className="admin-home-carousel-preview-empty">添加视频或封面地址以预览</div>
                                    )}
                                    <span className="admin-home-carousel-preview-shade" />
                                    <span className="admin-home-carousel-preview-copy">
                                        <strong>{selectedSlide.title || "标题预览"}</strong>
                                        <small>{selectedSlide.description || "轮播说明预览"}</small>
                                        <em>{selectedSlide.detailEnabled ? selectedSlide.detailButtonLabel : selectedSlide.actionLabel}</em>
                                    </span>
                                </div>
                                {selectedSlide.detailEnabled ? (
                                    <div className="admin-home-carousel-detail-preview">
                                        <strong>{selectedSlide.detailTitle || selectedSlide.title}</strong>
                                        <HomeCarouselRichText document={selectedSlide.detailContent as JSONContent} />
                                        {selectedSlide.actionUrl ? (
                                            <span className="admin-home-carousel-detail-preview-link">
                                                {selectedSlide.actionLabel} <ExternalLink className="size-3" aria-hidden="true" />
                                            </span>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    ) : null}
                </div>
            )}
        </AdminPageFrame>
    );
}
