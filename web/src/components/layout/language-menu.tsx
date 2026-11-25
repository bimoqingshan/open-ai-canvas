import { Dropdown } from "antd";
import { Check, ChevronDown, Globe2, Languages } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { switchLocale } from "@/i18n";
import { SUPPORTED_LOCALES, type AppLocale } from "@/i18n/locales";
import { cn } from "@/lib/utils";
import { useLocaleStore } from "@/stores/use-locale-store";

import "./language-menu.css";

/**
 * 界面语言入口。顶栏用图标，登录页显示当前语言。
 * 选项显示各语言自称 + 英文名，切换后整页刷新（见 switchLocale）。
 */
export function LanguageMenu({ variant = "topbar", className }: { variant?: "topbar" | "auth" | "account"; className?: string }) {
    const { t } = useTranslation();
    const locale = useLocaleStore((state) => state.locale);
    const current = SUPPORTED_LOCALES.find((item) => item.code === locale) ?? SUPPORTED_LOCALES[0];
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    if (variant === "account") {
        return (
            <div className={cn("workspace-account-language", className)}>
                <button
                    type="button"
                    className="workspace-account-language-trigger"
                    aria-expanded={accountMenuOpen}
                    aria-controls="workspace-account-language-options"
                    aria-label={t("language.selectLabel")}
                    title={t("language.selectLabel")}
                    onClick={() => setAccountMenuOpen((open) => !open)}
                >
                    <Globe2 aria-hidden="true" />
                    <span>{t("language.label")}</span>
                    <small lang={current.code}>{current.label}</small>
                    <ChevronDown aria-hidden="true" />
                </button>
                <div id="workspace-account-language-options" className="workspace-account-language-options" role="group" aria-label={t("language.selectLabel")} hidden={!accountMenuOpen}>
                    {SUPPORTED_LOCALES.map((item) => (
                        <button
                            key={item.code}
                            type="button"
                            lang={item.code}
                            aria-pressed={locale === item.code}
                            onClick={() => {
                                setAccountMenuOpen(false);
                                switchLocale(item.code);
                            }}
                        >
                            <Globe2 aria-hidden="true" />
                            <span>{item.label}</span>
                            {locale === item.code ? <Check aria-hidden="true" /> : null}
                        </button>
                    ))}
                </div>
            </div>
        );
    }
    return (
        <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            rootClassName="language-menu-dropdown"
            menu={{
                selectedKeys: [locale],
                items: SUPPORTED_LOCALES.map((item) => ({
                    key: item.code,
                    label: (
                        <span className="language-menu-option" lang={item.code}>
                            <span className="language-menu-option-copy">
                                <strong>{item.label}</strong>
                                <small>{item.english}</small>
                            </span>
                            {item.code === locale ? <Check aria-hidden className="language-menu-option-check" /> : null}
                        </span>
                    ),
                })),
                onClick: ({ key }) => switchLocale(key as AppLocale),
            }}
        >
            <button
                type="button"
                className={cn(variant === "topbar" ? "app-workspace-topbar-icon-button" : "auth-scene-return language-menu-auth-trigger", "language-menu-trigger", className)}
                aria-label={t("language.selectLabel")}
                title={t("language.selectLabel")}
            >
                <Languages aria-hidden />
                {variant === "auth" ? (
                    <>
                        <span>{current.short}</span>
                        <ChevronDown aria-hidden className="language-menu-chevron" />
                    </>
                ) : null}
            </button>
        </Dropdown>
    );
}

/** 设置页使用的语言卡片组：一眼看到全部语言，当前语言用 aria-pressed 标出。 */
export function LanguageOptionGrid() {
    const locale = useLocaleStore((state) => state.locale);
    return (
        <div className="language-option-grid" role="group">
            {SUPPORTED_LOCALES.map((item) => (
                <button key={item.code} type="button" lang={item.code} className="language-option-card" aria-pressed={item.code === locale} onClick={() => switchLocale(item.code)}>
                    <span>
                        <strong>{item.label}</strong>
                        <small>{item.english}</small>
                    </span>
                    {item.code === locale ? <Check aria-hidden /> : null}
                </button>
            ))}
        </div>
    );
}
