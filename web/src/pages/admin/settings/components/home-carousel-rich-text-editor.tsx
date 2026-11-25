import { EditorContent, useEditor } from "@tiptap/react";
import CharacterCount from "@tiptap/extension-character-count";
import { Link } from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { StarterKit } from "@tiptap/starter-kit";
import type { JSONContent } from "@tiptap/core";
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Strikethrough, Unlink } from "lucide-react";
import { Button, Input } from "antd";
import { useEffect, useState } from "react";

import { safeHomeCarouselHref } from "@/components/home/home-carousel-rich-text";
import { EMPTY_HOME_CAROUSEL_DOCUMENT } from "@/lib/home-carousel";

const MAX_CHARS = 4000;

export function HomeCarouselRichTextEditor({ value, disabled, onChange }: { value: JSONContent; disabled: boolean; onChange: (value: JSONContent) => void }) {
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkValue, setLinkValue] = useState("");
    const editor = useEditor({
        immediatelyRender: false,
        editable: !disabled,
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3, 4] },
                link: false,
            }),
            Link.configure({ openOnClick: false, autolink: false, protocols: ["https"] }),
            CharacterCount.configure({ limit: MAX_CHARS }),
            Placeholder.configure({ placeholder: "输入详情内容，可使用标题、列表和安全链接" }),
        ],
        content: value || EMPTY_HOME_CAROUSEL_DOCUMENT,
        onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getJSON()),
    });

    useEffect(() => {
        if (!editor) return;
        editor.setEditable(!disabled);
    }, [disabled, editor]);

    useEffect(() => {
        if (!editor) return;
        const current = JSON.stringify(editor.getJSON());
        const next = JSON.stringify(value || EMPTY_HOME_CAROUSEL_DOCUMENT);
        if (current !== next) editor.commands.setContent(value || EMPTY_HOME_CAROUSEL_DOCUMENT, { emitUpdate: false });
    }, [editor, value]);

    const applyLink = () => {
        if (!editor) return;
        const href = safeHomeCarouselHref(linkValue);
        if (!href) return;
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
        setLinkOpen(false);
        setLinkValue("");
    };

    const toolbar = [
        { label: "粗体", icon: <Bold />, active: Boolean(editor?.isActive("bold")), run: () => editor?.chain().focus().toggleBold().run() },
        { label: "斜体", icon: <Italic />, active: Boolean(editor?.isActive("italic")), run: () => editor?.chain().focus().toggleItalic().run() },
        { label: "删除线", icon: <Strikethrough />, active: Boolean(editor?.isActive("strike")), run: () => editor?.chain().focus().toggleStrike().run() },
        { label: "二级标题", icon: <Heading2 />, active: Boolean(editor?.isActive("heading", { level: 2 })), run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
        { label: "无序列表", icon: <List />, active: Boolean(editor?.isActive("bulletList")), run: () => editor?.chain().focus().toggleBulletList().run() },
        { label: "有序列表", icon: <ListOrdered />, active: Boolean(editor?.isActive("orderedList")), run: () => editor?.chain().focus().toggleOrderedList().run() },
        { label: "引用", icon: <Quote />, active: Boolean(editor?.isActive("blockquote")), run: () => editor?.chain().focus().toggleBlockquote().run() },
    ];
    const characterCount = editor?.storage.characterCount.characters() || 0;

    return (
        <div className="home-carousel-rich-editor" aria-label="详情富文本编辑器">
            <div className="home-carousel-rich-editor__toolbar" role="toolbar" aria-label="详情文字格式">
                {toolbar.map((item) => (
                    <Button key={item.label} type={item.active ? "primary" : "text"} size="small" disabled={disabled || !editor} icon={item.icon} aria-label={item.label} aria-pressed={item.active} title={item.label} onClick={item.run} />
                ))}
                <Button
                    type={editor?.isActive("link") ? "primary" : "text"}
                    size="small"
                    disabled={disabled || !editor}
                    icon={editor?.isActive("link") ? <Unlink /> : <Link2 />}
                    aria-label={editor?.isActive("link") ? "移除链接" : "插入链接"}
                    title={editor?.isActive("link") ? "移除链接" : "插入链接"}
                    onClick={() => {
                        if (!editor) return;
                        if (editor.isActive("link")) {
                            editor.chain().focus().unsetLink().run();
                            return;
                        }
                        setLinkValue(String(editor.getAttributes("link").href || ""));
                        setLinkOpen((open) => !open);
                    }}
                />
                <span className="home-carousel-rich-editor__count">
                    {characterCount}/{MAX_CHARS}
                </span>
            </div>
            {linkOpen ? (
                <form
                    className="home-carousel-rich-editor__link-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        applyLink();
                    }}
                >
                    <Input autoFocus value={linkValue} placeholder="https:// 或 /站内路径" onChange={(event) => setLinkValue(event.target.value)} disabled={disabled} />
                    <Button type="primary" htmlType="submit" disabled={!safeHomeCarouselHref(linkValue)}>
                        应用
                    </Button>
                    <Button onClick={() => setLinkOpen(false)}>取消</Button>
                </form>
            ) : null}
            <EditorContent editor={editor} className="home-carousel-rich-editor__content" />
        </div>
    );
}
