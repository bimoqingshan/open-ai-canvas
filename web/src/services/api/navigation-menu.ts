import { http } from "@/services/api/request";

export type NavigationMenuItem = {
    id: string;
    title: string;
    path: string;
    groupTitle: string;
    groupOrder: number;
    sortOrder: number;
    icon: string;
    enabled: boolean;
    builtIn: boolean;
    contactCards: NavigationContactCard[];
};

export type NavigationContactCard = {
    title: string;
    description: string;
    imageUrl: string;
};

export type NavigationMenuItemInput = Omit<NavigationMenuItem, "builtIn">;

export function getPublicNavigationMenu() {
    return http.get<{ items: NavigationMenuItem[] }>("/public/linghua/navigation-menu");
}

export function getAdminNavigationMenu() {
    return http.get<{ items: NavigationMenuItem[] }>("/admin/linghua/navigation-menu");
}

export function saveAdminNavigationMenu(items: NavigationMenuItemInput[]) {
    return http.put<{ items: NavigationMenuItem[] }>("/admin/linghua/navigation-menu", { items });
}

export function deleteAdminNavigationMenuItem(id: string) {
    return http.delete<{ deleted: boolean }>(`/admin/linghua/navigation-menu/${encodeURIComponent(id)}`);
}
