import { useState, type Key } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Input, Modal, Select, Switch, Tag } from "antd";
import type { TableProps } from "antd";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, X } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import {
    assignCommunityWorksCategory,
    communityAdminMediaUrl,
    getAdminCommunityCategories,
    getAdminCommunityWorks,
    getAdminCreatorChallenges,
    reorderCommunityWork,
    reviewCommunityWork,
    saveCommunityCategory,
    saveCreatorChallenge,
    type AdminCommunityWork,
    type CommunityCategory,
    type CommunityChallengeTrack,
    type CreatorChallenge,
    type CreatorChallengeInput,
} from "@/services/api/community";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { AdminDataTable, AdminTableEmpty, PaginationBar } from "@/pages/admin/components/admin-ui";
import "./community-admin-pages.css";

const WORK_STATUS_OPTIONS = [
    { value: "pending", label: "待审核" },
    { value: "approved", label: "已通过" },
    { value: "rejected", label: "已驳回" },
    { value: "all", label: "全部状态" },
];

function localDateTime(value?: string) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return offsetDate.toISOString().slice(0, 16);
}

function utcDateTime(value: string) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function AdminCommunityWorksPage() {
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState("pending");
    const [keyword, setKeyword] = useState("");
    const debouncedKeyword = useDebouncedValue(keyword.trim(), 250);
    const [categoryFilter, setCategoryFilter] = useState<string>();
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<AdminCommunityWork | null>(null);
    const [reviewNote, setReviewNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
    const [bulkCategoryId, setBulkCategoryId] = useState<string>();
    const [categoryEditor, setCategoryEditor] = useState<{ id?: string; name: string; description: string; sortOrder: number; enabled: boolean } | null>(null);
    const query = useQuery({ queryKey: ["admin-community-works", status, categoryFilter, debouncedKeyword, page], queryFn: () => getAdminCommunityWorks({ status, categoryId: categoryFilter, keyword: debouncedKeyword || undefined, page, pageSize: 20 }) });
    const categoryQuery = useQuery({ queryKey: ["admin-community-categories"], queryFn: getAdminCommunityCategories });

    const review = async (result: "approved" | "rejected") => {
        if (!selected) return;
        if (result === "rejected" && !reviewNote.trim()) {
            message.warning("请填写驳回原因");
            return;
        }
        setSaving(true);
        try {
            await reviewCommunityWork(selected.id, { status: result, note: reviewNote.trim() });
            message.success(result === "approved" ? "作品已通过审核" : "作品已驳回");
            setSelected(null);
            setReviewNote("");
            await queryClient.invalidateQueries({ queryKey: ["admin-community-works"] });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "审核操作失败");
        } finally {
            setSaving(false);
        }
    };

    const updateCategory = async (workIds: string[], categoryId: string) => {
        if (!workIds.length || !categoryId) return;
        setSaving(true);
        try {
            await assignCommunityWorksCategory({ workIds, categoryId });
            message.success(workIds.length > 1 ? "作品已批量归类" : "作品分类已更新");
            setSelectedRowKeys([]);
            setBulkCategoryId(undefined);
            await queryClient.invalidateQueries({ queryKey: ["admin-community-works"] });
            await queryClient.invalidateQueries({ queryKey: ["public-community-works"] });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "更新作品分类失败");
        } finally {
            setSaving(false);
        }
    };

    const moveWork = async (work: AdminCommunityWork, direction: -1 | 1) => {
        if (!categoryFilter || status !== "approved") return;
        setSaving(true);
        try {
            const result = await reorderCommunityWork({ workId: work.id, categoryId: categoryFilter, direction });
            if (!result.moved) message.info("作品已在分类顺序边界");
            await queryClient.invalidateQueries({ queryKey: ["admin-community-works"] });
            await queryClient.invalidateQueries({ queryKey: ["public-community-works"] });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "调整作品顺序失败");
        } finally {
            setSaving(false);
        }
    };

    const columns: TableProps<AdminCommunityWork>["columns"] = [
        {
            title: "作品",
            dataIndex: "title",
            key: "title",
            render: (_, work) => (
                <div className="admin-community-work-name">
                    <img src={communityAdminMediaUrl(work.id, "cover")} alt="" />
                    <div>
                        <strong>{work.title}</strong>
                        <span>{work.creatorName}</span>
                    </div>
                </div>
            ),
        },
        {
            title: "作品分类",
            key: "category",
            render: (_, work) => (
                <Select
                    size="small"
                    value={work.categoryId || undefined}
                    placeholder="未分类"
                    options={(categoryQuery.data?.categories || []).map((item) => ({ value: item.id, label: item.name, disabled: !item.enabled }))}
                    onChange={(value) => void updateCategory([work.id], value)}
                    style={{ minWidth: 130 }}
                />
            ),
        },
        { title: "活动 / 赛道", key: "challenge", render: (_, work) => (work.challengeTitle ? `${work.challengeTitle}${work.trackTitle ? ` · ${work.trackTitle}` : ""}` : "—") },
        {
            title: "社媒链接",
            dataIndex: "socialUrl",
            key: "socialUrl",
            render: (value) =>
                value ? (
                    <a href={value} target="_blank" rel="noreferrer noopener">
                        打开链接
                    </a>
                ) : (
                    "—"
                ),
        },
        { title: "状态", dataIndex: "status", key: "status", render: (value) => <Tag color={value === "approved" ? "green" : value === "rejected" ? "red" : "gold"}>{value === "approved" ? "已通过" : value === "rejected" ? "已驳回" : "待审核"}</Tag> },
        { title: "提交时间", dataIndex: "createdAt", key: "createdAt", render: (value) => new Date(value).toLocaleString("zh-CN") },
        {
            title: "顺序",
            key: "order",
            width: 88,
            render: (_, work, index) => {
                if (status !== "approved" || !categoryFilter) return "—";
                const works = query.data?.works || [];
                const atFirst = page === 1 && index === 0;
                const atLast = page * 20 >= (query.data?.total || 0) && index === works.length - 1;
                return (
                    <div className="admin-community-order-actions">
                        <Button type="text" size="small" aria-label="上移作品" disabled={atFirst || saving} icon={<ArrowUp className="size-3.5" />} onClick={() => void moveWork(work, -1)} />
                        <Button type="text" size="small" aria-label="下移作品" disabled={atLast || saving} icon={<ArrowDown className="size-3.5" />} onClick={() => void moveWork(work, 1)} />
                    </div>
                );
            },
        },
        {
            title: "操作",
            key: "action",
            render: (_, work) => (
                <Button
                    size="small"
                    onClick={() => {
                        setSelected(work);
                        setReviewNote("");
                    }}
                >
                    查看并审核
                </Button>
            ),
        },
    ];

    return (
        <AdminPageFrame
            title="社区作品审核"
            description="用户投稿经审核通过后才会进入公开社区"
            actions={
                <Button icon={<Pencil className="size-4" />} onClick={() => setCategoryEditor({ name: "", description: "", sortOrder: (categoryQuery.data?.categories.length || 0) + 1, enabled: true })}>
                    管理作品分类
                </Button>
            }
        >
            <AdminDataTable<AdminCommunityWork>
                toolbar={
                    <Input.Search
                        allowClear
                        className="admin-community-search"
                        aria-label="搜索社区作品"
                        placeholder="搜索作品标题、创作者、活动或用户 ID"
                        value={keyword}
                        onChange={(event) => {
                            setKeyword(event.target.value);
                            setPage(1);
                            setSelectedRowKeys([]);
                        }}
                    />
                }
                toolbarFilters={
                    <>
                        <Select
                            value={status}
                            options={WORK_STATUS_OPTIONS}
                            onChange={(value) => {
                                setStatus(value);
                                setPage(1);
                                setSelectedRowKeys([]);
                            }}
                        />
                        <Select
                            allowClear
                            value={categoryFilter}
                            placeholder="筛选作品分类"
                            options={(categoryQuery.data?.categories || []).map((item) => ({ value: item.id, label: item.name }))}
                            onChange={(value) => {
                                setCategoryFilter(value);
                                setPage(1);
                                setSelectedRowKeys([]);
                            }}
                        />
                    </>
                }
                toolbarActive={status !== "pending" || Boolean(categoryFilter) || Boolean(keyword.trim())}
                onReset={() => {
                    setStatus("pending");
                    setCategoryFilter(undefined);
                    setKeyword("");
                    setPage(1);
                    setSelectedRowKeys([]);
                }}
                trailing={
                    <>
                        <Select
                            value={bulkCategoryId}
                            placeholder="批量归类到"
                            options={(categoryQuery.data?.categories || []).filter((item) => item.enabled).map((item) => ({ value: item.id, label: item.name }))}
                            onChange={setBulkCategoryId}
                            disabled={!selectedRowKeys.length}
                        />
                        <Button type="primary" disabled={!selectedRowKeys.length || !bulkCategoryId} loading={saving} onClick={() => void updateCategory(selectedRowKeys.map(String), bulkCategoryId || "")}>
                            应用分类（{selectedRowKeys.length}）
                        </Button>
                    </>
                }
                empty={<AdminTableEmpty title={query.isError ? "作品列表读取失败" : "没有匹配的作品"} description={query.isError ? (query.error instanceof Error ? query.error.message : "请重试读取。") : undefined} />}
                footer={
                    <PaginationBar
                        alwaysShow
                        current={page}
                        pageSize={20}
                        total={query.data?.total || 0}
                        pageSizeOptions={[20]}
                        onChange={(next) => {
                            setPage(next);
                            setSelectedRowKeys([]);
                        }}
                    />
                }
                table={{
                    rowKey: "id",
                    className: "app-data-table",
                    size: "small",
                    loading: query.isLoading || query.isFetching,
                    rowSelection: {
                        selectedRowKeys,
                        preserveSelectedRowKeys: true,
                        onChange: (keys) => {
                            if (keys.length > 200) {
                                message.warning("单次最多批量归类 200 个作品");
                                setSelectedRowKeys(keys.slice(0, 200));
                                return;
                            }
                            setSelectedRowKeys(keys);
                        },
                    },
                    columns,
                    dataSource: query.data?.works || [],
                    pagination: false,
                    scroll: { x: 1120 },
                }}
            />
            <Modal className="admin-community-review-modal" open={Boolean(selected)} title="审核社区作品" width={820} onCancel={() => setSelected(null)} footer={null} destroyOnHidden>
                {selected ? (
                    <div className="admin-community-review">
                        <video src={communityAdminMediaUrl(selected.id, "video")} poster={communityAdminMediaUrl(selected.id, "cover")} controls playsInline preload="metadata" />
                        <div className="admin-community-review__copy">
                            <h2>{selected.title}</h2>
                            <p>{selected.description}</p>
                            <span>创作者：{selected.creatorName}</span>
                            <span>活动 / 赛道：{selected.challengeTitle ? `${selected.challengeTitle}${selected.trackTitle ? ` · ${selected.trackTitle}` : ""}` : "未参加活动"}</span>
                            <span>公开画布：{selected.publicCanvas ? "是" : "否"}</span>
                            {selected.socialUrl ? (
                                <a href={selected.socialUrl} target="_blank" rel="noreferrer noopener">
                                    打开社媒作品
                                </a>
                            ) : null}
                            {selected.reviewNote ? <span>上一条审核说明：{selected.reviewNote}</span> : null}
                        </div>
                        <label>
                            审核说明
                            <Input.TextArea rows={2} maxLength={500} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="驳回时必填，可说明需要修改的内容" />
                        </label>
                        <div className="admin-community-review__actions">
                            <Button onClick={() => setSelected(null)}>关闭</Button>
                            <Button danger icon={<X className="size-4" />} loading={saving} disabled={selected.status === "rejected" && !reviewNote.trim()} onClick={() => void review("rejected")}>
                                驳回
                            </Button>
                            <Button type="primary" icon={<Check className="size-4" />} loading={saving} onClick={() => void review("approved")}>
                                审核通过
                            </Button>
                        </div>
                    </div>
                ) : null}
            </Modal>
            <Modal
                open={Boolean(categoryEditor)}
                title={categoryEditor?.id ? "编辑作品分类" : "新增作品分类"}
                onCancel={() => setCategoryEditor(null)}
                okText="保存分类"
                cancelText="取消"
                confirmLoading={saving}
                onOk={async () => {
                    if (!categoryEditor?.name.trim()) {
                        message.warning("请填写分类名称");
                        return;
                    }
                    setSaving(true);
                    try {
                        await saveCommunityCategory({ ...categoryEditor, name: categoryEditor.name.trim(), description: categoryEditor.description.trim() });
                        message.success("作品分类已保存");
                        setCategoryEditor(null);
                        await queryClient.invalidateQueries({ queryKey: ["admin-community-categories"] });
                        await queryClient.invalidateQueries({ queryKey: ["admin-community-works"] });
                    } catch (error) {
                        message.error(error instanceof Error ? error.message : "保存作品分类失败");
                    } finally {
                        setSaving(false);
                    }
                }}
            >
                <div className="admin-community-category-modal">
                    {categoryQuery.data?.categories.length ? (
                        <div className="admin-community-category-list">
                            {categoryQuery.data.categories.map((category) => (
                                <div className="admin-community-category-row" key={category.id}>
                                    <div>
                                        <strong>{category.name}</strong>
                                        <span>
                                            {category.enabled ? "启用" : "停用"} · 顺序 {category.sortOrder}
                                        </span>
                                    </div>
                                    <Button
                                        type="text"
                                        icon={<Pencil className="size-3.5" />}
                                        onClick={() => setCategoryEditor({ id: category.id, name: category.name, description: category.description || "", sortOrder: category.sortOrder, enabled: category.enabled })}
                                    >
                                        编辑
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="admin-community-category-empty">还没有作品分类</p>
                    )}
                    {categoryEditor ? (
                        <div className="admin-community-category-form">
                            <label>
                                名称
                                <Input maxLength={160} value={categoryEditor.name} onChange={(event) => setCategoryEditor({ ...categoryEditor, name: event.target.value })} />
                            </label>
                            <label>
                                说明
                                <Input.TextArea rows={2} maxLength={2000} value={categoryEditor.description} onChange={(event) => setCategoryEditor({ ...categoryEditor, description: event.target.value })} />
                            </label>
                            <div className="admin-community-category-form__row">
                                <label>
                                    展示顺序
                                    <Input type="number" min={0} value={categoryEditor.sortOrder} onChange={(event) => setCategoryEditor({ ...categoryEditor, sortOrder: Number(event.target.value) || 0 })} />
                                </label>
                                <label className="admin-community-enable">
                                    <span>启用分类</span>
                                    <Switch checked={categoryEditor.enabled} onChange={(enabled) => setCategoryEditor({ ...categoryEditor, enabled })} />
                                </label>
                            </div>
                        </div>
                    ) : null}
                </div>
            </Modal>
        </AdminPageFrame>
    );
}

const emptyChallenge: CreatorChallengeInput = { id: "", title: "", description: "", activityTag: "", tracks: [{ id: "", name: "" }], startsAt: undefined, endsAt: undefined, enabled: true };

export function AdminCreatorChallengesPage() {
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const query = useQuery({ queryKey: ["admin-creator-challenges"], queryFn: getAdminCreatorChallenges });
    const [editing, setEditing] = useState<CreatorChallengeInput | null>(null);
    const [keyword, setKeyword] = useState("");
    const [saving, setSaving] = useState(false);

    const openChallenge = (challenge?: CreatorChallenge) => {
        setEditing(
            challenge
                ? {
                      id: challenge.id,
                      title: challenge.title,
                      description: challenge.description,
                      activityTag: challenge.activityTag,
                      tracks: challenge.tracks.map((track) => ({ ...track })),
                      startsAt: challenge.startsAt,
                      endsAt: challenge.endsAt,
                      enabled: challenge.enabled,
                  }
                : { ...emptyChallenge, tracks: [{ id: "", name: "" }] },
        );
    };

    const patchTrack = (index: number, patch: Partial<CommunityChallengeTrack>) => setEditing((current) => (current ? { ...current, tracks: current.tracks.map((track, itemIndex) => (itemIndex === index ? { ...track, ...patch } : track)) } : current));

    const save = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            const payload = { ...editing, startsAt: utcDateTime(localDateTime(editing.startsAt)) || undefined, endsAt: utcDateTime(localDateTime(editing.endsAt)) || undefined, tracks: editing.tracks.filter((track) => track.name.trim()) };
            await saveCreatorChallenge(payload);
            message.success("挑战赛已保存");
            setEditing(null);
            await queryClient.invalidateQueries({ queryKey: ["admin-creator-challenges"] });
            await queryClient.invalidateQueries({ queryKey: ["creator-challenges"] });
            await queryClient.invalidateQueries({ queryKey: ["community-work-options"] });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存挑战赛失败");
        } finally {
            setSaving(false);
        }
    };

    const columns: TableProps<CreatorChallenge>["columns"] = [
        {
            title: "活动名称",
            dataIndex: "title",
            key: "title",
            render: (value, item) => (
                <div className="admin-community-challenge-name">
                    <strong>{value}</strong>
                    <span>{item.activityTag}</span>
                </div>
            ),
        },
        { title: "参赛赛道", dataIndex: "tracks", key: "tracks", render: (tracks: CommunityChallengeTrack[]) => tracks.map((track) => track.name).join("、") },
        { title: "时间", key: "time", render: (_, item) => `${item.startsAt ? new Date(item.startsAt).toLocaleString("zh-CN") : "立即开始"} - ${item.endsAt ? new Date(item.endsAt).toLocaleString("zh-CN") : "不限"}` },
        {
            title: "状态",
            dataIndex: "status",
            key: "status",
            render: (value) => <Tag color={value === "active" ? "green" : value === "upcoming" ? "blue" : "default"}>{value === "active" ? "进行中" : value === "upcoming" ? "即将开始" : value === "ended" ? "已结束" : "已停用"}</Tag>,
        },
        {
            title: "操作",
            key: "action",
            render: (_, item) => (
                <Button size="small" onClick={() => openChallenge(item)}>
                    编辑
                </Button>
            ),
        },
    ];

    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    const filteredChallenges = (query.data?.challenges || []).filter((item) => {
        if (!normalizedKeyword) return true;
        return [item.title, item.activityTag, item.description, ...item.tracks.map((track) => track.name)].some((value) => value.toLocaleLowerCase().includes(normalizedKeyword));
    });

    return (
        <AdminPageFrame
            title="创作者挑战赛"
            description="维护活动展示信息、投稿时间和参赛赛道"
            actions={
                <Button type="primary" icon={<Plus className="size-4" />} onClick={() => openChallenge()}>
                    新增活动
                </Button>
            }
        >
            <AdminDataTable<CreatorChallenge>
                toolbar={<Input.Search allowClear className="admin-community-search" aria-label="搜索创作者挑战赛" placeholder="搜索活动名称、标签或赛道" value={keyword} onChange={(event) => setKeyword(event.target.value)} />}
                toolbarActive={Boolean(keyword.trim())}
                onReset={() => setKeyword("")}
                empty={<AdminTableEmpty title={query.isError ? "活动列表读取失败" : "没有匹配的活动"} description={query.isError && query.error instanceof Error ? query.error.message : undefined} />}
                table={{ rowKey: "id", className: "app-data-table", size: "small", loading: query.isLoading, columns, dataSource: filteredChallenges, pagination: false, scroll: { x: 800 } }}
            />
            <Modal
                className="admin-community-challenge-modal"
                open={Boolean(editing)}
                title={editing?.id ? "编辑创作者挑战赛" : "新增创作者挑战赛"}
                width={680}
                onCancel={() => setEditing(null)}
                onOk={() => void save()}
                confirmLoading={saving}
                okText="保存活动"
                cancelText="取消"
                destroyOnHidden
            >
                {editing ? (
                    <div className="admin-community-challenge-form">
                        <label>
                            活动名称
                            <Input maxLength={160} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
                        </label>
                        <label>
                            活动标签
                            <Input maxLength={120} value={editing.activityTag} onChange={(event) => setEditing({ ...editing, activityTag: event.target.value })} placeholder="发布弹窗中的活动选项名称" />
                        </label>
                        <label className="admin-community-challenge-description">
                            <span>活动详情（Markdown）</span>
                            <Input.TextArea
                                rows={8}
                                maxLength={2000}
                                showCount
                                value={editing.description}
                                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                                placeholder="可使用标题、列表、表格、链接和图片；HTML 不会执行。"
                            />
                            <small>用 ![活动主视觉](/站点资源路径) 设置列表封面；规则与客服二维码会显示在详情页。</small>
                        </label>
                        <div className="admin-community-date-row">
                            <label>
                                开始时间
                                <Input type="datetime-local" value={localDateTime(editing.startsAt)} onChange={(event) => setEditing({ ...editing, startsAt: utcDateTime(event.target.value) })} />
                            </label>
                            <label>
                                结束时间
                                <Input type="datetime-local" value={localDateTime(editing.endsAt)} onChange={(event) => setEditing({ ...editing, endsAt: utcDateTime(event.target.value) })} />
                            </label>
                        </div>
                        <div className="admin-community-track-heading">
                            <strong>参赛赛道</strong>
                            <Button size="small" icon={<Plus className="size-3.5" />} onClick={() => setEditing({ ...editing, tracks: [...editing.tracks, { id: "", name: "" }] })}>
                                添加赛道
                            </Button>
                        </div>
                        <div className="admin-community-track-list">
                            {editing.tracks.map((track, index) => (
                                <div key={`${track.id}-${index}`}>
                                    <Input maxLength={120} value={track.name} onChange={(event) => patchTrack(index, { name: event.target.value })} placeholder={`赛道 ${index + 1}`} />
                                    <Button type="text" danger aria-label={`删除赛道 ${index + 1}`} onClick={() => setEditing({ ...editing, tracks: editing.tracks.filter((_, itemIndex) => itemIndex !== index) })}>
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <div className="admin-community-enable">
                            <span>开放投稿</span>
                            <Switch checked={editing.enabled} onChange={(enabled) => setEditing({ ...editing, enabled })} />
                        </div>
                    </div>
                ) : null}
            </Modal>
        </AdminPageFrame>
    );
}
