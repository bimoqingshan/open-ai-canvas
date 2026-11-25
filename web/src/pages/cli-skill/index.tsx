import { TerminalSquare } from "lucide-react";

export default function CliSkillPage() {
    return (
        <main className="mx-auto w-full max-w-5xl px-6 py-8">
            <header className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--r-md)] bg-surface-muted text-foreground/65">
                    <TerminalSquare className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <p className="m-0 text-xs text-foreground/45">外部 Agent 接入</p>
                    <h1 className="m-0 mt-1 text-xl font-semibold">CLI &amp; Skill</h1>
                </div>
            </header>
            <section className="mt-8 border-t border-border/60 py-7">
                <h2 className="m-0 text-base font-medium">接入能力正在建设中</h2>
                <p className="mb-0 mt-2 max-w-2xl text-sm leading-6 text-foreground/55">面向外部 Agent 与 CLI 的接入说明和配置将在后续开放。</p>
            </section>
        </main>
    );
}
