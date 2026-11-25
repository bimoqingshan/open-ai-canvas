# Seedance 异步音频接口

## 支持范围与部署

- 插件 / Provider ID：`seedance-audio`；能力：`audio`。
- 已确认的模型合同仅为 `doubao-seed-audio-1.0`；其他模型 ID 在提交前拒绝。API 文档提及 Mureka，但没有精确模型 ID 与完整参数合同，因此本插件不宣称支持 Mureka、MiniMax 或 Qwen3 TTS。
- 默认 Base URL：`https://api.seedance.nz`，配置字段 `apiKey` 为必填 secret，由宿主使用 `Authorization: Bearer <apiKey>` 鉴权。
- 创建：`POST /v1/audio/generations`，JSON 请求；查询：`GET /v1/audio/generations/{task_id}`。
- 这是无可执行文件的声明式插件，不依赖新增 `host:` 适配器。现有支持 `yingce.plugin/v2` 和本包表达式的 Docker 后端可导入 `.yingce-plugin`，无需构建或发布内核。
- 管理界面导入时使用正常插件安装流程；直接登记持久卷中的插件包后，需由管理员按现有部署流程重新加载后端注册表。本包不修改数据库、宿主代码或 Compose。
- 当前宿主音频轮询固定约 2.5 秒一次；插件 schema 没有轮询间隔参数，本包不声称提供 3–5 秒可调轮询。

## 请求字段

| 统一字段 | 上游字段 | 规则 |
| --- | --- | --- |
| `model` | `model` | 必填，严格为 `doubao-seed-audio-1.0` |
| `prompt` | `prompt` | 必填，5–2048 个 Unicode 字符，拒绝全空白 |
| `images` | `images` | 只发送数组第一张的 HTTP(S) URL；其余图片不发送 |
| `audios` | `metadata.audio_url` | 按传入顺序发送 URL 数组，最多 3 个；上游也允许单字符串或 `audio_urls`，本插件统一使用 `audio_url` 数组 |
| `extra.audioVoice` | `metadata.speaker` | 可选；去除首尾空白。空值和宿主默认占位 `alloy` 均省略；其他值必须是供应商实际提供的音色 ID |
| `extra.audioFormat` | `metadata.format` | 缺省 `wav`，允许 `wav` / `mp3` / `pcm` / `ogg_opus` |
| `extra.audioSpeed` | `metadata.speech_rate` | 缺省 1 倍速 → 0；有效输入为 0.25–4，映射 `speed × 100 - 100`，夹紧到 -50–100，转换为整数 |
| `providerOptions.seedance-audio.sample_rate` | `metadata.sample_rate` | 缺省字符串 `"24000"`，允许 8000 / 16000 / 24000 / 32000 / 44100；数字输入归一化成字符串 |
| `providerOptions.seedance-audio.speech_rate` | `metadata.speech_rate` | 可选，-50–100 的整数；显式指定时优先于倍速，保留 0 |
| `providerOptions.seedance-audio.loudness_rate` | `metadata.loudness_rate` | 可选，-50–100 的整数；缺省省略，保留 0 |
| `providerOptions.seedance-audio.pitch_rate` | `metadata.pitch_rate` | 可选，-12–12 的整数；缺省省略，保留 0 |

图片、参考音频和真实 `speaker` 三种参考方式两两互斥，混用在创建请求之前明确报错，不静默丢弃。宿主默认 `alloy` 不视为真实音色，因此不会妨碍图片或音频参考。视频参考不受支持。

参考音频必须为 MP3 / WAV，每个不超过 10MB。插件检查数量、HTTP(S) URL 和已提供的 MIME 类型；当前声明式 schema 无法自行下载检查远程文件字节、大小或实际编码，这些限制由调用方和上游最终校验。没有 MIME 信息时不依据 URL 后缀猜测格式，带签名的无后缀 URL 可正常提交。

`requiresPublicMediaUrls: true` 使宿主走公网媒体 URL 准备流程。插件不支持把 data URL / 本地文件路径直接发给上游；URL 必须可由 Seedance 服务器访问。宿主仍执行原有 URL 安全校验。

