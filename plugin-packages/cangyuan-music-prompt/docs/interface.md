# 沧元提示词直出音乐接口

## 协议身份

- 插件和 Provider ID：`cangyuan-music-prompt`。
- 能力：`audio`。
- 默认 Base URL：`https://direct-api.cangyuansuanli.cn`。
- 鉴权：`Authorization: Bearer <API Key>`。
- 创建：`POST /v1/music`。
- 查询：`POST /v1/music/{id}`。

## 创建请求

| 字段 | 取值 | 说明 |
| --- | --- | --- |
| `model` | 渠道模型名，例如 `su2-suno-v6` | 必填。 |
| `prompt` | 唯一正文 | 必填。不另传歌词、风格、时长或参考音频。 |
| `n` | 固定 `1` | 一次请求。响应仍可能包含多段音频。 |
| `instrumental` | 可选布尔值 | 未设置时不发送；显式 `false` 会保留并发送。 |

示例：

```json
{
  "model": "su2-suno-v6",
  "prompt": "慢速爵士钢琴，雨夜，没有人声",
  "n": 1,
  "instrumental": true
}
```

创建响应使用 `id` 作为轮询任务 ID。旧公共名 `suno` 不属于本插件；本插件也不沿用其它 `suno-*` 接口的字段规则。

## 轮询与结果

对创建响应的 `id` 发起 `POST /v1/music/{id}`。已确认的完成响应形状：

```json
{
  "id": "task_42",
  "object": "music.generation",
  "model": "su2-suno-v6",
  "status": "completed",
  "progress": "100%",
  "created_at": 1715923200,
  "music_url": [
    "https://example.com/result-a.mp3",
    "https://example.com/result-b.mp3"
  ]
}
```

插件把 `status` 交给宿主状态机，把 `progress` 用作阶段文案，并按原顺序将 `music_url` 中的所有地址映射为音频结果。结果地址按临时上游媒体处理，由宿主完成下载、校验和资源保存；不只取列表首项。

## 错误与边界

- HTTP/业务失败按失败处理，不伪造音频结果。
- 不声明取消或独立结果下载接口。
- API Key 由宿主渠道配置提供，不写入提示词或 URL。

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "cangyuan-music-prompt",
  "name": "沧元提示词直出音乐",
  "version": "1.0.0",
  "author": "沧元算力 / 影策",
  "description": "通过唯一 prompt 直接生成音乐，轮询任务并保存全部返回音频。",
  "permissions": [
    "generation.run",
    "media.read"
  ],
  "configuration": {
    "fields": [
      {
        "name": "apiKey",
        "type": "secret",
        "label": "API Key",
        "required": true
      }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "cangyuan-music-prompt",
        "label": "沧元提示词直出音乐",
        "capabilities": [
          "audio"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation",
          "agent"
        ],
        "baseUrl": "https://direct-api.cangyuansuanli.cn",
        "requiresPublicMediaUrls": false,
        "auth": {
          "type": "bearer",
          "field": "apiKey"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "model",
            "description": "音乐模型 ID，例如 su2-suno-v6。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "唯一正文；歌词、风格、时长等要求均写在此提示词内。"
          },
          {
            "name": "instrumental",
            "type": "boolean",
            "required": false,
            "mapping": "providerOptions.cangyuan-music-prompt.instrumental",
            "description": "可选纯音乐开关；未设置时省略，显式 false 会原样发送。"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/v1/music",
          "contentType": "application/json",
          "body": {
            "model": {
              "$ref": "request.model"
            },
            "prompt": {
              "$ref": "request.prompt"
            },
            "n": 1,
            "instrumental": {
              "$omitEmpty": {
                "$if": {
                  "condition": {
                    "$ne": [
                      {
                        "$ref": "request.providerOptions.cangyuan-music-prompt.instrumental"
                      },
                      null
                    ]
                  },
                  "then": {
                    "$ref": "request.providerOptions.cangyuan-music-prompt.instrumental"
                  },
                  "else": null
                }
              }
            }
          }
        },
        "poll": {
          "method": "GET",
          "path": "/v1/music/{{taskId}}"
        },
        "response": {
          "taskId": {
            "$coalesce": [
              {
                "$ref": "response.id"
              },
              {
                "$ref": "response.task_id"
              },
              {
                "$ref": "taskId"
              }
            ]
          },
          "status": {
            "$coalesce": [
              {
                "$ref": "response.status"
              },
              "pending"
            ]
          },
          "stage": {
            "$ref": "response.progress"
          },
          "message": {
            "$coalesce": [
              {
                "$ref": "response.error.message"
              },
              {
                "$ref": "response.message"
              },
              {
                "$ref": "response.msg"
              }
            ]
          },
          "audios": {
            "$ref": "response.music_url"
          },
          "errorPaths": [
            "error.code"
          ],
          "resultEphemeral": true,
          "messagePaths": [
            "error.message",
            "message",
            "msg"
          ]
        }
      }
    ]
  },
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>"
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
