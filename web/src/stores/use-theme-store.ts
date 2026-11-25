import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "light" | "dark";
export type ThemeMode = ThemeName | "system";

type ThemeStore = {
    theme: ThemeName;
    themeMode: ThemeMode;
    setTheme: (theme: ThemeName) => void;
    setThemeMode: (mode: ThemeMode) => void;
};

const VALID_THEMES: ThemeName[] = ["light", "dark"];
const VALID_THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

export function systemTheme(): ThemeName {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveThemeMode(mode: ThemeMode, system?: ThemeName): ThemeName {
    return mode === "system" ? (system ?? systemTheme()) : mode;
}

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            theme: resolveThemeMode("system"),
            themeMode: "system",
            // 写入前校验：非法 theme 直接忽略，防止 syncRemoteUserData 等路径绕过 merge 写入坏值
            setTheme: (next) => set((state) => (VALID_THEMES.includes(next) ? { theme: next, themeMode: next } : state)),
            setThemeMode: (next) => set((state) => (VALID_THEME_MODES.includes(next) ? { theme: resolveThemeMode(next), themeMode: next } : state)),
        }),
        {
            name: "yingce:theme_store",
            partialize: ({ themeMode }) => ({ themeMode }),
            merge: (persisted, current) => {
                const stored = (persisted || {}) as Partial<ThemeStore>;
                const themeMode = VALID_THEME_MODES.includes(stored.themeMode as ThemeMode) ? (stored.themeMode as ThemeMode) : VALID_THEMES.includes(stored.theme as ThemeName) ? (stored.theme as ThemeName) : "system";
                return { ...current, themeMode, theme: resolveThemeMode(themeMode) };
            },
        },
    ),
);
