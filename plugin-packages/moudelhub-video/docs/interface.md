# ModelHub 视频协议

## 插件信息

- 插件名称：`ModelHub 视频`
- 插件 ID：`moudelhub-video`
- Provider ID：`moudelhub-video`
- 能力：视频生成
- 协议：`yingce.plugin/v2`
- 素材输入：公网 HTTPS URL

## 上游连接

| 项目 | 默认值 |
| --- | --- |
| API Base URL | `https://api.modelhub.cc` |
| 鉴权 | `Authorization: Bearer <apiKey>` |
| 创建任务 | `POST /v1/videos/generations` |
| 查询任务 | `GET /v1/videos/tasks/{{taskId}}` |
| Content-Type | `application/json` |

创建和查询路径按用户提供的端点配置。若部署使用不同版本路径，可在生成请求的 `extra.createPath` 和 `extra.pollPath` 传入相对路径覆盖；轮询路径可使用 `{{taskId}}`。请求仍使用渠道配置的 Base URL 和 API Key。

## 可用模型与价格参考

下表为用户提供的参考价格（人民币/生成秒或任务单位按渠道计费规则）；平台统一模型名不会提供实际执行来源。实际扣费及参考视频时长的合并计费由上游渠道决定，价格可能调整，配置渠道前请核实。

| 模型 | 支持清晰度 | 价格参考 |
| --- | --- | --- |
| `seedance-2.0` | 480p / 720p / 1080p / 4k | ¥0.35 / ¥0.60 / ¥1.50 / ¥3.00 |
| `seedance-2.0-fast` | 480p / 720p / 1080p / 2k / 4k | ¥0.21 / ¥0.29 / ¥0.49 / ¥1.18 / ¥1.30 |
| `seedance-2.0-mini` | 480p / 720p / 1080p / 2k / 4k | ¥0.18 / ¥0.23 / ¥0.39 / ¥0.75 / ¥1.00 |
| `seedance-2.5` | 480p / 720p / 1080p | ¥0.39 / ¥0.65 / ¥2.80 |
| `wan-3.0` | 480p / 720p / 1080p | ¥0.24 / ¥0.34 / ¥0.68 |
| `wan-3.0-prime` | 480p / 1080p | ¥0.29 / ¥1.16 |

参考视频实际总时长会与输出时长合并计费，参考视频总时长向上取整到整秒。

## 参数映射

| 请求参数 | 类型 | 必填 | 默认值 | 上游 JSON 字段 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `model` | string | 是 | - | `model` | 模型表中的模型编号。 |
| `prompt` | string | 是 | - | `prompt` | 提示词，可使用 `@image_file_1`、`@video_file_1`、`@audio_file_1` 引用素材。 |
| `ratio` | string | 否 | `16:9` | `ratio` | 平台 `aspectRatio`；若缺省也可从 `extra.ratio` 读取。 |
| `resolution` | string | 否 | `720p` | `resolution` | 输出清晰度。 |
| `duration` | integer | 否 | `5` | `duration` | 输出时长，整数秒。 |
| `functionMode` | string | 否 | `omni_reference` | `functionMode` | 支持 `omni_reference`、`first_last_frames`；可从 `extra.functionMode` 读取。 |
| `image_file_1 … image_file_30` | string | 否 | - | 同名字段 | 平台 `images[]` 按 `order` 升序展开；字段值为素材 URL。 |
| `video_file_1 … video_file_50` | string | 否 | - | 同名字段 | 平台 `videos[]` 按 `order` 升序展开；字段值为素材 URL。 |
| `audio_file_1 … audio_file_10` | string | 否 | - | 同名字段 | 平台 `audios[]` 按 `order` 升序展开；字段值为素材 URL。 |
| `generate_audio` | boolean | 否 | `true` | `generate_audio` | 可用 `extra.generate_audio` 显式传入 `false`。 |

平台统一媒体数组会由协议映射为编号字段，不需要调用方在 JSON 里重复填写 `image_file_N` 等字段。需要覆盖 `functionMode` 或 `generate_audio` 时，使用请求扩展字段，例如：

```json
{
  "extra": {
    "functionMode": "first_last_frames",
    "generate_audio": false
  }
}
```

在 `first_last_frames` 模式下，允许 0–2 张图片且不接受视频或音频素材：0 张表示文生视频，1 张表示图生视频，2 张表示首尾帧视频。

## 统一素材检查口径

以下是通用要求；具体渠道或模型可能有更严格的限制。插件负责按序传递公网 HTTPS URL，不会下载、转码、裁剪或探测媒体文件；提交前仍应按模型详情校验素材。

### 图片

