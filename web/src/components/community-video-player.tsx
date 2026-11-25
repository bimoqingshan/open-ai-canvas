import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Maximize, Pause, Play, Settings2, Volume2, VolumeX } from "lucide-react";
import Hls from "hls.js";

import { communityVideoBandwidthMbps, communityVideoQualityOptions, measureCommunityVideoBandwidth, pickCommunityVideoSource, type CommunityVideoSource } from "./community-video-quality";
import "./community-video-player.css";

export type { CommunityVideoSource } from "./community-video-quality";

const EMPTY_VIDEO_SOURCES: CommunityVideoSource[] = [];

type CommunityVideoPlayerProps = {
    src: string;
    poster?: string;
    sources?: CommunityVideoSource[];
    title?: string;
    initialQuality?: string | number;
    playRequest?: number;
};

function isHlsSource(url: string) {
    return /\.m3u8(?:$|[?#])/i.test(url);
}

function formatTime(value: number) {
    if (!Number.isFinite(value) || value < 0) return "00:00";
    const seconds = Math.floor(value);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function CommunityVideoPlayer({ src, poster, sources = EMPTY_VIDEO_SOURCES, title = "社区作品", initialQuality = 540, playRequest = 0 }: CommunityVideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const restoreRef = useRef({ time: 0, playing: false });
    const probeControllerRef = useRef<AbortController | null>(null);
    const probeStartedRef = useRef(false);
    const handledPlayRequestRef = useRef(0);
    const failedSourcesRef = useRef(new Set<string>());
    const [activeSourceUrl, setActiveSourceUrl] = useState("");
    const [selectedMode, setSelectedMode] = useState<"auto" | string>("auto");
    const [measuredBandwidthMbps, setMeasuredBandwidthMbps] = useState<number | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(0.9);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [fullscreen, setFullscreen] = useState(false);
    const [playbackUnavailable, setPlaybackUnavailable] = useState(false);
    const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9);
    const [playerSize, setPlayerSize] = useState<{ width: number; height: number } | null>(null);
    const videoAspectRatioRef = useRef(16 / 9);

    const sourceOptions = useMemo(() => {
        return communityVideoQualityOptions(sources, src);
    }, [sources, src]);

    const compatibilitySource = useMemo(() => sources.find((source) => source?.url && (/^playback$/i.test(String(source.quality || "")) || source.label === "兼容播放")), [sources]);

    const autoSource = useMemo(() => {
        return pickCommunityVideoSource(sourceOptions, measuredBandwidthMbps, initialQuality) || { url: src, label: "原画" };
    }, [initialQuality, measuredBandwidthMbps, sourceOptions, src]);

    const fallbackToAvailableSource = useCallback(() => {
        const video = videoRef.current;
        if (!video || !activeSourceUrl) return;
        failedSourcesRef.current.add(activeSourceUrl);
        const fallbacks = [compatibilitySource, { url: src, label: "原画", quality: "source" }].filter((source): source is CommunityVideoSource => Boolean(source?.url && source.url !== activeSourceUrl && !failedSourcesRef.current.has(source.url)));
        const next = fallbacks[0];
        if (!next) {
            setPlaybackUnavailable(true);
            setPlaying(false);
            return;
        }
        restoreRef.current = { time: video.currentTime || 0, playing: !video.paused && !video.ended };
        setPlaybackUnavailable(false);
        setSelectedMode(next.url);
        setMenuOpen(false);
        setActiveSourceUrl(next.url);
    }, [activeSourceUrl, compatibilitySource, src]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !activeSourceUrl) return;
        let hls: Hls | null = null;
        const restore = () => {
            const { time, playing: wasPlaying } = restoreRef.current;
            if (time > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(time, video.duration);
            if (wasPlaying) void video.play().catch(() => undefined);
            video.removeEventListener("loadedmetadata", restore);
        };
        video.addEventListener("loadedmetadata", restore);
        if (isHlsSource(activeSourceUrl) && Hls.isSupported()) {
            video.removeAttribute("src");
            hls = new Hls({ enableWorker: true, lowLatencyMode: false, manifestLoadingMaxRetry: 0, levelLoadingMaxRetry: 0, fragLoadingMaxRetry: 0 });
            const fragmentStartedAt = new Map<string, number>();
            hls.on(Hls.Events.FRAG_LOADING, (_event, data) => {
                fragmentStartedAt.set(data.frag.url, performance.now());
            });
            hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
                if (probeStartedRef.current) return;
                const startedAt = fragmentStartedAt.get(data.frag.url);
                fragmentStartedAt.delete(data.frag.url);
                if (startedAt === undefined) return;
                const bandwidth = communityVideoBandwidthMbps(data.payload.byteLength, performance.now() - startedAt);
                if (bandwidth === null) return;
                probeStartedRef.current = true;
                setMeasuredBandwidthMbps(bandwidth);
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) fallbackToAvailableSource();
            });
            hls.attachMedia(video);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.loadSource(activeSourceUrl));
        } else {
            video.src = activeSourceUrl;
            video.load();
        }
        return () => {
            video.removeEventListener("loadedmetadata", restore);
            hls?.destroy();
        };
    }, [activeSourceUrl, fallbackToAvailableSource]);

    useEffect(() => {
        probeControllerRef.current?.abort();
        probeControllerRef.current = null;
        probeStartedRef.current = false;
        failedSourcesRef.current.clear();
        handledPlayRequestRef.current = 0;
        setPlaybackUnavailable(false);
        setMeasuredBandwidthMbps(null);
        setActiveSourceUrl("");
        setSelectedMode("auto");
        videoAspectRatioRef.current = 16 / 9;
        setVideoAspectRatio(16 / 9);
        setPlayerSize(null);
        restoreRef.current = { time: 0, playing: false };
    }, [src]);

    const updatePlayerSize = useCallback(() => {
        const stage = containerRef.current?.parentElement;
        if (!stage) return;
        const ratio = videoAspectRatioRef.current;
        const maxWidth = stage.clientWidth;
        const maxHeight = Math.max(180, window.innerHeight - 260);
        if (!maxWidth || !ratio) return;
        let width = maxWidth;
        let height = width / ratio;
        if (height > maxHeight) {
            height = maxHeight;
            width = height * ratio;
        }
        setPlayerSize((current) => (current && Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1 ? current : { width, height }));
    }, []);

    useEffect(() => {
        const stage = containerRef.current?.parentElement;
        if (!stage) return;
        const observer = new ResizeObserver(updatePlayerSize);
        observer.observe(stage);
        window.addEventListener("resize", updatePlayerSize);
        updatePlayerSize();
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updatePlayerSize);
        };
    }, [updatePlayerSize]);

    useEffect(() => {
        if (!activeSourceUrl) {
            setActiveSourceUrl(autoSource.url);
            return;
        }
        if (selectedMode !== "auto" || !autoSource.url || autoSource.url === activeSourceUrl) return;
        const video = videoRef.current;
        restoreRef.current = { time: video?.currentTime || 0, playing: Boolean(video && !video.paused && !video.ended) };
        setActiveSourceUrl(autoSource.url);
    }, [activeSourceUrl, autoSource.url, selectedMode]);

    const probeBandwidth = useCallback(async () => {
        if (probeStartedRef.current || !src) return;
        if (isHlsSource(activeSourceUrl) && Hls.isSupported()) return;
        probeStartedRef.current = true;
        const controller = new AbortController();
        probeControllerRef.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 5000);
        try {
            const bandwidth = await measureCommunityVideoBandwidth(src, { signal: controller.signal });
            if (!controller.signal.aborted && bandwidth !== null) setMeasuredBandwidthMbps(bandwidth);
        } finally {
            window.clearTimeout(timeout);
            if (probeControllerRef.current === controller) probeControllerRef.current = null;
        }
    }, [activeSourceUrl, src]);

    useEffect(() => () => probeControllerRef.current?.abort(), []);

    useEffect(() => {
        const handleFullscreenChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    useEffect(() => {
        if (playRequest <= 0 || playRequest <= handledPlayRequestRef.current || !activeSourceUrl || !videoRef.current) return;
        handledPlayRequestRef.current = playRequest;
        void videoRef.current
            .play()
            .then(() => setPlaybackUnavailable(false))
            .catch(() => setPlaybackUnavailable(true));
    }, [activeSourceUrl, playRequest]);

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused)
            void video
                .play()
                .then(() => setPlaybackUnavailable(false))
                .catch(() => setPlaybackUnavailable(true));
        else video.pause();
    };

    const selectMode = (mode: "auto" | string) => {
        const next = mode === "auto" ? autoSource : sourceOptions.find((source) => source.url === mode);
        failedSourcesRef.current.clear();
        if (!next || next.url === activeSourceUrl) {
            setSelectedMode(mode);
            setMenuOpen(false);
            return;
        }
        const video = videoRef.current;
        restoreRef.current = { time: video?.currentTime || 0, playing: Boolean(video && !video.paused && !video.ended) };
        setSelectedMode(mode);
        setMenuOpen(false);
        setActiveSourceUrl(next.url);
    };

    const toggleFullscreen = async () => {
        if (!containerRef.current) return;
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await containerRef.current.requestFullscreen();
        } catch {
            // Browser policy can reject fullscreen; playback remains available.
        }
    };

    return (
        <div ref={containerRef} className="community-video-player" style={playerSize ? { width: playerSize.width, height: playerSize.height, aspectRatio: videoAspectRatio } : undefined} onDoubleClick={toggleFullscreen}>
            <div className="community-video-player__backdrop" style={poster ? { backgroundImage: `url("${poster}")` } : undefined} aria-hidden="true" />
            <video
                ref={videoRef}
                className="community-video-player__video"
                poster={poster}
                playsInline
                preload="metadata"
                aria-label={title}
                onClick={togglePlay}
                onError={fallbackToAvailableSource}
                onPlay={() => {
                    setPlaying(true);
                    setPlaybackUnavailable(false);
                }}
                onPause={() => setPlaying(false)}
                onLoadedData={() => void probeBandwidth()}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onLoadedMetadata={(event) => {
                    const video = event.currentTarget;
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                        const ratio = video.videoWidth / video.videoHeight;
                        videoAspectRatioRef.current = ratio;
                        setVideoAspectRatio(ratio);
                        requestAnimationFrame(updatePlayerSize);
                    }
                    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
                }}
                onVolumeChange={(event) => {
                    setMuted(event.currentTarget.muted);
                    setVolume(event.currentTarget.volume);
                }}
            />
            {playbackUnavailable ? (
                <div className="community-video-player__error" role="status">
                    <span>视频暂时无法播放</span>
                    <button
                        type="button"
                        onClick={() => {
                            const video = videoRef.current;
                            if (!video) return;
                            failedSourcesRef.current.clear();
                            setPlaybackUnavailable(false);
                            video.load();
                            void video.play().catch(() => setPlaybackUnavailable(true));
                        }}
                    >
                        重试
                    </button>
                </div>
            ) : null}
            <div className="community-video-player__scrim" aria-hidden="true" />
            <div className="community-video-player__controls" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="community-video-player__icon" aria-label={playing ? "暂停" : "播放"} onClick={togglePlay}>
                    {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                </button>
                <span className="community-video-player__time">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <input
                    className="community-video-player__progress"
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    value={currentTime}
                    aria-label="播放进度"
                    onChange={(event) => {
                        const next = Number(event.target.value);
                        if (videoRef.current) videoRef.current.currentTime = next;
                        setCurrentTime(next);
                    }}
                />
                <div className="community-video-player__actions">
                    {sourceOptions.length > 1 ? (
                        <div className="community-video-player__quality">
                            <button type="button" className="community-video-player__quality-trigger" aria-expanded={menuOpen} aria-haspopup="menu" aria-label="选择视频清晰度" onClick={() => setMenuOpen((open) => !open)}>
                                <Settings2 aria-hidden="true" />
                                <span>{selectedMode === "auto" ? "自动" : sourceOptions.find((source) => source.url === selectedMode)?.label || (compatibilitySource?.url === selectedMode ? "兼容播放" : "原画")}</span>
                            </button>
                            {menuOpen ? (
                                <div className="community-video-player__quality-menu" role="menu" aria-label="视频清晰度">
                                    <button type="button" role="menuitemradio" aria-checked={selectedMode === "auto"} className={selectedMode === "auto" ? "is-active" : ""} onClick={() => selectMode("auto")}>
                                        <span>自动</span>
                                        <small>{autoSource.label}</small>
                                        {selectedMode === "auto" ? <Check aria-hidden="true" /> : null}
                                    </button>
                                    {sourceOptions.map((source) => (
                                        <button key={source.url} type="button" role="menuitemradio" aria-checked={selectedMode === source.url} className={selectedMode === source.url ? "is-active" : ""} onClick={() => selectMode(source.url)}>
                                            <span>{source.label}</span>
                                            {selectedMode === source.url ? <Check aria-hidden="true" /> : null}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    <button
                        type="button"
                        className="community-video-player__icon"
                        aria-label={muted ? "打开声音" : "静音"}
                        onClick={() => {
                            if (!videoRef.current) return;
                            videoRef.current.muted = !videoRef.current.muted;
                            if (!videoRef.current.muted && videoRef.current.volume === 0) videoRef.current.volume = volume || 0.8;
                        }}
                    >
                        {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
                    </button>
                    <input
                        className="community-video-player__volume"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={muted ? 0 : volume}
                        aria-label="音量"
                        onChange={(event) => {
                            const next = Number(event.target.value);
                            if (videoRef.current) {
                                videoRef.current.volume = next;
                                videoRef.current.muted = next === 0;
                            }
                            setVolume(next);
                        }}
                    />
                    <button type="button" className="community-video-player__icon" aria-label={fullscreen ? "退出全屏" : "全屏"} onClick={toggleFullscreen}>
                        <Maximize aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    );
}
