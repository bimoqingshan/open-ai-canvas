import { http } from "@/services/api/request";
import type { HomeCarouselConfig } from "@/lib/home-carousel";

export type LearningSquareConfig = { enabled: boolean; title: string; description: string; visibleSources: string[] };

export function getPublicHomeCarousel() {
    return http.get<{ homeCarousel: HomeCarouselConfig }>("/public/linghua/home-carousel");
}

export function getAdminHomeCarousel() {
    return http.get<{ homeCarousel: HomeCarouselConfig }>("/admin/linghua/home-carousel");
}

export function updateAdminHomeCarousel(homeCarousel: HomeCarouselConfig) {
    return http.patch<{ homeCarousel: HomeCarouselConfig }>("/admin/linghua/home-carousel", { homeCarousel });
}

export function getPublicLearningSquareConfig() {
    return http.get<{ learningSquare: LearningSquareConfig }>("/public/learning-square");
}

export function getAdminLearningSquareConfig() {
    return http.get<{ learningSquare: LearningSquareConfig }>("/admin/linghua/learning-square");
}

export function updateAdminLearningSquareConfig(learningSquare: LearningSquareConfig) {
    return http.put<{ learningSquare: LearningSquareConfig }>("/admin/linghua/learning-square", { learningSquare });
}
