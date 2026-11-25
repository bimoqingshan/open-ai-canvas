import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getCommunityCategories } from "@/services/api/community";

import "./community-category-tabs.css";

export function CommunityCategoryTabs({ activeCategory, onChange }: { activeCategory: string; onChange: (categoryId: string) => void }) {
    const { t } = useTranslation();
    const categoryQuery = useQuery({ queryKey: ["public-community-categories"], queryFn: getCommunityCategories, staleTime: 30_000 });
    const categories = [{ id: "all", label: t("create.home.categoryAll") }, ...(categoryQuery.data?.categories || []).map((category) => ({ id: category.id, label: category.name }))];

    return (
        <nav className="community-category-tabs" aria-label={t("create.home.categoryLabel")}>
            {categories.map((category) => (
                <button key={category.id} type="button" className={activeCategory === category.id ? "is-active" : ""} aria-pressed={activeCategory === category.id} onClick={() => onChange(category.id)}>
                    {category.label}
                </button>
            ))}
        </nav>
    );
}
