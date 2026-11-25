import type { JSONContent } from "@tiptap/core";
import type { ReactNode } from "react";
import { Link } from "react-router";

export function HomeCarouselRichText({ document, className }: { document: JSONContent; className?: string }) {
    return <div className={className || "home-carousel-rich-text"}>{renderChildren(document.content)}</div>;
}

function renderChildren(content?: JSONContent[]) {
    return content?.map((node, index) => <HomeCarouselNode key={`${node.type}-${index}`} node={node} />);
}

function HomeCarouselNode({ node }: { node: JSONContent }) {
    if (node.type === "text") return renderText(node);
    if (node.type === "hardBreak") return <br />;
    if (node.type === "horizontalRule") return <hr />;

    const children = renderChildren(node.content);
    switch (node.type) {
        case "paragraph":
            return <p>{children}</p>;
        case "heading": {
            const level = Math.min(4, Math.max(2, Number(node.attrs?.level) || 2));
            if (level === 2) return <h2>{children}</h2>;
            if (level === 3) return <h3>{children}</h3>;
            return <h4>{children}</h4>;
        }
        case "bulletList":
            return <ul>{children}</ul>;
        case "orderedList":
            return <ol>{children}</ol>;
        case "listItem":
            return <li>{children}</li>;
        case "blockquote":
            return <blockquote>{children}</blockquote>;
        default:
            return null;
    }
}

function renderText(node: JSONContent) {
    let children: ReactNode = node.text || "";
    for (const mark of node.marks || []) {
        if (mark.type === "bold") children = <strong>{children}</strong>;
        else if (mark.type === "italic") children = <em>{children}</em>;
        else if (mark.type === "strike") children = <s>{children}</s>;
        else if (mark.type === "code") children = <code>{children}</code>;
        else if (mark.type === "link") {
            const href = safeHomeCarouselHref(typeof mark.attrs?.href === "string" ? mark.attrs.href : "");
            if (href) {
                const external = /^https:\/\//i.test(href);
                children = external ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                    </a>
                ) : (
                    <Link to={href}>{children}</Link>
                );
            }
        }
    }
    return children;
}

export function safeHomeCarouselHref(value: string) {
    const href = value.trim();
    if (href.startsWith("/") && !href.startsWith("//")) return href;
    try {
        const parsed = new URL(href);
        return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : "";
    } catch {
        return "";
    }
}
