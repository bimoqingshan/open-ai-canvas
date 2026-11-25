import { FolderOpen, Layers3, Palette, PersonStanding, UploadCloud, UserRound } from "lucide-react";

import { getNodeIcon, getNodeLabel } from "@/lib/canvas/node-registry";
import { registerAddNodeMenuCommands, type AddNodeMenuCommand } from "@/lib/canvas/tool-registry";
import { CanvasNodeType } from "@/types/canvas";

/** 真正创建节点的命令，文案与图标统一取自节点注册表。 */
function nodeCommand(type: CanvasNodeType, rest: Omit<AddNodeMenuCommand, "id" | "label" | "icon" | "section">): AddNodeMenuCommand {
    return { id: type, label: getNodeLabel(type), icon: getNodeIcon(type), section: "node", ...rest };
}

export const addNodeMenuCommands: AddNodeMenuCommand[] = [
    // 项目级动作不占用节点网格，创作节点保持统一排列。
    { id: "style", label: "项目画风", icon: <Palette />, section: "project", defaultOrder: 10, applicable: (ctx) => !ctx.isProjectLinked, run: (ctx) => ctx.handlers.onChooseStyle() },
    // 创作节点
    nodeCommand(CanvasNodeType.Text, { defaultOrder: 10, run: (ctx) => ctx.handlers.onAddText() }),
    nodeCommand(CanvasNodeType.Image, { defaultOrder: 20, run: (ctx) => ctx.handlers.onAddImage() }),
    nodeCommand(CanvasNodeType.Video, { defaultOrder: 30, run: (ctx) => ctx.handlers.onAddVideo() }),
    nodeCommand(CanvasNodeType.Audio, { defaultOrder: 40, applicable: (ctx) => ctx.workspaceMode !== "simple", run: (ctx) => ctx.handlers.onAddAudio() }),
    nodeCommand(CanvasNodeType.Drawing, { defaultOrder: 45, run: (ctx) => ctx.handlers.onAddDrawing() }),
    nodeCommand(CanvasNodeType.Script, { badge: "核心", defaultOrder: 50, run: (ctx) => ctx.handlers.onAddScript() }),
    { id: "project-character", label: "角色卡", icon: <UserRound />, section: "node", defaultOrder: 55, run: (ctx) => ctx.handlers.onOpenProjectCharacters() },
    nodeCommand(CanvasNodeType.BatchTable, { defaultOrder: 66, run: (ctx) => ctx.handlers.onAddExtensionNode(CanvasNodeType.BatchTable) }),
    // 世界引擎落在节点分区，但它开的是导演工作台、不是某种画布节点，故不走注册表。
    { id: "previs", label: "世界引擎", icon: <Layers3 />, badge: "3D", section: "node", defaultOrder: 70, applicable: (ctx) => ctx.workspaceMode !== "simple", run: (ctx) => ctx.handlers.onOpenPrevis() },
    // 导入资源
    { id: "upload", label: "上传文件", icon: <UploadCloud />, section: "resource", defaultOrder: 10, run: (ctx) => ctx.handlers.onUpload() },
    { id: "assets", label: "素材库", icon: <FolderOpen />, section: "resource", defaultOrder: 30, applicable: (ctx) => !ctx.isProjectLinked, run: (ctx) => ctx.handlers.onOpenMyAssets() },
    { id: "pose-library", label: "姿势库", icon: <PersonStanding />, section: "resource", defaultOrder: 35, applicable: (ctx) => Boolean(ctx.handlers.onOpenPoseLibrary), run: (ctx) => ctx.handlers.onOpenPoseLibrary?.() },
];

registerAddNodeMenuCommands(addNodeMenuCommands);
