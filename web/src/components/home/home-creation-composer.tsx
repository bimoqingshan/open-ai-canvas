import { lazy, Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { App } from "antd";
import { useTranslation } from "react-i18next";

import type { AssetLibraryPickerItem } from "@/components/assets/asset-library-picker-modal";
import { useExternalAssetSources } from "@/hooks/use-external-asset-sources";
import { imageParameterRequest, normalizeImageParameters } from "@/lib/image-parameters";
import { modelCapabilityConfigFor, normalizeImageValue, normalizeVideoValue } from "@/lib/model-capabilities";
import { modelGroupReferenceLimits, resolveCompatibleModel, type ModelRequirements } from "@/lib/model-selection";
import { isThinkingLevel, LEGACY_TEXT_THINKING_CONFIG, resolveThinkingLevel, thinkingLevelsFor, type ThinkingRequest } from "@/lib/text-thinking";
import type { PromptOptimizerProvider } from "@/lib/plugins/plugin-types";
import { promptOptimizerPlugin, PROMPT_OPTIMIZER_PLUGIN_ID } from "@/lib/plugins/builtin/prompt-optimizer";
import { createPluginHostContext } from "@/services/plugin-host";
import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import { modelOptionName, useConfigStore, useEffectiveConfig, selectableModelsByCapability } from "@/stores/use-config-store";
import { useCreationPreferencesStore } from "@/stores/use-creation-preferences-store";
import { usePluginStore } from "@/stores/use-plugin-store";
import { captureSkillLibraryAccess, isSkillLibraryAccessCurrent, useSkillLibraryAccess } from "@/lib/skill-access";
import type { Skill } from "@/services/api/skills";
import { creationAudioAsset, creationImageAsset, creationVideoAsset, creationAttachmentFromExternalAsset, creationUploadAccept, creationAttachmentKind, type CreationAttachment, type CreationMode } from "@/pages/create/creation-assets";
import { creationLibraryDisabledReason, creationLibrarySelectionToAttachments } from "@/pages/create/creation-library";
import { buildCreationMentionReferences } from "@/pages/create/creation-references";
import { creationVideoConfig } from "@/pages/create/creation-generation-config";
import { CreationComposer, CreationModeDropdown, creationAssetCategoryLabels } from "@/pages/create/creation-workspace";
import type { CanvasAudioSettingKey } from "@/components/canvas/canvas-audio-settings-popover";

const AssetLibraryPickerModal = lazy(() => import("@/components/assets/asset-library-picker-modal").then((module) => ({ default: module.AssetLibraryPickerModal })));

const TEXT_STREAMING_PREF_KEY = "creation.composer.text-streaming";
const TEXT_THINKING_PREF_KEY = "creation.composer.text-thinking";
const homeAssetCategoryLabels = { ...creationAssetCategoryLabels };

export type HomeCreationLaunchState = {
    homePrompt: string;
    homeMode: CreationMode;
    homeTextStreaming: boolean;
    homeTextThinking: ThinkingRequest;
    homeReferenceIds: string[];
    homeExternalAttachments: CreationAttachment[];
};

type Props = {
    prompt: string;
    onPromptChange: (value: string) => void;
    promptRef: RefObject<HTMLTextAreaElement | null>;
    onStart: (state: HomeCreationLaunchState) => void;
};

function readPreference(key: string, fallback: boolean) {
    try {
        const stored = window.localStorage.getItem(key);
        return stored === null ? fallback : stored === "1";
    } catch {
        return fallback;
    }
}

function writePreference(key: string, value: boolean) {
    try {
        window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
        // Preferences remain usable for this session when browser storage is unavailable.
    }
}

function readThinkingPreference(): ThinkingRequest {
    try {
        const stored = window.localStorage.getItem(TEXT_THINKING_PREF_KEY);
        if (stored === "1") return "medium";
        if (stored === "0" || stored === null) return "off";
        if (stored === "auto" || stored === "deep" || isThinkingLevel(stored)) return stored;
    } catch {
        return "off";
    }
    return "off";
}

function pickerItemsForAssets(assets: Asset[], mode: CreationMode, videoLimits?: ReturnType<typeof modelGroupReferenceLimits>, kindLabels?: { image: string; video: string; audio: string }) {
    return assets
        .filter((asset): asset is Extract<Asset, { kind: "image" | "video" | "audio" }> => asset.kind === "image" || asset.kind === "video" || asset.kind === "audio")
        .map((asset) => ({
            id: asset.id,
            title: asset.title,
            category: asset.category || "other",
            kindLabel: asset.kind === "video" ? kindLabels?.video || "Video" : asset.kind === "audio" ? kindLabels?.audio || "Audio" : kindLabels?.image || "Image",
            asset,
            searchText: (asset.tags || []).join(" "),
            disabledReason: creationLibraryDisabledReason(mode, asset.kind, videoLimits || undefined),
        }));
}

function attachmentIdForItem(item: AssetLibraryPickerItem) {
    if (item.external) return `external:${item.external.sourceId}:${item.external.item.id}`;
    return item.asset ? `asset:${item.asset.id}` : "";
}

export function HomeCreationComposer({ prompt, onPromptChange, promptRef, onStart }: Props) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const config = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const assets = useAssetStore((state) => state.assets);
    const addAsset = useAssetStore((state) => state.addAsset);
    const preferences = useCreationPreferencesStore((state) => state.preferences);
    const rememberMode = useCreationPreferencesStore((state) => state.rememberMode);
    const rememberImageSettings = useCreationPreferencesStore((state) => state.rememberImageSettings);
    const rememberVideoSettings = useCreationPreferencesStore((state) => state.rememberVideoSettings);
    const preferencesHydrated = useCreationPreferencesStore((state) => state.hydrated);
    const promptOptimizerInstallation = usePluginStore((state) => state.installations.find((item) => item.manifest.id === PROMPT_OPTIMIZER_PLUGIN_ID));
    const promptOptimizerEnabled = usePluginStore((state) => state.pluginStates[PROMPT_OPTIMIZER_PLUGIN_ID]?.effectiveEnabled ?? Boolean(state.installations.find((item) => item.manifest.id === PROMPT_OPTIMIZER_PLUGIN_ID)?.enabled));
    const canUseSkills = useSkillLibraryAccess();
    const modeWasChanged = useRef(false);
    const addedSkillsRequestedRef = useRef(false);
    const [addedSkills, setAddedSkills] = useState<Skill[]>([]);
    const [mode, setMode] = useState<CreationMode>(preferences.mode || "text");
    const [ratio, setRatio] = useState("16:9");
    const [seconds, setSeconds] = useState("6");
    const [quality, setQuality] = useState("auto");
    const [imageResolution, setImageResolution] = useState("auto");
    const [imageParameters, setImageParameters] = useState("{}");
    const [videoQuality, setVideoQuality] = useState(config.vquality || "720");
    const [count, setCount] = useState(String(Math.max(1, Math.min(4, Number(config.count) || 1))));
    const [textStreaming, setTextStreaming] = useState(() => readPreference(TEXT_STREAMING_PREF_KEY, true));
    const [textThinkingRequest, setTextThinkingRequest] = useState<ThinkingRequest>(readThinkingPreference);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedItems, setSelectedItems] = useState<AssetLibraryPickerItem[]>([]);
    const externalAssets = useExternalAssetSources(libraryOpen);

    useEffect(() => {
        if (preferencesHydrated && !modeWasChanged.current && preferences.mode) setMode(preferences.mode);
    }, [preferencesHydrated, preferences.mode]);

    const modelKey = mode === "text" ? "textModel" : mode === "video" ? "videoModel" : "imageModel";
    const preferredModel = config[modelKey];
    const attachments = useMemo(
        () =>
            selectedItems.flatMap((item) => {
                try {
                    return creationLibrarySelectionToAttachments([item.id], [{ ...item, disabledReason: undefined }], "text");
                } catch {
                    return [];
                }
            }),
        [selectedItems],
    );
    const modelRequirements = useMemo<ModelRequirements>(
        () => ({
            capability: mode,
            input: {
                textCount: prompt.trim() ? 1 : 0,
                imageCount: attachments.filter((item) => creationAttachmentKind(item) === "image").length,
                videoCount: attachments.filter((item) => creationAttachmentKind(item) === "video").length,
                audioCount: attachments.filter((item) => creationAttachmentKind(item) === "audio").length,
                characterCount: 0,
            },
            videoSeconds: mode === "video" ? seconds : undefined,
            imageSize: mode === "image" ? ratio : undefined,
            options:
                mode === "image"
                    ? (imageParameterRequest(modelCapabilityConfigFor(config, preferredModel).image!, { ...config, size: ratio, imageResolution, quality, count, imageParameters }) ?? {
                          size: ratio,
                          imageResolution,
                          quality,
                          count: Number(count),
                          transparentBackground: config.transparentBackground === "true",
                      })
                    : mode === "video"
                      ? { size: ratio, videoSeconds: Number(seconds), vquality: videoQuality }
                      : {},
        }),
        [attachments, config, count, imageParameters, imageResolution, mode, preferredModel, prompt, quality, ratio, seconds, videoQuality],
    );
    const selectedModel = resolveCompatibleModel(config, preferredModel, modelRequirements) || preferredModel;
    const textThinkingConfig = mode === "text" ? modelCapabilityConfigFor(config, selectedModel).text?.thinking || LEGACY_TEXT_THINKING_CONFIG : undefined;
    const textThinkingLevels = useMemo(() => thinkingLevelsFor(textThinkingConfig), [textThinkingConfig]);
    const textThinkingLevel = resolveThinkingLevel(textThinkingConfig, textThinkingRequest);
    const imageProfile = useMemo(() => modelCapabilityConfigFor(config, selectedModel).image!, [config, selectedModel]);
    const videoProfile = useMemo(() => modelCapabilityConfigFor(config, selectedModel).video!, [config, selectedModel]);
    const videoReferenceLimits = useMemo(() => (mode === "video" ? modelGroupReferenceLimits(config, preferredModel || selectedModel, "video") || { maxImages: 0, maxVideos: 0, maxAudios: 0 } : undefined), [config, mode, preferredModel, selectedModel]);
    const pickerVideoLimits = useMemo(() => (mode === "video" ? modelGroupReferenceLimits(config, selectedModel, "video", modelRequirements) : undefined), [config, mode, modelRequirements, selectedModel]);
    const maxReferences = mode === "video" ? (videoReferenceLimits?.maxImages || 0) + (videoReferenceLimits?.maxVideos || 0) + (videoReferenceLimits?.maxAudios || 0) : mode === "image" ? imageProfile.references.maxImages : 6;
    const generationConfig = useMemo(() => (mode === "video" ? creationVideoConfig(config, selectedModel, { ratio, seconds, videoQuality }) : config), [config, mode, ratio, seconds, selectedModel, videoQuality]);
    const referenceImageSize = useMemo(() => {
        const images = attachments.filter((item) => creationAttachmentKind(item) === "image");
        if (images.length !== 1 || !("width" in images[0]) || !("height" in images[0])) return undefined;
        const { width, height } = images[0];
        return typeof width === "number" && typeof height === "number" && width > 0 && height > 0 ? { width, height } : undefined;
    }, [attachments]);
    const references = useMemo(() => buildCreationMentionReferences(canUseSkills ? addedSkills : [], attachments, []), [addedSkills, attachments, canUseSkills]);
    const promptOptimizerProvider = useMemo<PromptOptimizerProvider | null>(() => {
        if (!promptOptimizerEnabled || !promptOptimizerInstallation || !promptOptimizerPlugin.createPromptOptimizer) return null;
        return promptOptimizerPlugin.createPromptOptimizer(createPluginHostContext(promptOptimizerPlugin, promptOptimizerInstallation, config));
    }, [config, promptOptimizerEnabled, promptOptimizerInstallation]);
    const externalItems = useMemo<AssetLibraryPickerItem[]>(
        () =>
            externalAssets.items.map((item) => ({
                ...item,
                disabledReason: creationLibraryDisabledReason(mode, item.external?.item.kind, pickerVideoLimits),
            })),
        [externalAssets.items, mode, pickerVideoLimits],
    );
    const kindLabels = { image: t("create.composer.image"), video: t("create.composer.video"), audio: t("create.composer.audio") };
    const libraryItems = useMemo<AssetLibraryPickerItem[]>(() => [...pickerItemsForAssets(assets, mode, pickerVideoLimits, kindLabels), ...externalItems], [assets, externalItems, kindLabels, mode, pickerVideoLimits]);
    const selectableLibraryItems = useMemo(() => {
        const itemsById = new Map([...libraryItems, ...selectedItems].map((item) => [item.id, item]));
        return selectedIds.flatMap((id) => {
            const item = itemsById.get(id);
            return item ? [item] : [];
        });
    }, [libraryItems, selectedIds, selectedItems]);

    useEffect(() => {
        if (!preferencesHydrated || mode !== "image") return;
        const saved = preferences.image;
        const normalized = normalizeImageValue(imageProfile, {
            size: saved?.ratio || imageProfile.size.default,
            quality: saved?.quality || imageProfile.quality.default,
            imageResolution: saved?.imageResolution || imageProfile.resolution.default,
            imageParameters: saved?.model === selectedModel ? saved.imageParameters : undefined,
            count: saved?.count || count,
        });
        setRatio(normalized.size);
        setQuality(normalized.quality);
        setImageResolution(normalized.imageResolution || imageProfile.resolution.default);
        setImageParameters(JSON.stringify(normalizeImageParameters(imageProfile.parameters, saved?.model === selectedModel ? saved.imageParameters : undefined)));
        setCount(normalized.count);
    }, [count, imageProfile, mode, preferences.image, preferencesHydrated, selectedModel]);

    useEffect(() => {
        if (!preferencesHydrated || mode !== "video") return;
        const saved = preferences.video;
        const normalized = normalizeVideoValue(videoProfile, {
            seconds: saved?.seconds || String(videoProfile.duration.default),
            ratio: saved?.ratio || videoProfile.defaultRatio,
            resolution: saved?.videoQuality || videoProfile.defaultResolution,
        });
        setSeconds(normalized.seconds);
        setRatio(normalized.ratio);
        setVideoQuality(normalized.resolution.replace(/p$/i, ""));
    }, [mode, preferences.video, preferencesHydrated, selectedModel, videoProfile]);

    useEffect(() => {
        writePreference(TEXT_STREAMING_PREF_KEY, textStreaming);
        try {
            window.localStorage.setItem(TEXT_THINKING_PREF_KEY, textThinkingRequest);
        } catch {
            // Keep the selected level for this session when browser storage is unavailable.
        }
    }, [textStreaming, textThinkingRequest]);

    useEffect(() => {
        setAddedSkills([]);
        addedSkillsRequestedRef.current = false;
    }, [canUseSkills]);

    const loadAddedSkills = () => {
        const access = captureSkillLibraryAccess();
        if (!access || addedSkillsRequestedRef.current) return;
        addedSkillsRequestedRef.current = true;
        void import("@/services/api/skills")
            .then(({ listAddedSkills }) => listAddedSkills())
            .then(({ skills }) => {
                if (isSkillLibraryAccessCurrent(access)) setAddedSkills(skills);
            })
            .catch(() => setAddedSkills([]));
    };

    const selectMode = (next: CreationMode) => {
        setMode(next);
        modeWasChanged.current = true;
        rememberMode(next);
        const nextModels = selectableModelsByCapability(config, next);
        const nextKey = next === "text" ? "textModel" : next === "video" ? "videoModel" : "imageModel";
        if (!nextModels.includes(config[nextKey]) && nextModels[0]) updateConfig(nextKey, nextModels[0]);
    };

    const modePicker = <CreationModeDropdown mode={mode} onModeChange={selectMode} />;

    const uploadLibraryAssets = async (files: File[]) => {
        const accepted = files.filter((file) => file.type.startsWith("image/") || ((mode === "video" || mode === "text") && (file.type.startsWith("video/") || file.type.startsWith("audio/"))));
        if (!accepted.length) {
            message.warning(t("create.composer.unsupportedFiles"));
            return [];
        }
        const runtime = await import("@/pages/create/creation-runtime");
        const ids: string[] = [];
        for (const file of accepted) {
            if (file.type.startsWith("video/")) {
                const uploaded = await runtime.uploadMediaFile(file, "create-upload");
                ids.push(addAsset(creationVideoAsset({ title: file.name, uploaded, metadata: { source: "create-upload", fileName: file.name } })));
            } else if (file.type.startsWith("audio/")) {
                const uploaded = await runtime.uploadMediaFile(file, "create-upload");
                ids.push(addAsset(creationAudioAsset({ title: file.name, uploaded, metadata: { source: "create-upload", fileName: file.name } })));
            } else {
                const uploaded = await runtime.uploadImage(file);
                ids.push(addAsset(creationImageAsset({ title: file.name, uploaded, metadata: { source: "create-upload", fileName: file.name } })));
            }
        }
        return ids;
    };

    const handleLibrarySelect = (ids: string[], pickedItems: AssetLibraryPickerItem[] = libraryItems) => {
        const itemsById = new Map([...libraryItems, ...pickedItems, ...selectedItems].map((item) => [item.id, item]));
        setSelectedIds(ids);
        setSelectedItems(
            ids.flatMap((id) => {
                const item = itemsById.get(id);
                return item ? [item] : [];
            }),
        );
        setLibraryOpen(false);
    };

    const removeReferenceAttachment = (attachmentId: string) => {
        const item = selectedItems.find((entry) => attachmentIdForItem(entry) === attachmentId);
        if (!item) return;
        setSelectedIds((current) => current.filter((id) => id !== item.id));
        setSelectedItems((current) => current.filter((entry) => entry.id !== item.id));
    };

    const reorderAttachments = (next: CreationAttachment[]) => {
        const itemsByAttachmentId = new Map(selectedItems.map((item) => [attachmentIdForItem(item), item]));
        const ordered = next.flatMap((attachment) => {
            const item = itemsByAttachmentId.get(attachment.id);
            return item ? [item] : [];
        });
        const orderedIds = new Set(ordered.map((item) => item.id));
        const remaining = selectedItems.filter((item) => !orderedIds.has(item.id));
        const combined = [...ordered, ...remaining];
        setSelectedItems(combined);
        setSelectedIds(combined.map((item) => item.id));
    };

    const replaceAttachment = (targetAttachmentId: string, replacement: CreationAttachment) => {
        const target = selectedItems.find((item) => attachmentIdForItem(item) === targetAttachmentId);
        const replacementItem = selectedItems.find((item) => attachmentIdForItem(item) === replacement.id);
        if (!target || !replacementItem || target.id === replacementItem.id) return;
        const next = selectedItems.filter((item) => item.id !== target.id && item.id !== replacementItem.id);
        const index = selectedItems.findIndex((item) => item.id === target.id);
        next.splice(Math.min(index, next.length), 0, replacementItem);
        setSelectedItems(next);
        setSelectedIds(next.map((item) => item.id));
    };

    const replaceReferenceFiles = async (targetAttachmentId: string, files: File[]) => {
        const target = selectedItems.find((item) => attachmentIdForItem(item) === targetAttachmentId);
        if (!target) return;
        const uploadedIds = await uploadLibraryAssets(files);
        const uploadedItems = pickerItemsForAssets(useAssetStore.getState().assets, mode, pickerVideoLimits, kindLabels).filter((item) => uploadedIds.includes(item.id));
        if (!uploadedItems.length) return;
        const nextItems = selectedItems.filter((item) => item.id !== target.id);
        const targetIndex = selectedItems.findIndex((item) => item.id === target.id);
        nextItems.splice(Math.min(targetIndex, nextItems.length), 0, ...uploadedItems);
        setSelectedItems(nextItems);
        setSelectedIds(nextItems.map((item) => item.id));
    };

    const setComposerRatio = (value: string) => {
        setRatio(value);
        if (mode === "image") rememberImageSettings({ ratio: value });
        if (mode === "video") rememberVideoSettings({ ratio: value });
    };
    const setComposerSeconds = (value: string) => {
        setSeconds(value);
        if (mode === "video") rememberVideoSettings({ seconds: value });
    };
    const setComposerQuality = (value: string) => {
        setQuality(value);
        if (mode === "image") rememberImageSettings({ quality: value });
    };
    const setComposerImageResolution = (value: string) => {
        setImageResolution(value);
        if (mode === "image") rememberImageSettings({ imageResolution: value });
    };
    const setComposerVideoQuality = (value: string) => {
        setVideoQuality(value);
        if (mode === "video") rememberVideoSettings({ videoQuality: value });
    };
    const setComposerCount = (value: string) => {
        setCount(value);
        if (mode === "image") rememberImageSettings({ count: value });
    };

    const start = () => {
        if (!prompt.trim()) return;
        let externalAttachments: CreationAttachment[] = [];
        try {
            externalAttachments = selectableLibraryItems.flatMap((item) => {
                const reference = item.external;
                if (!reference) return [];
                if (!reference.item.fileUrl) throw new Error(t("create.composer.externalUnreadable", { title: item.title }));
                return [creationAttachmentFromExternalAsset(reference)];
            });
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("create.composer.referenceUnreadable"));
            return;
        }
        onStart({
            homePrompt: prompt.trim(),
            homeMode: mode,
            homeTextStreaming: textStreaming,
            homeTextThinking: textThinkingRequest,
            homeReferenceIds: selectedIds.filter((id) => !id.startsWith("external:")),
            homeExternalAttachments: externalAttachments,
        });
    };

    const composerProps = {
        mode,
        prompt,
        setPrompt: onPromptChange,
        busy: false,
        generationActive: false,
        referenceReplacementBusy: false,
        attachments,
        referenceImageSize,
        maxReferences,
        references,
        onRemoveAttachment: removeReferenceAttachment,
        onClearAttachments: () => handleLibrarySelect([]),
        onClearComposer: () => {
            onPromptChange("");
            handleLibrarySelect([]);
        },
        onReorderAttachments: reorderAttachments,
        onReplaceAttachment: replaceAttachment,
        onReplaceReferenceFiles: replaceReferenceFiles,
        onOpenLibrary: () => setLibraryOpen(true),
        onModeChange: selectMode,
        modePicker,
        model: selectedModel,
        modelRequirements,
        imageProfile,
        videoProfile,
        config: generationConfig,
        onModelChange: (value: string) => updateConfig(modelKey, value),
        ratio,
        setRatio: setComposerRatio,
        seconds,
        setSeconds: setComposerSeconds,
        quality,
        setQuality: setComposerQuality,
        imageResolution,
        setImageResolution: setComposerImageResolution,
        imageParameters,
        setImageParameters: (value: string) => {
            setImageParameters(value);
            rememberImageSettings({ model: selectedModel, imageParameters: value });
        },
        setTransparentBackground: (value: string) => useConfigStore.getState().updateConfig("transparentBackground", value),
        videoQuality,
        setVideoQuality: setComposerVideoQuality,
        count,
        setCount: setComposerCount,
        onAudioConfigChange: (key: CanvasAudioSettingKey, value: string) => useConfigStore.getState().updateConfig(key === "instrumental" ? "audioInstrumental" : key, value),
        textStreaming,
        setTextStreaming,
        textThinkingLevels,
        textThinkingLevel,
        textThinkingRequest,
        setTextThinkingLevel: setTextThinkingRequest,
        promptOptimizerProvider,
        composerFocusRef: promptRef,
        onPromptFocus: loadAddedSkills,
        onSubmit: start,
        referenceDropBusy: false,
        onReferenceDrop: () => undefined,
    };

    return (
        <>
            <div className="creation-home">
                <div className="creation-launchpad">
                    <div className="creation-composer-stage is-home-mode">
                        <div className="creation-empty-composer">
                            <CreationComposer {...composerProps} variant="empty" />
                        </div>
                    </div>
                </div>
            </div>
            {libraryOpen ? (
                <Suspense fallback={null}>
                    <AssetLibraryPickerModal
                        remoteLibrary
                        acceptRemoteItems
                        remoteItemDisabledReason={(asset) => creationLibraryDisabledReason(mode, asset.kind, pickerVideoLimits)}
                        open={libraryOpen}
                        items={libraryItems}
                        categoryLabels={{ ...homeAssetCategoryLabels, ...externalAssets.categoryLabels }}
                        folders={externalAssets.folders}
                        initialSelectedIds={selectedIds}
                        upload={{
                            accept: creationUploadAccept(mode),
                            description: mode === "image" ? t("create.composer.uploadImageHint") : t("create.composer.uploadMediaHint"),
                            onUpload: (files) => uploadLibraryAssets(Array.from(files)),
                            external: { accept: "image/*", description: t("create.composer.uploadEagleHint"), onUpload: (files, folderId) => externalAssets.uploadExternalFiles(files, folderId) },
                        }}
                        onClose={() => setLibraryOpen(false)}
                        onConfirm={handleLibrarySelect}
                    />
                </Suspense>
            ) : null}
        </>
    );
}
