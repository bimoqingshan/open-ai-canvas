import { Clapperboard, Image as ImageIcon, LibraryBig, Video } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { useUserStore } from "@/stores/use-user-store";

export function StudioFeaturedSkills() {
    const { t } = useTranslation();
    const features = useUserStore((state) => state.features);
    const actions = [
        ...(features.videoWorkbenchEnabled ? [{ title: t("create.home.videoTitle"), description: t("create.home.videoDescription"), to: "/toolbox/video", icon: Video }] : []),
        ...(features.imageWorkbenchEnabled ? [{ title: t("create.home.imageTitle"), description: t("create.home.imageDescription"), to: "/toolbox/image", icon: ImageIcon }] : []),
        ...(features.shortDramaEnabled ? [{ title: t("create.home.dramaTitle"), description: t("create.home.dramaDescription"), to: "/projects", icon: Clapperboard }] : []),
        { title: t("create.home.skillsTitle"), description: t("create.home.skillsDescription"), to: "/skills", icon: LibraryBig },
    ];

    return (
        <nav className="home-quick-links" aria-label={t("create.home.quickLinksLabel")}>
            {actions.map((action) => {
                const Icon = action.icon;
                return (
                    <Link className="home-quick-link" key={action.to} to={action.to}>
                        <span className="home-quick-link__icon" aria-hidden="true">
                            <Icon />
                        </span>
                        <span className="home-quick-link__copy">
                            <strong>{action.title}</strong>
                            <small>{action.description}</small>
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