倍速映射会消除浮点数在整数边界上的微小误差，例如 1.15 映射 15、0.85 映射 -15。超出语速百分比范围时夹紧，任意小数百分比向零取整。显式 `speech_rate` / `loudness_rate` / `pitch_rate` 若超界或非整数则拒绝。

上述默认值适用于插件收到空参数的情况。若当前画布预先填入 `mp3` 等非空值，插件尊重该值，不将其替换成 `wav`。本包不修改前端默认配置，也不自动枚举供应商 speaker。

## 响应、状态和错误

提交响应示例：

```json
{"id":"record-id","task_id":"task-id","status":"queued"}
```

任务 ID 优先 `task_id`，其次 `data.task_id`、`id`；查询可回退到本次 `taskId`。两种 ID 同时存在时必须用 `task_id` 构造查询路径。

查询响应示例：

```json
{
  "code": "success",
  "data": {
    "task_id": "task-id",
    "status": "SUCCESS",
    "data": {
      "status": "succeeded",
      "content": {
        "audio_urls": ["https://media.example/part-1.wav", "https://media.example/part-2.wav"],
        "audio_url": "https://media.example/part-1.wav"
      }
    }
  }
}
```

| 上游状态 | 内部状态 |
| --- | --- |
| `NOT_START` / `SUBMITTED` / `queued` / `pending` | `pending` |
| `IN_PROGRESS` / `processing` / `running` | `processing` |
| `SUCCESS` / `succeeded` / `completed`，且有结果 | `succeeded` |
| `FAILURE` / `failed` / `error` / `expired` / `cancelled` / `canceled` | `failed` |

正常状态优先读取 `data.status`，再读取嵌套任务 `data.data.status`，最后读取顶层 `status`。任何层级的失败状态或非空 `error` / `fail_reason` 优先于正常状态；顶层 `code` 存在且不严格等于 `"success"` 时立即失败。提交响应允许不含 `code`。未知 / 缺失状态和成功但没有音频结果也立即失败，避免一直轮询到超时。

失败信息优先保留 `fail_reason`、`error.message`、`message`、`msg`（包括嵌套任务对应字段）；只有错误对象时保留对象内容，没有说明时提供明确的缺失状态 / 缺失结果提示。真实 Go adapter 返回 `StatusFailed`，现有宿主据此结束任务；HTTP 错误仍由宿主传输层处理。

## 有序结果与持久化

按以下顺序取第一个非空结果字段：

1. `data.data.content.audio_urls`：带任务外层封装的完整有序列表。
2. `data.content.audio_urls`：文档直接描述的 content 完整列表。
3. `data.data.content.audio_url`。
4. `data.content.audio_url`。
5. `data.result_url`。
6. 顶层 `result_url`。

完整列表优先于单 URL / `result_url`，保留全部元素及原有顺序，不排序、不截断、不去重。列表为空时再回退到单 URL。所有音频结果标记 `ephemeral: true`，交由宿主既有媒体持久化流程处理；该标记不保证远端 URL 的实际寿命或下载一定成功。

## 本地验证与限制

专项测试文件为 `backend/internal/protocol/seedance_audio_test.go`，通过真实 `LoadManifest` / `ParsePluginPackage` / `LoadInstalledProviders` 加载插件，并调用 `BuildCreate`、`ParseCreate`、`BuildPoll`、`ParsePoll`。同组用例分别针对源码 manifest 和打包产物执行，包含缺省值、倍速、参数边界、参考媒体、互斥、上游错误、各任务状态、结果优先级和列表顺序；还逐字节核对包内文件与源码一致。

