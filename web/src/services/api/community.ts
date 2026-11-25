import { http, compactApiParams, serializeApiParams } from "@/services/api/request";

export type CommunityWorkStatus = "pending" | "approved" | "rejected";

export type PublicCommunityWork = {
    id: string;
    title: string;
    description: string;
    creatorName: string;
    socialUrl?: string;
    challengeId?: string;
    challengeTitle?: string;
    trackTitle?: string;
    categoryId?: string;
    categoryTitle?: string;
    publicCanvas: boolean;
    canvasUrl?: string;
    coverUrl: string;
    videoUrl: string;
    videoSources?: Array<{ url: string; label?: string; quality?: string | number; width?: number; height?: number }>;
    creatorAvatarUrl?: string;
    creatorAvatarMode?: "custom" | "default" | "";
    creatorAvatarPreset?: string;
    publishedAt: string;
};

export type CommunityChallengeTrack = { id: string; name: string };

export type CommunityCategory = {
    id: string;
    name: string;
    description?: string;
    sortOrder: number;
    enabled: boolean;
    createdAt?: string;
    updatedAt?: string;
};

export type CreatorChallenge = {
    id: string;
    title: string;
    description: string;
    activityTag: string;
    tracks: CommunityChallengeTrack[];
    startsAt?: string;
    endsAt?: string;
    enabled: boolean;
    status: "inactive" | "upcoming" | "active" | "ended";
};

export type CommunityWorkSubmission = {
    canvasProjectId: string;
    teamId?: string;
    videoResourceId: string;
    coverResourceId: string;
    title: string;
    description: string;
    socialUrl?: string;
    challengeId?: string;
    trackId?: string;
    publicCanvas: boolean;
    termsAccepted: boolean;
};

export type CommunityWorkRecord = {
    id: string;
    teamId?: string;
    canvasProjectId?: string;
    title: string;
    description: string;
    creatorName: string;
    socialUrl: string;
    challengeId?: string;
    challengeTitle?: string;
    trackId?: string;
    trackTitle?: string;
    categoryId?: string;
    categoryTitle?: string;
    position?: number;
    publicCanvas: boolean;
    status: CommunityWorkStatus;
    reviewNote?: string;
    createdAt: string;
    reviewedAt?: string;
};

export type AdminCommunityWork = CommunityWorkRecord & {
    canvasProjectId: string;
    videoResourceId: string;
    coverResourceId: string;
};

export type CreatorChallengeInput = Omit<CreatorChallenge, "status">;

export function getCommunityWorks(params: { keyword?: string; challengeId?: string; categoryId?: string; pageSize?: number; cursor?: string } = {}, options: { signal?: AbortSignal } = {}) {
    const query = serializeApiParams(compactApiParams(params));
    return http.get<{ works: PublicCommunityWork[]; nextCursor?: string }>(`/public/linghua/community/works?${query.toString()}`, { signal: options.signal });
}

export function getCommunityCategories() {
    return http.get<{ categories: CommunityCategory[] }>("/public/linghua/community/categories");
}

export function getCommunityWork(id: string) {
    return http.get<{ work: PublicCommunityWork }>(`/public/linghua/community/works/${encodeURIComponent(id)}`);
}

export function getCreatorChallenges() {
    return http.get<{ challenges: CreatorChallenge[] }>("/public/linghua/community/challenges");
}

export function getCommunityWorkOptions() {
    return http.get<{ challenges: CreatorChallenge[] }>("/linghua/community/work-options");
}

export function submitCommunityWork(payload: CommunityWorkSubmission) {
    return http.post<{ work: CommunityWorkRecord }>("/linghua/community/works", payload);
}

export function getMyCommunityWorks() {
    return http.get<{ works: CommunityWorkRecord[] }>("/linghua/community/my-works");
}

export function getAdminCommunityWorks(params: { status?: string; categoryId?: string; keyword?: string; page?: number; pageSize?: number }) {
    const query = serializeApiParams(compactApiParams(params));
    return http.get<{ works: AdminCommunityWork[]; total: number; page: number; pageSize: number }>(`/admin/linghua/community/works?${query.toString()}`);
}

export function getAdminCommunityCategories() {
    return http.get<{ categories: CommunityCategory[] }>("/admin/linghua/community/categories");
}

export function saveCommunityCategory(payload: { id?: string; name: string; description?: string; sortOrder: number; enabled: boolean }) {
    return http.post<{ category: CommunityCategory }>("/admin/linghua/community/categories", payload);
}

export function assignCommunityWorksCategory(payload: { workIds: string[]; categoryId: string }) {
    return http.patch<{ workIds: string[]; categoryId: string }>("/admin/linghua/community/works/category", payload);
}

export function reorderCommunityWork(payload: { workId: string; categoryId: string; direction: -1 | 1 }) {
    return http.patch<{ workId: string; categoryId: string; moved: boolean }>("/admin/linghua/community/works/reorder", payload);
}

export function reviewCommunityWork(id: string, payload: { status: "approved" | "rejected"; note?: string }) {
    return http.patch<{ work: CommunityWorkRecord }>(`/admin/linghua/community/works/${encodeURIComponent(id)}/review`, payload);
}

export function getAdminCreatorChallenges() {
    return http.get<{ challenges: CreatorChallenge[] }>("/admin/linghua/community/challenges");
}

export function saveCreatorChallenge(payload: CreatorChallengeInput) {
    return http.post<{ challenge: CreatorChallenge }>("/admin/linghua/community/challenges", payload);
}

export function communityAdminMediaUrl(id: string, kind: "cover" | "video") {
    return `/api/admin/linghua/community/works/${encodeURIComponent(id)}/media/${kind}`;
}
