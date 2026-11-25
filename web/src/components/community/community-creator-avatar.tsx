import { UserAvatar } from "@/components/layout/user-avatar";
import type { PublicCommunityWork } from "@/services/api/community";

export function CommunityCreatorAvatar({ work, className }: { work: PublicCommunityWork; className?: string }) {
    return (
        <UserAvatar
            user={{
                id: work.id,
                username: work.creatorName,
                displayName: work.creatorName,
                avatarUrl: work.creatorAvatarUrl,
                avatarMode: work.creatorAvatarMode,
                avatarPreset: work.creatorAvatarPreset,
                role: "user",
                status: "active",
                createdAt: "",
                updatedAt: "",
            }}
            className={className}
        />
    );
}
