import { App, Button, Input, Skeleton } from "antd";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router";

import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { AdminStatusBadge } from "@/pages/admin/components/admin-ui";
import { Switch } from "@/pages/admin/ui/controls";
import { getAdminAcademyConfig, updateAdminAcademyConfig, type AcademyConfig, type AcademyCourse, type AcademySection, type AcademyTab } from "@/services/api/academy";
import "./academy-settings.css";

const MAX_TABS = 12;
const MAX_COURSES = 100;
const MAX_SECTIONS = 40;

function newId(prefix: string) {
    return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function createSection(): AcademySection {
    return { id: newId("section"), title: "新章节", content: "" };
}

function createCourse(): AcademyCourse {
    return {
        id: newId("course"),
        enabled: true,
        title: "新课程",
        detailTitle: "",
        summary: "",
        coverUrl: "/short-drama-styles/nature-healing.jpg",
        tags: [],
        readingDuration: "约 10 分钟",
        featureSummary: "",
        intro: "",
        sections: [{ ...createSection(), title: "课程介绍" }],
        ctaLabel: "前往画布练习",
        ctaUrl: "/canvas",
    };
}

function createTab(): AcademyTab {
    return { id: newId("category"), label: "新分类", enabled: true, courses: [] };
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

export default function AcademySettingsPage() {
    const { message, modal } = App.useApp();
    const [baseline, setBaseline] = useState<AcademyConfig | null>(null);
    const [draft, setDraft] = useState<AcademyConfig>({ enabled: true, title: "学习广场", tabs: [] });
    const [selectedTabId, setSelectedTabId] = useState("");
    const [selectedCourseId, setSelectedCourseId] = useState("");
    const [selectedSectionId, setSelectedSectionId] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState("");
    const requestVersion = useRef(0);

    const dirty = Boolean(baseline) && JSON.stringify(draft) !== JSON.stringify(baseline);
    const blocker = useBlocker(dirty && !saving);
    const selectedTab = useMemo(() => draft.tabs.find((tab) => tab.id === selectedTabId) || draft.tabs[0], [draft.tabs, selectedTabId]);
    const selectedCourse = useMemo(() => selectedTab?.courses.find((course) => course.id === selectedCourseId) || selectedTab?.courses[0], [selectedTab, selectedCourseId]);
    const selectedSection = useMemo(() => selectedCourse?.sections.find((section) => section.id === selectedSectionId) || selectedCourse?.sections[0], [selectedCourse, selectedSectionId]);
    const totalCourses = draft.tabs.reduce((total, tab) => total + tab.courses.length, 0);

    const load = useCallback(
        async (initial = false) => {
            const version = ++requestVersion.current;
            if (initial) setLoading(true);
            else setRefreshing(true);
            try {
                const next = await getAdminAcademyConfig();
                if (version !== requestVersion.current) return;
                setBaseline(structuredClone(next));
                setDraft(next);
                setSelectedTabId((current) => (next.tabs.some((tab) => tab.id === current) ? current : next.tabs[0]?.id || ""));
                const firstTab = next.tabs.find((tab) => tab.id === selectedTabId) || next.tabs[0];
                setSelectedCourseId((current) => (firstTab?.courses.some((course) => course.id === current) ? current : firstTab?.courses[0]?.id || ""));
                const firstCourse = firstTab?.courses.find((course) => course.id === selectedCourseId) || firstTab?.courses[0];
                setSelectedSectionId(firstCourse?.sections[0]?.id || "");
                setLoadError("");
            } catch (error) {
                if (version !== requestVersion.current) return;
                const detail = error instanceof Error ? error.message : "读取学院配置失败";
                setLoadError(detail);
                if (!initial) message.error(detail);
            } finally {
                if (version === requestVersion.current) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        },
        [message, selectedCourseId, selectedTabId],
    );

    useEffect(() => {
        void load(true);
        return () => {
            requestVersion.current += 1;
        };
    }, []);

    useEffect(() => {
        if (blocker.state !== "blocked") return;
        modal.confirm({
            title: "放弃学院配置调整？",
            content: "当前学院配置尚未保存，离开后这些调整会丢失。",
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

    const patchDraft = (update: (current: AcademyConfig) => AcademyConfig) => setDraft((current) => update(current));
    const patchTab = (patch: Partial<AcademyTab>) => {
        if (!selectedTab) return;
        patchDraft((current) => ({ ...current, tabs: current.tabs.map((tab) => (tab.id === selectedTab.id ? { ...tab, ...patch } : tab)) }));
    };
    const patchCourse = (patch: Partial<AcademyCourse>) => {
        if (!selectedTab || !selectedCourse) return;
        patchDraft((current) => ({
            ...current,
            tabs: current.tabs.map((tab) =>
                tab.id === selectedTab.id
                    ? {
                          ...tab,
                          courses: tab.courses.map((course) => (course.id === selectedCourse.id ? { ...course, ...patch } : course)),
                      }
                    : tab,
            ),
        }));
    };
    const patchSection = (patch: Partial<AcademySection>) => {
        if (!selectedTab || !selectedCourse || !selectedSection) return;
        patchCourse({ sections: selectedCourse.sections.map((section) => (section.id === selectedSection.id ? { ...section, ...patch } : section)) });
    };

    const addTab = () => {
        if (draft.tabs.length >= MAX_TABS) return;
        const tab = createTab();
        patchDraft((current) => ({ ...current, tabs: [...current.tabs, tab] }));
        setSelectedTabId(tab.id);
        setSelectedCourseId("");
        setSelectedSectionId("");
    };

    const removeTab = () => {
        if (!selectedTab || draft.tabs.length <= 1) return;
        const index = draft.tabs.findIndex((tab) => tab.id === selectedTab.id);
        const next = draft.tabs.filter((tab) => tab.id !== selectedTab.id);
        patchDraft((current) => ({ ...current, tabs: next }));
        const nextTab = next[Math.max(0, index - 1)] || next[0];
        setSelectedTabId(nextTab.id);
        setSelectedCourseId(nextTab.courses[0]?.id || "");
        setSelectedSectionId(nextTab.courses[0]?.sections[0]?.id || "");
    };

    const addCourse = () => {
        if (!selectedTab || totalCourses >= MAX_COURSES) return;
        const course = createCourse();
        patchTab({ courses: [...selectedTab.courses, course] });
        setSelectedCourseId(course.id);
        setSelectedSectionId(course.sections[0].id);
    };

    const removeCourse = () => {
        if (!selectedTab || !selectedCourse) return;
        const index = selectedTab.courses.findIndex((course) => course.id === selectedCourse.id);
        const next = selectedTab.courses.filter((course) => course.id !== selectedCourse.id);
        patchTab({ courses: next });
        const nextCourse = next[Math.max(0, index - 1)] || next[0];
        setSelectedCourseId(nextCourse?.id || "");
        setSelectedSectionId(nextCourse?.sections[0]?.id || "");
    };

    const addSection = () => {
        if (!selectedCourse || selectedCourse.sections.length >= MAX_SECTIONS) return;
        const section = createSection();
        patchCourse({ sections: [...selectedCourse.sections, section] });
        setSelectedSectionId(section.id);
    };

    const removeSection = () => {
        if (!selectedCourse || !selectedSection || selectedCourse.sections.length <= 1) return;
        const index = selectedCourse.sections.findIndex((section) => section.id === selectedSection.id);
        const next = selectedCourse.sections.filter((section) => section.id !== selectedSection.id);
        patchCourse({ sections: next });
        setSelectedSectionId(next[Math.max(0, index - 1)]?.id || next[0]?.id || "");
    };

    const moveTab = (direction: -1 | 1) => {
        if (!selectedTab) return;
        const index = draft.tabs.findIndex((tab) => tab.id === selectedTab.id);
        patchDraft((current) => ({ ...current, tabs: moveItem(current.tabs, index, direction) }));
    };

    const moveCourse = (direction: -1 | 1) => {
        if (!selectedTab || !selectedCourse) return;
        const index = selectedTab.courses.findIndex((course) => course.id === selectedCourse.id);
        patchTab({ courses: moveItem(selectedTab.courses, index, direction) });
    };

    const moveSection = (direction: -1 | 1) => {
        if (!selectedCourse || !selectedSection) return;
        const index = selectedCourse.sections.findIndex((section) => section.id === selectedSection.id);
        patchCourse({ sections: moveItem(selectedCourse.sections, index, direction) });
    };

    const requestRefresh = () => {
        if (!dirty) {
            void load(false);
            return;
        }
        modal.confirm({
            title: "放弃调整并重新读取？",
            content: "重新读取会丢弃当前学院配置草稿。",
            okText: "放弃并刷新",
            cancelText: "继续编辑",
            okButtonProps: { danger: true },
            onOk: () => load(false),
        });
    };

    const save = async () => {
        if (!baseline || saving || !dirty) return;
        setSaving(true);
        try {
            const next = await updateAdminAcademyConfig(draft);
            setBaseline(structuredClone(next));
            setDraft(next);
            message.success("学院内容已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存学院内容失败");
        } finally {
            setSaving(false);
        }
    };

    const actions = (
        <div className="academy-admin-actions">
            <Button disabled={loading || refreshing || saving} loading={refreshing} onClick={requestRefresh}>
                重新读取
            </Button>
            <Button type="primary" icon={<Save className="size-4" />} disabled={!dirty || loading || refreshing || saving} loading={saving} onClick={() => void save()}>
                保存
            </Button>
        </div>
    );

    return (
        <AdminPageFrame title="学院内容" description="配置前台分类、课程卡片与图文详情。" actions={actions} scroll>
            {loading ? (
                <div className="academy-admin-loading">
                    <Skeleton active paragraph={{ rows: 12 }} />
                </div>
            ) : loadError ? (
                <div className="academy-admin-error" role="alert">
                    <p>{loadError}</p>
                    <Button onClick={() => void load(true)}>重试</Button>
                </div>
            ) : (
                <div className="academy-admin">
                    <section className="academy-admin-global" aria-labelledby="academy-global-title">
                        <div className="academy-admin-section-heading">
                            <div>
                                <h2 id="academy-global-title">前台显示</h2>
                                <p>控制学院入口内容与页面标题</p>
                            </div>
                            <Switch checked={draft.enabled} disabled={saving} aria-label="开放学院页面" onChange={(enabled) => patchDraft((current) => ({ ...current, enabled }))} />
                        </div>
                        <label className="academy-admin-field academy-admin-title-field">
                            <span>页面标题</span>
                            <Input value={draft.title} maxLength={60} disabled={saving} onChange={(event) => patchDraft((current) => ({ ...current, title: event.target.value }))} />
                        </label>
                    </section>

                    <section className="academy-admin-categories" aria-labelledby="academy-categories-title">
                        <div className="academy-admin-section-heading">
                            <div>
                                <h2 id="academy-categories-title">课程分类</h2>
                                <p>
                                    {draft.tabs.length}/{MAX_TABS} 个分类 · {totalCourses}/{MAX_COURSES} 门课程
                                </p>
                            </div>
                            <Button icon={<Plus className="size-4" />} disabled={draft.tabs.length >= MAX_TABS || saving} onClick={addTab}>
                                新增分类
                            </Button>
                        </div>
                        <div className="academy-admin-tabs" role="tablist" aria-label="编辑课程分类">
                            {draft.tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={selectedTab?.id === tab.id}
                                    className={selectedTab?.id === tab.id ? "is-active" : ""}
                                    onClick={() => {
                                        setSelectedTabId(tab.id);
                                        setSelectedCourseId(tab.courses[0]?.id || "");
                                        setSelectedSectionId(tab.courses[0]?.sections[0]?.id || "");
                                    }}
                                >
                                    {tab.label || "未命名分类"}
                                </button>
                            ))}
                        </div>
                        {selectedTab ? (
                            <div className="academy-admin-category-fields">
                                <label className="academy-admin-field">
                                    <span>分类名称</span>
                                    <Input value={selectedTab.label} maxLength={40} disabled={saving} onChange={(event) => patchTab({ label: event.target.value })} />
                                </label>
                                <label className="academy-admin-field">
                                    <span>分类 ID</span>
                                    <Input value={selectedTab.id} disabled />
                                </label>
                                <label className="academy-admin-enabled">
                                    <span>前台显示</span>
                                    <Switch checked={selectedTab.enabled} disabled={saving} aria-label="显示当前分类" onChange={(enabled) => patchTab({ enabled })} />
                                </label>
                                <div className="academy-admin-row-actions">
                                    <Button title="分类上移" aria-label="分类上移" icon={<ArrowUp className="size-4" />} disabled={draft.tabs[0]?.id === selectedTab.id || saving} onClick={() => moveTab(-1)} />
                                    <Button title="分类下移" aria-label="分类下移" icon={<ArrowDown className="size-4" />} disabled={draft.tabs.at(-1)?.id === selectedTab.id || saving} onClick={() => moveTab(1)} />
                                    <Button danger title="删除分类" aria-label="删除分类" icon={<Trash2 className="size-4" />} disabled={draft.tabs.length <= 1 || saving} onClick={removeTab} />
                                </div>
                            </div>
                        ) : null}
                    </section>

                    {selectedTab ? (
                        <section className="academy-admin-courses" aria-labelledby="academy-courses-title">
                            <div className="academy-admin-section-heading">
                                <div>
                                    <h2 id="academy-courses-title">{selectedTab.label || "分类"}中的课程</h2>
                                    <p>{selectedTab.courses.length} 门课程</p>
                                </div>
                                <Button icon={<Plus className="size-4" />} disabled={totalCourses >= MAX_COURSES || saving} onClick={addCourse}>
                                    新增课程
                                </Button>
                            </div>
                            <div className="academy-admin-course-layout">
                                <div className="academy-admin-course-list" role="listbox" aria-label="选择课程">
                                    {selectedTab.courses.length ? (
                                        selectedTab.courses.map((course, index) => (
                                            <button
                                                key={course.id}
                                                type="button"
                                                role="option"
                                                aria-selected={selectedCourse?.id === course.id}
                                                className={selectedCourse?.id === course.id ? "is-active" : ""}
                                                onClick={() => {
                                                    setSelectedCourseId(course.id);
                                                    setSelectedSectionId(course.sections[0]?.id || "");
                                                }}
                                            >
                                                <span>
                                                    <strong>{course.title.replaceAll("\n", " ") || "未命名课程"}</strong>
                                                    <small>{course.sections.length} 个章节</small>
                                                </span>
                                                <AdminStatusBadge label={course.enabled ? "展示" : "停用"} tone={course.enabled ? "success" : "neutral"} />
                                                <span className="academy-admin-course-order" aria-hidden="true">
                                                    {index + 1}
                                                </span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="academy-admin-empty">这个分类还没有课程</div>
                                    )}
                                </div>
                                {selectedCourse ? (
                                    <div className="academy-admin-course-editor">
                                        <div className="academy-admin-course-heading">
                                            <div>
                                                <h3>{selectedCourse.title.replaceAll("\n", " ") || "课程编辑"}</h3>
                                                <span>{selectedCourse.id}</span>
                                            </div>
                                            <div className="academy-admin-row-actions">
                                                <Button title="课程上移" aria-label="课程上移" icon={<ArrowUp className="size-4" />} disabled={selectedTab.courses[0]?.id === selectedCourse.id || saving} onClick={() => moveCourse(-1)} />
                                                <Button title="课程下移" aria-label="课程下移" icon={<ArrowDown className="size-4" />} disabled={selectedTab.courses.at(-1)?.id === selectedCourse.id || saving} onClick={() => moveCourse(1)} />
                                                <Button danger title="删除课程" aria-label="删除课程" icon={<Trash2 className="size-4" />} disabled={saving} onClick={removeCourse} />
                                            </div>
                                        </div>
                                        <div className="academy-admin-course-status">
                                            <span>前台展示</span>
                                            <Switch checked={selectedCourse.enabled} disabled={saving} aria-label="展示当前课程" onChange={(enabled) => patchCourse({ enabled })} />
                                        </div>
                                        <div className="academy-admin-form-grid">
                                            <label className="academy-admin-field">
                                                <span>卡片标题</span>
                                                <Input value={selectedCourse.title} maxLength={100} disabled={saving} onChange={(event) => patchCourse({ title: event.target.value })} />
                                            </label>
                                            <label className="academy-admin-field">
                                                <span>课程 ID</span>
                                                <Input value={selectedCourse.id} disabled />
                                            </label>
                                            <label className="academy-admin-field academy-admin-field-wide">
                                                <span>详情页标题</span>
                                                <Input value={selectedCourse.detailTitle || ""} maxLength={120} placeholder="留空时使用卡片标题" disabled={saving} onChange={(event) => patchCourse({ detailTitle: event.target.value })} />
                                            </label>
                                            <label className="academy-admin-field academy-admin-field-wide">
                                                <span>卡片简介</span>
                                                <Input.TextArea value={selectedCourse.summary} maxLength={500} autoSize={{ minRows: 2, maxRows: 4 }} disabled={saving} onChange={(event) => patchCourse({ summary: event.target.value })} />
                                            </label>
                                            <label className="academy-admin-field academy-admin-field-wide">
                                                <span>封面地址</span>
                                                <Input value={selectedCourse.coverUrl} maxLength={2048} placeholder="/assets/course-cover.jpg 或 https://..." disabled={saving} onChange={(event) => patchCourse({ coverUrl: event.target.value })} />
                                            </label>
                                            <label className="academy-admin-field academy-admin-field-wide">
                                                <span>涉及功能</span>
                                                <Input.TextArea value={selectedCourse.featureSummary} maxLength={500} autoSize={{ minRows: 2, maxRows: 4 }} disabled={saving} onChange={(event) => patchCourse({ featureSummary: event.target.value })} />
                                            </label>
                                            <label className="academy-admin-field">
                                                <span>课程标签</span>
                                                <Input
                                                    value={selectedCourse.tags.join(", ")}
                                                    maxLength={500}
                                                    placeholder="基础教程, 画布"
                                                    disabled={saving}
                                                    onChange={(event) =>
                                                        patchCourse({
                                                            tags: event.target.value
                                                                .split(",")
                                                                .map((tag) => tag.trim())
                                                                .filter(Boolean),
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label className="academy-admin-field">
                                                <span>阅读时长</span>
                                                <Input value={selectedCourse.readingDuration} maxLength={40} placeholder="约 15 分钟" disabled={saving} onChange={(event) => patchCourse({ readingDuration: event.target.value })} />
                                            </label>
                                            <label className="academy-admin-field academy-admin-field-wide">
                                                <span>课程导语</span>
                                                <Input.TextArea value={selectedCourse.intro} maxLength={4000} autoSize={{ minRows: 3, maxRows: 8 }} disabled={saving} onChange={(event) => patchCourse({ intro: event.target.value })} />
                                            </label>
                                            <label className="academy-admin-field">
                                                <span>练习按钮文案</span>
                                                <Input value={selectedCourse.ctaLabel} maxLength={80} disabled={saving} onChange={(event) => patchCourse({ ctaLabel: event.target.value })} />
                                            </label>
                                            <label className="academy-admin-field">
                                                <span>练习跳转地址</span>
                                                <Input value={selectedCourse.ctaUrl} maxLength={2048} placeholder="/canvas" disabled={saving} onChange={(event) => patchCourse({ ctaUrl: event.target.value })} />
                                            </label>
                                        </div>

                                        <div className="academy-admin-chapters">
                                            <div className="academy-admin-section-heading">
                                                <div>
                                                    <h4>详情章节</h4>
                                                    <p>
                                                        {selectedCourse.sections.length}/{MAX_SECTIONS} 个章节
                                                    </p>
                                                </div>
                                                <Button icon={<Plus className="size-4" />} disabled={selectedCourse.sections.length >= MAX_SECTIONS || saving} onClick={addSection}>
                                                    新增章节
                                                </Button>
                                            </div>
                                            <div className="academy-admin-chapter-tabs" role="tablist" aria-label="编辑课程章节">
                                                {selectedCourse.sections.map((section) => (
                                                    <button
                                                        key={section.id}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={selectedSection?.id === section.id}
                                                        className={selectedSection?.id === section.id ? "is-active" : ""}
                                                        onClick={() => setSelectedSectionId(section.id)}
                                                    >
                                                        {section.title || "未命名章节"}
                                                    </button>
                                                ))}
                                            </div>
                                            {selectedSection ? (
                                                <>
                                                    <div className="academy-admin-chapter-fields">
                                                        <label className="academy-admin-field">
                                                            <span>章节标题</span>
                                                            <Input value={selectedSection.title} maxLength={100} disabled={saving} onChange={(event) => patchSection({ title: event.target.value })} />
                                                        </label>
                                                        <label className="academy-admin-field">
                                                            <span>章节 ID</span>
                                                            <Input value={selectedSection.id} disabled />
                                                        </label>
                                                        <div className="academy-admin-row-actions">
                                                            <Button title="章节上移" aria-label="章节上移" icon={<ArrowUp className="size-4" />} disabled={selectedCourse.sections[0]?.id === selectedSection.id || saving} onClick={() => moveSection(-1)} />
                                                            <Button
                                                                title="章节下移"
                                                                aria-label="章节下移"
                                                                icon={<ArrowDown className="size-4" />}
                                                                disabled={selectedCourse.sections.at(-1)?.id === selectedSection.id || saving}
                                                                onClick={() => moveSection(1)}
                                                            />
                                                            <Button danger title="删除章节" aria-label="删除章节" icon={<Trash2 className="size-4" />} disabled={selectedCourse.sections.length <= 1 || saving} onClick={removeSection} />
                                                        </div>
                                                    </div>
                                                    <label className="academy-admin-field academy-admin-markdown-field">
                                                        <span>章节正文（Markdown）</span>
                                                        <Input.TextArea
                                                            value={selectedSection.content}
                                                            maxLength={32 * 1024}
                                                            showCount
                                                            autoSize={{ minRows: 12, maxRows: 28 }}
                                                            disabled={saving}
                                                            onChange={(event) => patchSection({ content: event.target.value })}
                                                        />
                                                    </label>
                                                </>
                                            ) : null}
                                        </div>
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