测试仅使用本地虚构请求 / 响应，不调用真实付费 API。尚未验证实际生成质量、音色 ID 有效性、账号权限、上游可用性、真实远程文件大小 / 编码，以及服务器端下载与画布播放。

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "seedance-audio",
  "name": "Seedance 异步音频",
  "version": "1.0.0",
  "author": "Seedance / 影策",
  "description": "Seedance Doubao Seed Audio 异步音频插件，仅确认 doubao-seed-audio-1.0 合同；支持参考图片、参考音频或指定音色。",
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
        "id": "seedance-audio",
        "label": "Seedance 异步音频",
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
        "baseUrl": "https://api.seedance.nz",
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
            "description": "仅支持已确认合同的 doubao-seed-audio-1.0。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "5–2048 个字符，空白提示词拒绝。"
          },
          {
            "name": "images",
            "type": "array",
            "required": false,
            "mapping": "images",
            "description": "仅发送第一张图片的公网 HTTP(S) URL；与参考音频、真实 speaker 互斥。"
          },
          {
            "name": "audios",
            "type": "array",
            "required": false,
            "mapping": "metadata.audio_url",
            "description": "最多 3 个 MP3/WAV 公网 URL，每个不超过 10MB；与图片、真实 speaker 互斥。"
          },
          {
            "name": "providerOptions",
            "type": "object",
            "required": false,
            "mapping": "metadata",
            "description": "seedance-audio 命名空间：sample_rate、speech_rate、loudness_rate、pitch_rate。"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/v1/audio/generations",
          "contentType": "application/json",
          "body": {
            "model": {
              "$ref": "request.model"
            },
            "prompt": {
              "$ref": "request.prompt"
            },
            "images": {
              "$if": {
                "condition": {
                  "$ref": "request.images"
                },
                "then": [
                  {
                    "$ref": "request.images.0.url"
                  }
                ],
                "else": null
              }
            },
            "metadata": {
              "speaker": {
                "$if": {
                  "condition": {
                    "$in": [
                      {
                        "$lower": {
                          "$trim": {
                            "$ref": "request.extra.audioVoice"
                          }
                        }
                      },
                      [
                        "",
                        "alloy"
                      ]
                    ]
                  },
                  "then": null,
                  "else": {
                    "$trim": {
                      "$ref": "request.extra.audioVoice"
                    }
                  }
                }
              },
              "audio_url": {
                "$omitEmpty": {
                  "$map": {
                    "from": {
                      "$ref": "request.audios"
                    },
                    "as": "aud",
                    "in": {
                      "$ref": "aud.url"
                    }
                  }
                }
              },
              "format": {
                "$coalesce": [
                  {
                    "$ref": "request.extra.audioFormat"
                  },
                  "wav"
                ]
              },
              "sample_rate": {
                "$toString": {
                  "$coalesce": [
                    {
                      "$ref": "request.providerOptions.seedance-audio.sample_rate"
                    },
                    "24000"
                  ]
                }
              },
              "speech_rate": {
                "$if": {
                  "condition": {
                    "$eq": [
                      {
                        "$coalesce": [
                          {
                            "$ref": "request.providerOptions.seedance-audio.speech_rate"
                          }
                        ]
                      },
                      null
                    ]
                  },
                  "then": {
                    "$toInt": {
                      "$add": [
                        {
                          "$max": [
                            -50,
                            {
                              "$min": [
                                100,
                                {
                                  "$add": [
                                    {
                                      "$multiply": [
                                        {
                                          "$toFloat": {
                                            "$coalesce": [
                                              {
                                                "$ref": "request.extra.audioSpeed"
                                              },
                                              1
                                            ]
                                          }
                                        },
                                        100
                                      ]
                                    },
                                    -100
                                  ]
                                }
                              ]
                            }
                          ]
                        },
                        {
                          "$if": {
                            "condition": {
                              "$gte": [
                                {
                                  "$max": [
                                    -50,
                                    {
                                      "$min": [
                                        100,
                                        {
                                          "$add": [
                                            {
                                              "$multiply": [
                                                {
                                                  "$toFloat": {
                                                    "$coalesce": [
                                                      {
                                                        "$ref": "request.extra.audioSpeed"
                                                      },
                                                      1
                                                    ]
                                                  }
                                                },
                                                100
                                              ]
                                            },
                                            -100
                                          ]
                                        }
                                      ]
                                    }
                                  ]
                                },
                                0
                              ]
                            },
                            "then": 1e-7,
                            "else": -1e-7
                          }
                        }
                      ]
                    }
                  },
                  "else": {
                    "$toInt": {
                      "$ref": "request.providerOptions.seedance-audio.speech_rate"
                    }
                  }
                }
              },
              "loudness_rate": {
                "$if": {
                  "condition": {
                    "$eq": [
                      {
                        "$coalesce": [
                          {
                            "$ref": "request.providerOptions.seedance-audio.loudness_rate"
                          }
                        ]
                      },
                      null
                    ]
                  },
                  "then": null,
                  "else": {
                    "$toInt": {
                      "$ref": "request.providerOptions.seedance-audio.loudness_rate"
                    }
                  }
                }
              },
              "pitch_rate": {
                "$if": {
                  "condition": {
                    "$eq": [
                      {
                        "$coalesce": [
                          {
                            "$ref": "request.providerOptions.seedance-audio.pitch_rate"
                          }
                        ]
                      },
                      null
                    ]
                  },
                  "then": null,
                  "else": {
                    "$toInt": {
                      "$ref": "request.providerOptions.seedance-audio.pitch_rate"
                    }
                  }
                }
              }
            }
          }
        },
        "poll": {
          "method": "GET",
          "path": "/v1/audio/generations/{{taskId}}"
        },
        "response": {
          "taskId": {
            "$coalesce": [
              {
                "$ref": "response.task_id"
              },
              {
                "$ref": "response.data.task_id"
              },
              {
                "$ref": "response.id"
              },
              {
                "$ref": "taskId"
              }
            ]
          },
          "status": {
            "$switch": {
              "cases": [
                {
                  "when": {
                    "$or": [
                      {
                        "$and": [
                          {
                            "$ne": [
                              {
                                "$ref": "response.code"
                              },
                              null
                            ]
                          },
                          {
                            "$ne": [
                              {
                                "$ref": "response.code"
                              },
                              "success"
                            ]
                          }
                        ]
                      },
                      {
                        "$ref": "response.error"
                      },
                      {
                        "$ref": "response.data.error"
                      },
                      {
                        "$ref": "response.data.data.error"
                      },
                      {
                        "$ref": "response.fail_reason"
                      },
                      {
                        "$ref": "response.data.fail_reason"
                      },
                      {
                        "$ref": "response.data.data.fail_reason"
                      },
                      {
                        "$in": [
                          {
                            "$lower": {
                              "$ref": "response.data.status"
                            }
                          },
                          [
                            "failure",
                            "failed",
                            "error",
                            "expired",
                            "cancelled",
                            "canceled"
                          ]
                        ]
                      },
                      {
                        "$in": [
                          {
                            "$lower": {
                              "$ref": "response.data.data.status"
                            }
                          },
                          [
                            "failure",
                            "failed",
                            "error",
                            "expired",
                            "cancelled",
                            "canceled"
                          ]
                        ]
                      },
                      {
                        "$in": [
                          {
                            "$lower": {
                              "$ref": "response.status"
                            }
                          },
                          [
                            "failure",
                            "failed",
                            "error",
                            "expired",
                            "cancelled",
                            "canceled"
                          ]
                        ]
                      }
                    ]
                  },
                  "then": "failed"
                },
                {
                  "when": {
                    "$in": [
                      {
                        "$lower": {
                          "$coalesce": [
                            {
                              "$ref": "response.data.status"
                            },
                            {
                              "$ref": "response.data.data.status"
                            },
                            {
                              "$ref": "response.status"
                            }
                          ]
                        }
                      },
                      [
                        "success",
                        "succeeded",
                        "completed"
                      ]
                    ]
                  },
                  "then": {
                    "$if": {
                      "condition": {
                        "$coalesce": [
                          {
                            "$ref": "response.data.data.content.audio_urls"
                          },
                          {
                            "$ref": "response.data.content.audio_urls"
                          },
                          {
                            "$ref": "response.data.data.content.audio_url"
                          },
                          {
                            "$ref": "response.data.content.audio_url"
                          },
                          {
                            "$ref": "response.data.result_url"
                          },
                          {
                            "$ref": "response.result_url"
                          }
                        ]
                      },
                      "then": "succeeded",
                      "else": "failed"
                    }
                  }
                },
                {
                  "when": {
                    "$in": [
                      {
                        "$lower": {
                          "$coalesce": [
                            {
                              "$ref": "response.data.status"
                            },
                            {
                              "$ref": "response.data.data.status"
                            },
                            {
                              "$ref": "response.status"
                            }
                          ]
                        }
                      },
                      [
                        "not_start",
                        "submitted",
                        "queued",
                        "pending"
                      ]
                    ]
                  },
                  "then": "pending"
                },
                {
                  "when": {
                    "$in": [
                      {
                        "$lower": {
                          "$coalesce": [
                            {
                              "$ref": "response.data.status"
                            },
                            {
                              "$ref": "response.data.data.status"
                            },
                            {
                              "$ref": "response.status"
                            }
                          ]
                        }
                      },
                      [
                        "in_progress",
                        "processing",
                        "running"
                      ]
                    ]
                  },
                  "then": "processing"
                }
              ],
              "default": "failed"
            }
          },
          "message": {
            "$coalesce": [
              {
                "$ref": "response.data.fail_reason"
              },
              {
                "$ref": "response.data.data.fail_reason"
              },
              {
                "$ref": "response.fail_reason"
              },
              {
                "$ref": "response.error.message"
              },
              {
                "$ref": "response.data.error.message"
              },
              {
                "$ref": "response.data.data.error.message"
              },
              {
                "$ref": "response.message"
              },
              {
                "$ref": "response.msg"
              },
              {
                "$ref": "response.data.message"
              },
              {
                "$ref": "response.error"
              },
              {
                "$ref": "response.data.error"
              },
              {
                "$ref": "response.data.data.error"
              },
              {
                "$if": {
                  "condition": {
                    "$and": [
                      {
                        "$ne": [
                          {
                            "$ref": "response.code"
                          },
                          null
                        ]
                      },
                      {
                        "$ne": [
                          {
                            "$ref": "response.code"
                          },
                          "success"
                        ]
                      }
                    ]
                  },
                  "then": {
                    "$concat": [
                      "Seedance 业务错误 code=",
                      {
                        "$toString": {
                          "$ref": "response.code"
                        }
                      }
                    ]
                  },
                  "else": null
                }
              },
              {
                "$if": {
                  "condition": {
                    "$eq": [
                      {
                        "$switch": {
                          "cases": [
                            {
                              "when": {
                                "$or": [
                                  {
                                    "$and": [
                                      {
                                        "$ne": [
                                          {
                                            "$ref": "response.code"
                                          },
                                          null
                                        ]
                                      },
                                      {
                                        "$ne": [
                                          {
                                            "$ref": "response.code"
                                          },
                                          "success"
                                        ]
                                      }
                                    ]
                                  },
                                  {
                                    "$ref": "response.error"
                                  },
                                  {
                                    "$ref": "response.data.error"
                                  },
                                  {
                                    "$ref": "response.data.data.error"
                                  },
                                  {
                                    "$ref": "response.fail_reason"
                                  },
                                  {
                                    "$ref": "response.data.fail_reason"
                                  },
                                  {
                                    "$ref": "response.data.data.fail_reason"
                                  },
                                  {
                                    "$in": [
                                      {
                                        "$lower": {
                                          "$ref": "response.data.status"
                                        }
                                      },
                                      [
                                        "failure",
                                        "failed",
                                        "error",
                                        "expired",
                                        "cancelled",
                                        "canceled"
                                      ]
                                    ]
                                  },
                                  {
                                    "$in": [
                                      {
                                        "$lower": {
                                          "$ref": "response.data.data.status"
                                        }
                                      },
                                      [
                                        "failure",
                                        "failed",
                                        "error",
                                        "expired",
                                        "cancelled",
                                        "canceled"
                                      ]
                                    ]
                                  },
                                  {
                                    "$in": [
                                      {
                                        "$lower": {
                                          "$ref": "response.status"
                                        }
                                      },
                                      [
                                        "failure",
                                        "failed",
                                        "error",
                                        "expired",
                                        "cancelled",
                                        "canceled"
                                      ]
                                    ]
                                  }
                                ]
                              },
                              "then": "failed"
                            },
                            {
                              "when": {
                                "$in": [
                                  {
                                    "$lower": {
                                      "$coalesce": [
                                        {
                                          "$ref": "response.data.status"
                                        },
                                        {
                                          "$ref": "response.data.data.status"
                                        },
                                        {
                                          "$ref": "response.status"
                                        }
                                      ]
                                    }
                                  },
                                  [
                                    "success",
                                    "succeeded",
                                    "completed"
                                  ]
                                ]
                              },
                              "then": {
                                "$if": {
                                  "condition": {
                                    "$coalesce": [
                                      {
                                        "$ref": "response.data.data.content.audio_urls"
                                      },
                                      {
                                        "$ref": "response.data.content.audio_urls"
                                      },
                                      {
                                        "$ref": "response.data.data.content.audio_url"
                                      },
                                      {
                                        "$ref": "response.data.content.audio_url"
                                      },
                                      {
                                        "$ref": "response.data.result_url"
                                      },
                                      {
                                        "$ref": "response.result_url"
                                      }
                                    ]
                                  },
                                  "then": "succeeded",
                                  "else": "failed"
                                }
                              }
                            },
                            {
                              "when": {
                                "$in": [
                                  {
                                    "$lower": {
                                      "$coalesce": [
                                        {
                                          "$ref": "response.data.status"
                                        },
                                        {
                                          "$ref": "response.data.data.status"
                                        },
                                        {
                                          "$ref": "response.status"
                                        }
                                      ]
                                    }
                                  },
                                  [
                                    "not_start",
                                    "submitted",
                                    "queued",
                                    "pending"
                                  ]
                                ]
                              },
                              "then": "pending"
                            },
                            {
                              "when": {
                                "$in": [
                                  {
                                    "$lower": {
                                      "$coalesce": [
                                        {
                                          "$ref": "response.data.status"
                                        },
                                        {
                                          "$ref": "response.data.data.status"
                                        },
                                        {
                                          "$ref": "response.status"
                                        }
                                      ]
                                    }
                                  },
                                  [
                                    "in_progress",
                                    "processing",
                                    "running"
                                  ]
                                ]
                              },
                              "then": "processing"
                            }
                          ],
                          "default": "failed"
                        }
                      },
                      "failed"
                    ]
                  },
                  "then": "Seedance 返回失败、未知状态或成功响应缺少音频结果。",
                  "else": null
                }
              }
            ]
          },
          "audios": {
            "$coalesce": [
              {
                "$ref": "response.data.data.content.audio_urls"
              },
              {
                "$ref": "response.data.content.audio_urls"
              },
              {
                "$ref": "response.data.data.content.audio_url"
              },
              {
                "$ref": "response.data.content.audio_url"
              },
              {
                "$ref": "response.data.result_url"
              },
              {
                "$ref": "response.result_url"
              }
            ]
          },
          "resultEphemeral": true
        },
        "validations": [
          {
            "assert": {
              "$eq": [
                {
                  "$ref": "request.model"
                },
                "doubao-seed-audio-1.0"
              ]
            },
            "message": "Seedance 音频仅确认支持 doubao-seed-audio-1.0。"
          },
          {
            "assert": {
              "$and": [
                {
                  "$gte": [
                    {
                      "$len": {
                        "$ref": "request.prompt"
                      }
                    },
                    5
                  ]
                },
                {
                  "$lte": [
                    {
                      "$len": {
                        "$ref": "request.prompt"
                      }
                    },
                    2048
                  ]
                },
                {
                  "$gt": [
                    {
                      "$len": {
                        "$trim": {
                          "$ref": "request.prompt"
                        }
                      }
                    },
                    0
                  ]
                }
              ]
            },
            "message": "prompt 必须为 5–2048 个字符且不能全为空白。"
          },
          {
            "assert": {
              "$eq": [
                {
                  "$len": {
                    "$ref": "request.videos"
                  }
                },
                0
              ]
            },
            "message": "Seedance 音频不支持视频参考。"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$ref": "request.audios"
                  }
                },
                3
              ]
            },
            "message": "参考音频最多 3 个，格式 MP3/WAV，每个不超过 10MB。"
          },
          {
            "assert": {
              "$not": {
                "$and": [
                  {
                    "$ref": "request.images"
                  },
                  {
                    "$ref": "request.audios"
                  }
                ]
              }
            },
            "message": "图片与参考音频不能同时使用。"
          },
          {
            "assert": {
              "$not": {
                "$and": [
                  {
                    "$if": {
                      "condition": {
                        "$in": [
                          {
                            "$lower": {
                              "$trim": {
                                "$ref": "request.extra.audioVoice"
                              }
                            }
                          },
                          [
                            "",
                            "alloy"
                          ]
                        ]
                      },
                      "then": null,
                      "else": {
                        "$trim": {
                          "$ref": "request.extra.audioVoice"
                        }
                      }
                    }
                  },
                  {
                    "$or": [
                      {
                        "$ref": "request.images"
                      },
                      {
                        "$ref": "request.audios"
                      }
                    ]
                  }
                ]
              }
            },
            "message": "speaker 与图片、参考音频互斥；请只选择一种参考方式。"
          },
          {
            "assert": {
              "$or": [
                {
                  "$eq": [
                    {
                      "$len": {
                        "$ref": "request.images"
                      }
                    },
                    0
                  ]
                },
                {
                  "$and": [
                    {
                      "$in": [
                        {
                          "$first": {
                            "$split": [
                              {
                                "$ref": "request.images.0.url"
                              },
                              "://"
                            ]
                          }
                        },
                        [
                          "http",
                          "https"
                        ]
                      ]
                    },
                    {
                      "$eq": [
                        {
                          "$len": {
                            "$split": [
                              {
                                "$ref": "request.images.0.url"
                              },
                              "://"
                            ]
                          }
                        },
                        2
                      ]
                    },
                    {
                      "$gt": [
                        {
                          "$len": {
                            "$at": [
                              {
                                "$split": [
                                  {
                                    "$ref": "request.images.0.url"
                                  },
                                  "://"
                                ]
                              },
                              1
                            ]
                          }
                        },
                        0
                      ]
                    }
                  ]
                }
              ]
            },
            "message": "第一张图片必须是可公开访问的 HTTP(S) URL，不接受 data URL。"
          },
          {
            "assert": {
              "$eq": [
                {
                  "$len": {
                    "$filter": {
                      "from": {
                        "$ref": "request.audios"
                      },
                      "as": "aud",
                      "where": {
                        "$not": {
                          "$and": [
                            {
                              "$in": [
                                {
                                  "$first": {
                                    "$split": [
                                      {
                                        "$ref": "aud.url"
                                      },
                                      "://"
                                    ]
                                  }
                                },
                                [
                                  "http",
                                  "https"
                                ]
                              ]
                            },
                            {
                              "$eq": [
                                {
                                  "$len": {
                                    "$split": [
                                      {
                                        "$ref": "aud.url"
                                      },
                                      "://"
                                    ]
                                  }
                                },
                                2
                              ]
                            },
                            {
                              "$gt": [
                                {
                                  "$len": {
                                    "$at": [
                                      {
                                        "$split": [
                                          {
                                            "$ref": "aud.url"
                                          },
                                          "://"
                                        ]
                                      },
                                      1
                                    ]
                                  }
                                },
                                0
                              ]
                            }
                          ]
                        }
                      }
                    }
                  }
                },
                0
              ]
            },
            "message": "参考音频必须是可公开访问的 HTTP(S) URL，不接受 data URL。"
          },
          {
            "assert": {
              "$eq": [
                {
                  "$len": {
                    "$filter": {
                      "from": {
                        "$ref": "request.audios"
                      },
                      "as": "aud",
                      "where": {
                        "$not": {
                          "$in": [
                            {
                              "$lower": {
                                "$ref": "aud.mimeType"
                              }
                            },
                            [
                              "",
                              "audio/mpeg",
                              "audio/mp3",
                              "audio/wav",
                              "audio/x-wav",
                              "audio/wave"
                            ]
                          ]
                        }
                      }
                    }
                  }
                },
                0
              ]
            },
            "message": "参考音频仅支持 MP3/WAV；远程文件格式和 10MB 限制由上游校验。"
          },
          {
            "assert": {
              "$in": [
                {
                  "$coalesce": [
                    {
                      "$ref": "request.extra.audioFormat"
                    },
                    "wav"
                  ]
                },
                [
                  "wav",
                  "mp3",
                  "pcm",
                  "ogg_opus"
                ]
              ]
            },
            "message": "format 仅支持 wav、mp3、pcm、ogg_opus。"
          },
          {
            "assert": {
              "$in": [
                {
                  "$toString": {
                    "$coalesce": [
                      {
                        "$ref": "request.providerOptions.seedance-audio.sample_rate"
                      },
                      "24000"
                    ]
                  }
                },
                [
                  "8000",
                  "16000",
                  "24000",
                  "32000",
                  "44100"
                ]
              ]
            },
            "message": "sample_rate 仅支持 8000/16000/24000/32000/44100。"
          },
          {
            "assert": {
              "$or": [
                {
                  "$not": {
                    "$eq": [
                      {
                        "$coalesce": [
                          {
                            "$ref": "request.providerOptions.seedance-audio.speech_rate"
                          }
                        ]
                      },
                      null
                    ]
                  }
                },
                {
                  "$eq": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.extra.audioSpeed"
                        }
                      ]
                    },
                    null
                  ]
                },
                {
                  "$and": [
                    {
                      "$gte": [
                        {
                          "$toFloat": {
                            "$coalesce": [
                              {
                                "$ref": "request.extra.audioSpeed"
                              },
                              1
                            ]
                          }
                        },
                        0.25
                      ]
                    },
                    {
                      "$lte": [
                        {
                          "$toFloat": {
                            "$coalesce": [
                              {
                                "$ref": "request.extra.audioSpeed"
                              },
                              1
                            ]
                          }
                        },
                        4
                      ]
                    }
                  ]
                }
              ]
            },
            "message": "audioSpeed 必须是 0.25–4 的有效倍速。"
          },
          {
            "assert": {
              "$or": [
                {
                  "$eq": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.seedance-audio.speech_rate"
                        }
                      ]
                    },
                    null
                  ]
                },
                {
                  "$and": [
                    {
                      "$ne": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.speech_rate"
                          }
                        },
                        null
                      ]
                    },
                    {
                      "$gte": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.speech_rate"
                          }
                        },
                        -50
                      ]
                    },
                    {
                      "$lte": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.speech_rate"
                          }
                        },
                        100
                      ]
                    },
                    {
                      "$eq": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.speech_rate"
                          }
                        },
                        {
                          "$toInt": {
                            "$ref": "request.providerOptions.seedance-audio.speech_rate"
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "message": "speech_rate 必须是 -50–100 范围内的整数。"
          },
          {
            "assert": {
              "$or": [
                {
                  "$eq": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.seedance-audio.loudness_rate"
                        }
                      ]
                    },
                    null
                  ]
                },
                {
                  "$and": [
                    {
                      "$ne": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.loudness_rate"
                          }
                        },
                        null
                      ]
                    },
                    {
                      "$gte": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.loudness_rate"
                          }
                        },
                        -50
                      ]
                    },
                    {
                      "$lte": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.loudness_rate"
                          }
                        },
                        100
                      ]
                    },
                    {
                      "$eq": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.loudness_rate"
                          }
                        },
                        {
                          "$toInt": {
                            "$ref": "request.providerOptions.seedance-audio.loudness_rate"
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "message": "loudness_rate 必须是 -50–100 范围内的整数。"
          },
          {
            "assert": {
              "$or": [
                {
                  "$eq": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.seedance-audio.pitch_rate"
                        }
                      ]
                    },
                    null
                  ]
                },
                {
                  "$and": [
                    {
                      "$ne": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.pitch_rate"
                          }
                        },
                        null
                      ]
                    },
                    {
                      "$gte": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.pitch_rate"
                          }
                        },
                        -12
                      ]
                    },
                    {
                      "$lte": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.pitch_rate"
                          }
                        },
                        12
                      ]
                    },
                    {
                      "$eq": [
                        {
                          "$toFloat": {
                            "$ref": "request.providerOptions.seedance-audio.pitch_rate"
                          }
                        },
                        {
                          "$toInt": {
                            "$ref": "request.providerOptions.seedance-audio.pitch_rate"
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "message": "pitch_rate 必须是 -12–12 范围内的整数。"
          }
        ]
      }
    ]
  },
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>"
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
