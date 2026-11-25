# ModelHub 视频

内置声明式视频 Provider，将平台有序的图片、视频、音频参考素材映射为 `image_file_N`、`video_file_N`、`audio_file_N` 字段。默认 API 地址为 `https://api.modelhub.cc`，Bearer 鉴权，异步提交并轮询任务。

错误响应的顶层 `code` 与 `message` 已映射为失败状态和原因；画布节点显示经过安全处理的错误原因。模型价格仅作为文档参考，请以渠道实际计费为准。

完整模型、参数、素材要求、价格和错误码说明见 [docs/interface.md](docs/interface.md)。
