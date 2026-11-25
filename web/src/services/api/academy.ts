import { http } from "@/services/api/request";

export type AcademySection = {
    id: string;
    title: string;
    content: string;
};

export type AcademyCourse = {
    id: string;
    enabled: boolean;
    title: string;
    detailTitle?: string;
    summary: string;
    coverUrl: string;
    tags: string[];
    readingDuration: string;
    featureSummary: string;
    intro: string;
    sections: AcademySection[];
    ctaLabel: string;
    ctaUrl: string;
};

export type AcademyTab = {
    id: string;
    label: string;
    enabled: boolean;
    courses: AcademyCourse[];
};

export type AcademyConfig = {
    enabled: boolean;
    title: string;
    tabs: AcademyTab[];
};

export type AcademyCourseDetail = {
    course: AcademyCourse;
    categoryLabel: string;
};

export async function getAcademyConfig(signal?: AbortSignal) {
    return http.get<AcademyConfig>("/public/linghua/academy", { signal });
}

export async function getAcademyCourse(courseId: string, signal?: AbortSignal) {
    return http.get<AcademyCourseDetail>(`/public/linghua/academy/${encodeURIComponent(courseId)}`, { signal });
}

export async function getAdminAcademyConfig(signal?: AbortSignal) {
    const response = await http.get<{ config: AcademyConfig }>("/admin/linghua/academy", { signal });
    return response.config;
}

export async function updateAdminAcademyConfig(config: AcademyConfig) {
    const response = await http.patch<{ config: AcademyConfig }>("/admin/linghua/academy", config);
    return response.config;
}
