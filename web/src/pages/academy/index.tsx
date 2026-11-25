import { ArrowLeft, ArrowRight, ChevronRight, Clock3 } from "lucide-react";
import { Skeleton } from "antd";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";

import { getAcademyConfig, getAcademyCourse, type AcademyConfig, type AcademyCourse, type AcademyTab } from "@/services/api/academy";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import "./academy.css";

export default function AcademyPage() {
    const { courseId } = useParams();
    return courseId ? <AcademyCoursePage courseId={courseId} /> : <AcademyCatalogPage />;
}

function AcademyCatalogPage() {
    const brandName = useAppearanceStore((state) => state.appearance.brandName);
    const [searchParams, setSearchParams] = useSearchParams();
    const [config, setConfig] = useState<AcademyConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const activeTab = useMemo(() => config?.tabs.find((tab) => tab.id === searchParams.get("tab")) || config?.tabs[0], [config, searchParams]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        getAcademyConfig(controller.signal)
            .then((next) => {
                setConfig(next);
                setError("");
            })
            .catch((reason: unknown) => {
                if (reason instanceof DOMException && reason.name === "AbortError") return;
                setError(reason instanceof Error ? reason.message : "学院内容读取失败");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, []);

    const selectTab = (tab: AcademyTab) => setSearchParams({ tab: tab.id }, { replace: true });

    return (
        <main className="academy-page" aria-labelledby="academy-title">
            <div className="academy-catalog">
                <header className="academy-catalog-heading">
                    <h1 id="academy-title">{config?.title || "学习广场"}</h1>
                </header>

                {loading ? (
                    <div className="academy-card-grid" aria-label="正在读取课程">
                        {Array.from({ length: 8 }, (_, index) => (
                            <Skeleton.Image key={index} active className="academy-loading-image" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="academy-state" role="alert">
                        <p>{error}</p>
                        <button type="button" onClick={() => window.location.reload()}>
                            重新加载
                        </button>
                    </div>
                ) : !config?.enabled ? (
                    <div className="academy-state">
                        <p>学院暂未开放</p>
                    </div>
                ) : config.tabs.length === 0 ? (
                    <div className="academy-state">
                        <p>暂时没有公开课程</p>
                    </div>
                ) : (
                    <>
                        <nav className="academy-tabs" aria-label="学院课程分类" role="tablist">
                            {config.tabs.map((tab) => (
                                <button key={tab.id} type="button" role="tab" aria-selected={activeTab?.id === tab.id} className={activeTab?.id === tab.id ? "is-active" : ""} onClick={() => selectTab(tab)}>
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                        {activeTab?.courses.length ? (
                            <div className="academy-card-grid" role="tabpanel" aria-label={activeTab.label}>
                                {activeTab.courses.map((course) => (
                                    <AcademyCourseCard key={course.id} course={course} tab={activeTab} brandName={brandName} />
                                ))}
                            </div>
                        ) : (
                            <div className="academy-state">
                                <p>这个分类暂时没有公开课程</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}

function AcademyCourseCard({ course, tab, brandName }: { course: AcademyCourse; tab: AcademyTab; brandName: string }) {
    return (
        <Link to={`/linghua/learning/${encodeURIComponent(course.id)}?tab=${encodeURIComponent(tab.id)}`} className="academy-course-card" aria-label={`${course.title.replaceAll("\n", " ")}，${course.featureSummary}`}>
            <span className="academy-course-cover">
                <img src={course.coverUrl} alt="" loading="lazy" />
                <span className="academy-course-cover-shade" />
                <span className="academy-cover-brand">{brandName}</span>
                <strong>{course.title}</strong>
                <span className="academy-cover-arrow" aria-hidden="true">
                    <ArrowRight />
                </span>
            </span>
            <span className="academy-course-feature">
                <span>涉及功能：</span>
                {course.featureSummary}
            </span>
        </Link>
    );
}

function AcademyCoursePage({ courseId }: { courseId: string }) {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [course, setCourse] = useState<AcademyCourse | null>(null);
    const [activeSection, setActiveSection] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const pageRef = useRef<HTMLElement>(null);
    const tabId = searchParams.get("tab");
    const backHref = tabId ? `/linghua/learning?tab=${encodeURIComponent(tabId)}` : "/linghua/learning";

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setCourse(null);
        getAcademyCourse(courseId, controller.signal)
            .then((detail) => {
                setCourse(detail.course);
                setActiveSection(detail.course.sections[0]?.id || "");
                setError("");
            })
            .catch((reason: unknown) => {
                if (reason instanceof DOMException && reason.name === "AbortError") return;
                setError(reason instanceof Error ? reason.message : "课程内容读取失败");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [courseId]);

    useEffect(() => {
        pageRef.current?.scrollTo({ top: 0 });
    }, [courseId, location.key]);

    useEffect(() => {
        if (!course?.sections.length) return;
        const nodes = course.sections.map((section) => document.getElementById(`academy-section-${section.id}`)).filter((node): node is HTMLElement => Boolean(node));
        if (!nodes.length) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
                const id = visible?.target.id.replace("academy-section-", "");
                if (id) setActiveSection(id);
            },
            { root: pageRef.current, rootMargin: "-15% 0px -70% 0px", threshold: 0 },
        );
        nodes.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, [course]);

    const openSection = (id: string) => {
        setActiveSection(id);
        document.getElementById(`academy-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <main className="academy-page academy-reading-page" ref={pageRef} aria-labelledby="academy-course-title">
            {loading ? (
                <div className="academy-reading-layout academy-reading-loading">
                    <Skeleton active paragraph={{ rows: 12 }} />
                </div>
            ) : error || !course ? (
                <div className="academy-state academy-detail-error" role="alert">
                    <p>{error || "课程不存在或已下架"}</p>
                    <Link to={backHref}>
                        <ArrowLeft /> 返回学院
                    </Link>
                </div>
            ) : (
                <div className="academy-reading-layout">
                    <article className="academy-article">
                        <Link to={backHref} className="academy-back-link">
                            <ArrowLeft /> 返回课程列表
                        </Link>
                        <h1 id="academy-course-title">{(course.detailTitle || course.title).replaceAll("\n", " ")}</h1>
                        <div className="academy-course-meta">
                            {course.tags.map((tag) => (
                                <span key={tag}>{tag}</span>
                            ))}
                            {course.readingDuration ? (
                                <span className="academy-duration">
                                    <Clock3 /> 阅读约 {course.readingDuration.replace(/^约\s*/, "")}
                                </span>
                            ) : null}
                        </div>
                        {course.featureSummary ? (
                            <blockquote className="academy-feature-summary">
                                <span>涉及功能：</span>
                                {course.featureSummary}
                            </blockquote>
                        ) : null}
                        {course.intro ? (
                            <div className="academy-intro">
                                <AcademyMarkdown content={course.intro} />
                            </div>
                        ) : null}
                        <div className="academy-article-divider" />
                        {course.sections.map((section) => (
                            <section key={section.id} id={`academy-section-${section.id}`} className="academy-article-section">
                                <h2>{section.title}</h2>
                                <div className="academy-markdown">
                                    <AcademyMarkdown content={section.content} />
                                </div>
                            </section>
                        ))}
                    </article>
                    <aside className="academy-reading-aside" aria-label="课程导航和练习入口">
                        <nav className="academy-toc" aria-label="课程目录">
                            {course.sections.map((section) => (
                                <button key={section.id} type="button" className={activeSection === section.id ? "is-active" : ""} onClick={() => openSection(section.id)}>
                                    {section.title}
                                </button>
                            ))}
                        </nav>
                        {course.ctaUrl ? <AcademyPracticeLink course={course} /> : null}
                    </aside>
                </div>
            )}
        </main>
    );
}

function AcademyPracticeLink({ course }: { course: AcademyCourse }) {
    const label = course.ctaLabel || "前往画布练习本课知识点";
    const content = (
        <>
            <span>
                <strong>{label}</strong>
                <small>一键打开制作过程</small>
            </span>
            <span className="academy-practice-arrow" aria-hidden="true">
                <ArrowRight />
            </span>
        </>
    );
    if (course.ctaUrl.startsWith("/"))
        return (
            <Link className="academy-practice-link" to={course.ctaUrl}>
                {content}
            </Link>
        );
    return (
        <a className="academy-practice-link" href={course.ctaUrl} target="_blank" rel="noreferrer">
            {content}
        </a>
    );
}

function AcademyMarkdown({ content }: { content: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                img: ({ alt, ...props }) => (
                    <figure>
                        <img {...props} alt={alt || ""} loading="lazy" />
                    </figure>
                ),
                a: ({ href, children, ...props }) => (
                    <a {...props} href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noreferrer" : undefined}>
                        {children}
                        <ChevronRight className="academy-inline-link-icon" aria-hidden="true" />
                    </a>
                ),
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