- 最终格式为 JPEG、PNG 或 WebP，不支持动态图片。
- 单张小于 10 MiB。
- 宽和高分别为 300–6000 像素，宽高比为 0.4–2.5。
- 2.0 系列最多 9 张；2.5 系列最多 30 张。

### 视频

- MP4 或 MOV，单个不超过 50 MiB。
- 宽和高分别为 300–6000 像素，宽高比为 0.4–2.5。
- 2.0 系列：每段 2–15 秒，合计不超过 15 秒，总像素为 409600–2086876。
- 2.5 系列：每段 2–30 秒，合计不超过 30 秒，总像素为 409600–8295044。
- 开启媒体预处理时，如果仅超过模型时长且超出不超过 1 秒，服务可能截掉视频尾部；其他情况不会自动修复。

### 音频

- MP3、WAV 或 M4A，单个不超过 15 MiB，每段不少于 2 秒。
- 2.0 系列：每段 2–15 秒，合计不超过 15 秒，最多 3 段。
- 2.5 系列：合计不超过 30 秒，最多 10 段，无独立单段时长上限。
- 服务可能尝试转码，或在不超过 1.25 倍速的范围内压缩时长。

### 混合素材

- 2.0 系列最多 12 份素材；2.5 系列最多 50 份素材。
- 模型系列的图片、视频、音频数量及媒体属性以模型详情和提交时返回的提示为准。

## 异步响应映射

创建响应中的任务 ID 依次从 `data.task_id`、`task_id`、`data.id`、`id`、`data.taskId`、`taskId` 读取。轮询响应状态从 `data.status` 或 `status` 读取；错误信息尝试读取 `data.error.message`、`error.message`、`data.message`、`message`、`msg` 或 `fail_reason`。

视频结果 URL 优先读取 ModelHub 查询响应中的 `result.url`，并兼容读取 `data.video_url`、`video_url`、`data.url`、`url`、`data.output.video_url` 或 `output.video_url`。

## 配置要求

在安装后创建或编辑渠道时：

1. 设置 ModelHub API 文档提供的 Base URL。
2. 填入 API Key；当前包按 Bearer 鉴权发送。
3. 若上游端点路径不同，通过 `extra.createPath` 和 `extra.pollPath` 覆盖默认路径。
4. 核对真实任务 ID、状态、失败信息和视频 URL 字段与响应映射一致。

## 失败响应与画布提示

ModelHub 错误响应使用 `{ code, message, data }`。插件把顶层 `code` 非零值识别为失败终态，并从顶层 `message` 读取错误信息；任务查询返回的 `status: failed`、`result.url` 与上述错误字段会分别进入任务状态、视频结果和失败原因映射。若服务通过非 2xx HTTP 状态返回错误，宿主按安全策略对 HTTP 错误做用户可见归类，可能显示鉴权/参数等可行动提示，而不一定回显未经处理的原始 `message`。

| ModelHub code | 可行动说明 |
| --- | --- |
| `-2000` | 参数非法，检查模型支持的比例、清晰度、时长和素材。 |
| `-2001` | 上游暂时不可用或请求超时。 |
| `-2003` / `-2004` | 检查素材 URL 可访问性和文件大小。 |
| `-2006` | 内容审核阻止生成，调整提示词或素材。 |
| `-2007` / `-2008` | 图像或视频生成失败，查看画布任务详情。 |
| `-2009` / `-2012` | 渠道积分或平台预算不足。 |
| `-2010` | API Key 无效或已过期。 |
| `-2011` | 任务不存在、过期或不属于当前账号。 |
| `-2013` | 渠道并发已满，稍后重试。 |

