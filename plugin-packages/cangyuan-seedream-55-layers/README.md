# Seedream 5.5 图层拆分

独立的 `yingce.plugin/v2` 图片协议，面向兼容接口 `/v1/images/generations`，模型为 `doubao-seedream-5-5-261028`。支持单图生成、最多 10 张参考图、透明 PNG、图层拆分及规整文字识别。

默认服务地址为 `https://direct-api.cangyuansuanli.cn`，渠道管理员可按实际服务修改 Base URL 并配置 Bearer API Key。此插件使用独立 ID `cangyuan-seedream-55-layers`，不会替换或修改火山官方 Ark Seedream 协议。

拆层结果按上游 `data[]` 顺序返回，第一项为底图，后续为图层；图层 `z_index`、`bounding_box`、名称、描述和 `text_recognition` 元数据保持原样。图层图片按普通图片结果由宿主持久化和展示。
