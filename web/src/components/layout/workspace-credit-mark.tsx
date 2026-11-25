import { Zap } from "lucide-react";

import { cn } from "@/lib/utils";

export function WorkspaceCreditMark({ className }: { className?: string }) {
    return (
        <span className={cn("app-workspace-credit-mark", className)} aria-hidden="true">
            <Zap fill="currentColor" />
        </span>
    );
}