画布失败节点会显示任务错误详情（敏感地址、密钥及内部诊断仍会被隐藏）；点击「查看详情」可检查任务记录。若失败节点没有上游错误文本，首先确认实际返回体是否包含顶层 `message`，以及任务是否已返回 `status: failed`。

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "moudelhub-video",
  "name": "ModelHub 视频",
  "version": "1.0.2",
  "author": "ModelHub / 影策",
  "description": "ModelHub 视频生成协议插件，支持多模态参考素材和编号素材字段。",
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
        "id": "moudelhub-video",
        "label": "ModelHub 视频",
        "capabilities": [
          "video"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation",
          "agent"
        ],
        "baseUrl": "https://api.modelhub.cc",
        "requiresPublicMediaUrls": true,
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
            "description": "模型表中的模型编号。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "视频提示词，可用 @image_file_N、@video_file_N、@audio_file_N 引用对应素材。"
          },
          {
            "name": "ratio",
            "type": "string",
            "mapping": "ratio",
            "description": "画面比例，默认 16:9；读取平台 aspectRatio 或 extra.ratio。"
          },
          {
            "name": "resolution",
            "type": "string",
            "mapping": "resolution",
            "description": "输出清晰度，默认 720p。"
          },
          {
            "name": "duration",
            "type": "integer",
            "mapping": "duration",
            "description": "整数秒，默认 5。"
          },
          {
            "name": "functionMode",
            "type": "string",
            "values": [
              "omni_reference",
              "first_last_frames"
            ],
            "mapping": "functionMode",
            "description": "素材模式，默认 omni_reference；也可通过 extra.functionMode 设置。"
          },
          {
            "name": "image_file_N",
            "type": "media[]",
            "mapping": "image_file_1 … image_file_30",
            "description": "按 images[] 顺序映射为 image_file_1 至 image_file_30，值为公网 HTTPS URL。"
          },
          {
            "name": "video_file_N",
            "type": "media[]",
            "mapping": "video_file_1 … video_file_50",
            "description": "按 videos[] 顺序映射为 video_file_1 至 video_file_50，值为公网 HTTPS URL。"
          },
          {
            "name": "audio_file_N",
            "type": "media[]",
            "mapping": "audio_file_1 … audio_file_10",
            "description": "按 audios[] 顺序映射为 audio_file_1 至 audio_file_10，值为公网 HTTPS URL。"
          },
          {
            "name": "generate_audio",
            "type": "boolean",
            "mapping": "generate_audio",
            "description": "是否生成音频，默认 true；可通过 extra.generate_audio 显式传 false。"
          },
          {
            "name": "createPath",
            "type": "string",
            "mapping": "extra.createPath",
            "description": "可选的相对创建路径覆盖；默认 /v1/videos/generations。"
          },
          {
            "name": "pollPath",
            "type": "string",
            "mapping": "extra.pollPath",
            "description": "可选的相对轮询路径覆盖；默认 /v1/videos/tasks/{{taskId}}。"
          }
        ],
        "validations": [
          {
            "assert": {
              "$in": [
                {
                  "$coalesce": [
                    {
                      "$ref": "request.extra.functionMode"
                    },
                    {
                      "$ref": "request.providerOptions.moudelhub-video.functionMode"
                    },
                    "omni_reference"
                  ]
                },
                [
                  "omni_reference",
                  "first_last_frames"
                ]
              ]
            },
            "message": "functionMode 仅支持 omni_reference 或 first_last_frames"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$ref": "request.images"
                  }
                },
                30
              ]
            },
            "message": "MoudelHub 插件最多映射 30 张图片"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$ref": "request.videos"
                  }
                },
                50
              ]
            },
            "message": "MoudelHub 插件最多映射 50 个视频素材"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$ref": "request.audios"
                  }
                },
                10
              ]
            },
            "message": "MoudelHub 插件最多映射 10 个音频素材"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$add": [
                    {
                      "$len": {
                        "$ref": "request.images"
                      }
                    },
                    {
                      "$len": {
                        "$ref": "request.videos"
                      }
                    },
                    {
                      "$len": {
                        "$ref": "request.audios"
                      }
                    }
                  ]
                },
                50
              ]
            },
            "message": "MoudelHub 插件最多接收 50 份混合素材；模型自身限制可能更严格"
          },
          {
            "assert": {
              "$if": {
                "condition": {
                  "$eq": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.extra.functionMode"
                        },
                        {
                          "$ref": "request.providerOptions.moudelhub-video.functionMode"
                        },
                        "omni_reference"
                      ]
                    },
                    "first_last_frames"
                  ]
                },
                "then": {
                  "$and": [
                    {
                      "$lte": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        2
                      ]
                    },
                    {
                      "$eq": [
                        {
                          "$len": {
                            "$ref": "request.videos"
                          }
                        },
                        0
                      ]
                    },
                    {
                      "$eq": [
                        {
                          "$len": {
                            "$ref": "request.audios"
                          }
                        },
                        0
                      ]
                    }
                  ]
                },
                "else": true
              }
            },
            "message": "first_last_frames 模式只接受 0–2 张图片，不能同时传入视频或音频"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/v1/videos/generations",
          "pathTemplate": {
            "$coalesce": [
              {
                "$ref": "request.extra.createPath"
              },
              {
                "$ref": "request.providerOptions.moudelhub-video.createPath"
              },
              "/v1/videos/generations"
            ]
          },
          "contentType": "application/json",
          "body": {
            "$merge": [
              {
                "model": {
                  "$ref": "request.model"
                },
                "prompt": {
                  "$ref": "request.prompt"
                },
                "ratio": {
                  "$coalesce": [
                    {
                      "$ref": "request.aspectRatio"
                    },
                    {
                      "$ref": "request.extra.ratio"
                    },
                    "16:9"
                  ]
                },
                "resolution": {
                  "$coalesce": [
                    {
                      "$ref": "request.resolution"
                    },
                    {
                      "$ref": "request.extra.resolution"
                    },
                    "720p"
                  ]
                },
                "duration": {
                  "$coalesce": [
                    {
                      "$ref": "request.duration"
                    },
                    {
                      "$ref": "request.extra.duration"
                    },
                    5
                  ]
                },
                "functionMode": {
                  "$coalesce": [
                    {
                      "$ref": "request.extra.functionMode"
                    },
                    {
                      "$ref": "request.providerOptions.moudelhub-video.functionMode"
                    },
                    "omni_reference"
                  ]
                }
              },
              {
                "$indexObject": {
                  "from": {
                    "$concatArrays": [
                      [
                        {
                          "sentinel": true
                        }
                      ],
                      {
                        "$sortByOrder": {
                          "$ref": "request.images"
                        }
                      }
                    ]
                  },
                  "as": "media",
                  "prefix": "image_file_",
                  "max": 31,
                  "value": {
                    "$ref": "media.value"
                  }
                }
              },
              {
                "$indexObject": {
                  "from": {
                    "$concatArrays": [
                      [
                        {
                          "sentinel": true
                        }
                      ],
                      {
                        "$sortByOrder": {
                          "$ref": "request.videos"
                        }
                      }
                    ]
                  },
                  "as": "media",
                  "prefix": "video_file_",
                  "max": 51,
                  "value": {
                    "$ref": "media.value"
                  }
                }
              },
              {
                "$indexObject": {
                  "from": {
                    "$concatArrays": [
                      [
                        {
                          "sentinel": true
                        }
                      ],
                      {
                        "$sortByOrder": {
                          "$ref": "request.audios"
                        }
                      }
                    ]
                  },
                  "as": "media",
                  "prefix": "audio_file_",
                  "max": 11,
                  "value": {
                    "$ref": "media.value"
                  }
                }
              },
              {
                "generate_audio": {
                  "$if": {
                    "condition": {
                      "$ne": [
                        {
                          "$ref": "request.extra.generate_audio"
                        },
                        null
                      ]
                    },
                    "then": {
                      "$ref": "request.extra.generate_audio"
                    },
                    "else": {
                      "$if": {
                        "condition": {
                          "$ne": [
                            {
                              "$ref": "request.providerOptions.moudelhub-video.generate_audio"
                            },
                            null
                          ]
                        },
                        "then": {
                          "$ref": "request.providerOptions.moudelhub-video.generate_audio"
                        },
                        "else": true
                      }
                    }
                  }
                }
              }
            ]
          }
        },
        "poll": {
          "method": "GET",
          "path": "/v1/videos/tasks/{{taskId}}",
          "pathTemplate": {
            "$coalesce": [
              {
                "$ref": "request.extra.pollPath"
              },
              {
                "$ref": "request.providerOptions.moudelhub-video.pollPath"
              },
              "/v1/videos/tasks/{{taskId}}"
            ]
          },
          "contentType": "application/json"
        },
        "response": {
          "taskId": {
            "$coalesce": [
              {
                "$ref": "response.data.task_id"
              },
              {
                "$ref": "response.task_id"
              },
              {
                "$ref": "response.data.id"
              },
              {
                "$ref": "response.id"
              },
              {
                "$ref": "response.data.taskId"
              },
              {
                "$ref": "response.taskId"
              },
              {
                "$ref": "taskId"
              }
            ]
          },
          "status": {
            "$coalesce": [
              {
                "$ref": "response.data.status"
              },
              {
                "$ref": "response.status"
              },
              "pending"
            ]
          },
          "message": {
            "$coalesce": [
              {
                "$ref": "response.data.error.message"
              },
              {
                "$ref": "response.error.message"
              },
              {
                "$ref": "response.data.message"
              },
              {
                "$ref": "response.message"
              },
              {
                "$ref": "response.msg"
              },
              {
                "$ref": "response.fail_reason"
              }
            ]
          },
          "videos": {
            "$coalesce": [
              {
                "$ref": "response.result.url"
              },
              {
                "$ref": "response.data.video_url"
              },
              {
                "$ref": "response.video_url"
              },
              {
                "$ref": "response.data.url"
              },
              {
                "$ref": "response.url"
              },
              {
                "$ref": "response.data.output.video_url"
              },
              {
                "$ref": "response.output.video_url"
              }
            ]
          },
          "errorPaths": [
            "data.error.code",
            "error.code",
            "code"
          ],
          "resultEphemeral": true
        }
      }
    ]
  },
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>"
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
