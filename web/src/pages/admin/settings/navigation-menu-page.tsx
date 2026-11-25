import { App, Button, Input, InputNumber, Popconfirm, Select, Space, Switch, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteAdminNavigationMenuItem, getAdminNavigationMenu, saveAdminNavigationMenu, type NavigationMenuItem } from "@/services/api/navigation-menu";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";

const menuIcons = ["PenTool", "Images", "PanelsTopLeft", "Clapperboard", "Users", "ShoppingBag", "Image", "Video", "LibraryBig", "Blocks", "History", "GraduationCap", "TvMinimalPlay", "Trophy", "Sparkles", "Settings2"];

function NavigationMenuPageContent({ contactOnly = false }: { contactOnly?: boolean }) {
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const query = useQuery({ queryKey: ["admin-navigation-menu"], queryFn: getAdminNavigationMenu });
    const [items, setItems] = useState<NavigationMenuItem[]>([]);
    const [draft, setDraft] = useState({ id: "", title: "", path: "", groupTitle: "社区", groupOrder: 2, sortOrder: 40, icon: "Sparkles" });

    useEffect(() => {
        if (query.data?.items) setItems(query.data.items);
    }, [query.data?.items]);

    const saveMutation = useMutation({
        mutationFn: () => saveAdminNavigationMenu(items.map(({ builtIn: _builtIn, ...item }) => item)),
        onSuccess: async ({ items: saved }) => {
            setItems(saved);
            await queryClient.invalidateQueries({ queryKey: ["public-navigation-menu"] });
            message.success("全站导航已更新");
        },
        onError: (error) => message.error(error instanceof Error ? error.message : "保存导航失败"),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteAdminNavigationMenuItem,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["admin-navigation-menu"] });
            await queryClient.invalidateQueries({ queryKey: ["public-navigation-menu"] });
            message.success("菜单已删除");
        },
        onError: (error) => message.error(error instanceof Error ? error.message : "删除菜单失败"),
    });

    const updateItem = (id: string, changes: Partial<NavigationMenuItem>) => {
        setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    };

    const addItem = () => {
        const id = draft.id.trim().toLowerCase();
        if (!id || items.some((item) => item.id === id)) {
            message.error("请输入唯一的小写菜单标识");
            return;
        }
        setItems((current) => [...current, { ...draft, id, builtIn: false, enabled: true, contactCards: [] }]);
        setDraft((current) => ({ ...current, id: "", title: "", path: "" }));
    };

    const columns: ColumnsType<NavigationMenuItem> = [
        { title: "全站显示", dataIndex: "enabled", width: 100, render: (_, item) => <Switch checked={item.enabled} onChange={(enabled) => updateItem(item.id, { enabled })} aria-label={`${item.title}全站显示`} /> },
        { title: "分组", dataIndex: "groupTitle", width: 145, render: (_, item) => (item.id === "contact-us" ? "侧栏底部" : <Input value={item.groupTitle} onChange={(event) => updateItem(item.id, { groupTitle: event.target.value })} />) },
        { title: "菜单名称", dataIndex: "title", width: 150, render: (_, item) => <Input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} /> },
        { title: "站内路径", dataIndex: "path", width: 220, render: (_, item) => <Input value={item.path} onChange={(event) => updateItem(item.id, { path: event.target.value })} disabled={item.id === "contact-us"} /> },
        { title: "图标", dataIndex: "icon", width: 145, render: (_, item) => <Select value={item.icon} options={menuIcons.map((icon) => ({ value: icon, label: icon }))} onChange={(icon) => updateItem(item.id, { icon })} className="w-full" /> },
        { title: "分组顺序", dataIndex: "groupOrder", width: 110, render: (_, item) => <InputNumber value={item.groupOrder} onChange={(groupOrder) => updateItem(item.id, { groupOrder: groupOrder ?? 0 })} min={0} className="w-full" /> },
        { title: "菜单顺序", dataIndex: "sortOrder", width: 110, render: (_, item) => <InputNumber value={item.sortOrder} onChange={(sortOrder) => updateItem(item.id, { sortOrder: sortOrder ?? 0 })} min={0} className="w-full" /> },
        { title: "类型", dataIndex: "builtIn", width: 95, render: (_, item) => (item.builtIn ? "内置" : "自定义") },
        {
            title: "操作",
            key: "actions",
            width: 84,
            render: (_, item) => (
                <Popconfirm title="删除此菜单？" description="自定义菜单删除后无法恢复。" onConfirm={() => deleteMutation.mutate(item.id)} disabled={item.builtIn}>
                    <Button aria-label={`删除${item.title}`} title={item.builtIn ? "内置菜单不能删除" : "删除菜单"} icon={<Trash2 className="size-4" />} disabled={item.builtIn || deleteMutation.isPending} />
                </Popconfirm>
            ),
        },
    ];

    return (
        <AdminPageFrame
            title={contactOnly ? "联系我们配置" : "Linghua 个性化主菜单"}
            description={contactOnly ? "配置工作区侧栏底部“联系我们”弹窗中的联系卡片和二维码。" : "管理 Linghua 新增页面在全站侧边栏中的分组、顺序与显示状态。"}
            scroll
            actions={
                <Button type="primary" icon={<Save className="size-4" />} loading={saveMutation.isPending} disabled={!items.length} onClick={() => saveMutation.mutate()}>
                    {contactOnly ? "保存联系我们" : "保存全站导航"}
                </Button>
            }
        >
            {!contactOnly ? (
                <div className="mb-4 flex flex-wrap items-end gap-2">
                    <Input aria-label="菜单标识" placeholder="菜单标识，如 academy" value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} className="w-44" />
                    <Input aria-label="菜单名称" placeholder="菜单名称" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="w-40" />
                    <Input aria-label="站内路径" placeholder="/feature" value={draft.path} onChange={(event) => setDraft({ ...draft, path: event.target.value })} className="w-52" />
                    <Input aria-label="分组名称" placeholder="分组名称" value={draft.groupTitle} onChange={(event) => setDraft({ ...draft, groupTitle: event.target.value })} className="w-36" />
                    <Select aria-label="菜单图标" value={draft.icon} options={menuIcons.map((icon) => ({ value: icon, label: icon }))} onChange={(icon) => setDraft({ ...draft, icon })} className="w-40" />
                    <Space>
                        <InputNumber aria-label="分组顺序" value={draft.groupOrder} onChange={(groupOrder) => setDraft({ ...draft, groupOrder: groupOrder ?? 0 })} min={0} />
                        <InputNumber aria-label="菜单顺序" value={draft.sortOrder} onChange={(sortOrder) => setDraft({ ...draft, sortOrder: sortOrder ?? 0 })} min={0} />
                    </Space>
                    <Button icon={<Plus className="size-4" />} onClick={addItem}>
                        添加菜单
                    </Button>
                </div>
            ) : null}
            {!contactOnly ? <Table rowKey="id" columns={columns} dataSource={items} loading={query.isLoading || query.isFetching} pagination={false} scroll={{ x: 1200 }} size="middle" /> : null}
            <section className={contactOnly ? "" : "mt-8 border-t border-border pt-6"} aria-labelledby="contact-cards-heading">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 id="contact-cards-heading" className="text-base font-semibold">
                            联系我们内容
                        </h2>
                        <p className="mt-1 text-sm text-foreground/55">配置侧栏弹窗中的联系卡片和二维码图片。</p>
                    </div>
                    <Button
                        icon={<Plus className="size-4" />}
                        disabled={(items.find((item) => item.id === "contact-us")?.contactCards.length || 0) >= 6}
                        onClick={() => updateItem("contact-us", { contactCards: [...(items.find((item) => item.id === "contact-us")?.contactCards || []), { title: "", description: "", imageUrl: "" }] })}
                    >
                        添加联系卡片
                    </Button>
                </div>
                <div className="flex flex-col divide-y divide-border">
                    {(items.find((item) => item.id === "contact-us")?.contactCards || []).map((card, index) => {
                        const contactMenu = items.find((item) => item.id === "contact-us");
                        return (
                            <div key={`contact-card-${index}`} className="grid gap-3 py-4 md:grid-cols-[minmax(180px,1fr)_minmax(220px,1.5fr)_minmax(220px,1.5fr)_auto] md:items-start">
                                <Input
                                    aria-label={`联系卡片${index + 1}标题`}
                                    placeholder="标题，如飞书群"
                                    value={card.title}
                                    onChange={(event) => updateItem("contact-us", { contactCards: (contactMenu?.contactCards || []).map((item, cardIndex) => (cardIndex === index ? { ...item, title: event.target.value } : item)) })}
                                />
                                <Input.TextArea
                                    aria-label={`联系卡片${index + 1}说明`}
                                    placeholder="说明文字"
                                    value={card.description}
                                    autoSize={{ minRows: 1, maxRows: 3 }}
                                    maxLength={240}
                                    onChange={(event) => updateItem("contact-us", { contactCards: (contactMenu?.contactCards || []).map((item, cardIndex) => (cardIndex === index ? { ...item, description: event.target.value } : item)) })}
                                />
                                <Input
                                    aria-label={`联系卡片${index + 1}二维码图片地址`}
                                    placeholder="二维码图片地址（https:// 或站内路径）"
                                    value={card.imageUrl}
                                    onChange={(event) => updateItem("contact-us", { contactCards: (contactMenu?.contactCards || []).map((item, cardIndex) => (cardIndex === index ? { ...item, imageUrl: event.target.value } : item)) })}
                                />
                                <Button
                                    aria-label={`删除联系卡片${index + 1}`}
                                    title="删除卡片"
                                    icon={<Trash2 className="size-4" />}
                                    onClick={() => updateItem("contact-us", { contactCards: (contactMenu?.contactCards || []).filter((_, cardIndex) => cardIndex !== index) })}
                                />
                            </div>
                        );
                    })}
                    {!items.find((item) => item.id === "contact-us")?.contactCards.length ? <p className="py-6 text-sm text-foreground/50">暂无联系卡片</p> : null}
                </div>
            </section>
        </AdminPageFrame>
    );
}

export default function NavigationMenuPage() {
    return <NavigationMenuPageContent />;
}

export function ContactUsSettingsPage() {
    return <NavigationMenuPageContent contactOnly />;
}
