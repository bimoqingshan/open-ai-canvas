# 米粒 BD Seedance2.5 接口

## 配置

- 插件 ID / Provider ID：`mili-bd-seedance25`。
- 能力：`video`；认证配置字段：`apiKey`。
- 服务地址固定为 `https://miliapi.com`，请求路径包含 `/v1`。
- 请求使用 `Authorization: Bearer <API_KEY>`。密钥由宿主注入，不进入插件包、URL、请求 JSON 或日志。
- 请求使用宿主为每笔创建任务生成的 `Idempotency-Key`。声明式运行时会在有限的网络、429 和临时 5xx 情况下复用同一键重试。

## 创建

`POST /v1/videos`，`Content-Type: application/json`。

```json
{
  "model": "bd-seedance2.5",
  "prompt": "镜头缓缓推进，晨光照在湖边的木船上。",
  "seconds": 5,
  "ratio": "16:9",
  "resolution": "720p",
  "images": [{"name": "reference.png", "url": "https://example.com/reference.png"}],
  "videos": [{"name": "source.mp4", "url": "https://example.com/source.mp4"}],
  "audios": [{"name": "music.mp3", "url": "https://example.com/music.mp3"}]
}
```

统一请求参数映射如下：

| 统一参数 | 米粒字段 | 规则 |
| --- | --- | --- |
| `model` | `model` | 可选，不限制模型名称并原样传给上游；未指定时默认为 `bd-seedance2.5`。上游是否支持该名称由米粒接口决定。 |
| `prompt` | `prompt` | 必填，1-45000 个字符；可用 `@图片1`、`@视频1`、`@音频1` 引用同类素材。 |
| `duration` | `seconds` | 未指定时为 30；纯文字或不超过 9 张图片时 4-30 秒，含音视频或超过 9 张图片时 5-30 秒。 |
| `aspectRatio` | `ratio` | `auto`、`16:9`、`9:16`、`1:1`、`4:3`、`3:4`、`21:9`；默认 `auto`。 |
| `resolution` | `resolution` | 仅支持 `720p`，未指定时使用 `720p`。 |
| `images` | `images` | 最多 30 项。每项可为 `url` 或 Base64 `data`，也可带 `name`。 |
| `videos` | `videos` | 最多 10 项；总素材最多 30 项。 |
| `audios` | `audios` | 最多 10 项；总素材最多 30 项。 |

Base64 会从宿主的 data URL 中提取正文后写入 `data`。无扩展名 URL 或 Base64 应提供真实后缀的 `name`，例如 `reference.png`。米粒支持公开 HTTP(S) 直链和 Base64；不要把内部素材 ID 当作 URL。

若素材的 `metadata.seconds` 已存在，插件会映射到 `videos[].seconds` / `audios[].seconds`；否则尝试将 `metadata.durationMs` 除以 1000。两者均缺失时省略该字段，不推测素材时长。米粒仍会校验音视频格式和时长。

## 轮询和下载

- 创建响应保存 `id`、`task_id` 或 `taskId`。
- 查询：`GET /v1/videos/{id}`。
- `queued`、`in_progress` 继续轮询；`completed` 进入结果下载；`failed` 停止并展示 `error.message`。
- 结果：`GET /v1/videos/{id}/content?download=1`，携带 `Accept: video/mp4`。宿主负责跟随安全的 HTTPS 跳转并保存 MP4。
- 查询响应中的 `url`、`video_url` 或常见 `data.url` 仅作为临时结果引用，标记为 ephemeral；下载完成后不把签名地址作为永久资源地址。

## 幂等和恢复边界

米粒文档要求创建连接中断后使用原 `Idempotency-Key` 查询 `GET /v1/video-receipts`，再决定是否重放原请求。当前声明式插件运行时能复用同一幂等键进行有限创建重试，但不能表达“先调用 receipts，再决定是否重试”的跨 endpoint 分支。因此本插件没有伪造声明该回查能力；要完整实现它，需要扩展宿主运行时或增加 host-backed adapter。

插件不调用真实收费接口。开发和测试应使用模拟 HTTP 响应，不记录 API Key、完整签名 URL 或 Base64 正文。

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "mili-bd-seedance25",
  "name": "米粒 BD Seedance2.5",
  "version": "2.0.0",
  "author": "影策",
  "description": "米粒 bd-seedance2.5 视频生成插件，支持文字和多模态参考素材。",
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
        "id": "mili-bd-seedance25",
        "label": "米粒 BD Seedance2.5",
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
        "baseUrl": "https://miliapi.com",
        "idempotentCreate": true,
        "auth": {
          "type": "bearer",
          "field": "apiKey"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": false,
            "mapping": "model",
            "description": "可选模型名；按填写值原样发送给上游，不限制可用名称；未填写时默认 bd-seedance2.5。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "1-45000 字符的视频描述，可用 @图片1、@视频1、@音频1 引用同类素材。"
          },
          {
            "name": "duration",
            "type": "integer",
            "mapping": "seconds",
            "description": "输出秒数；纯文字或不超过 9 张图片时 4-30 秒，含音视频或超过 9 张图片时 5-30 秒。"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "mapping": "ratio",
            "values": [
              "auto",
              "16:9",
              "9:16",
              "1:1",
              "4:3",
              "3:4",
              "21:9"
            ],
            "description": "画幅比例，默认 auto。"
          },
          {
            "name": "resolution",
            "type": "string",
            "mapping": "resolution",
            "values": [
              "720p"
            ],
            "description": "固定为 720p。"
          },
          {
            "name": "images",
            "type": "media[]",
            "mapping": "images",
            "description": "最多 30 张图片参考素材。"
          },
          {
            "name": "videos",
            "type": "media[]",
            "mapping": "videos",
            "description": "最多 10 段视频参考素材。"
          },
          {
            "name": "audios",
            "type": "media[]",
            "mapping": "audios",
            "description": "最多 10 段音频参考素材。"
          }
        ],
        "validations": [
          {
            "assert": {
              "$and": [
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
                },
                {
                  "$lte": [
                    {
                      "$len": {
                        "$ref": "request.prompt"
                      }
                    },
                    45000
                  ]
                }
              ]
            },
            "message": "米粒提示词应为 1-45000 个字符"
          },
          {
            "assert": {
              "$or": [
                {
                  "$eq": [
                    {
                      "$ref": "request.duration"
                    },
                    0
                  ]
                },
                {
                  "$and": [
                    {
                      "$gte": [
                        {
                          "$ref": "request.duration"
                        },
                        4
                      ]
                    },
                    {
                      "$lte": [
                        {
                          "$ref": "request.duration"
                        },
                        30
                      ]
                    }
                  ]
                }
              ]
            },
            "message": "米粒纯文字或少量图片时长应为 4-30 秒"
          },
          {
            "assert": {
              "$or": [
                {
                  "$and": [
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
                    },
                    {
                      "$lte": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        9
                      ]
                    }
                  ]
                },
                {
                  "$or": [
                    {
                      "$eq": [
                        {
                          "$ref": "request.duration"
                        },
                        0
                      ]
                    },
                    {
                      "$and": [
                        {
                          "$gte": [
                            {
                              "$ref": "request.duration"
                            },
                            5
                          ]
                        },
                        {
                          "$lte": [
                            {
                              "$ref": "request.duration"
                            },
                            30
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "message": "含音视频或超过 9 张图片时，米粒时长应为 5-30 秒"
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
            "message": "米粒最多接收 30 张图片"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$ref": "request.videos"
                  }
                },
                10
              ]
            },
            "message": "米粒最多接收 10 段视频"
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
            "message": "米粒最多接收 10 段音频"
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
                30
              ]
            },
            "message": "米粒混合参考素材总数不能超过 30 个"
          },
          {
            "assert": {
              "$in": [
                {
                  "$lower": {
                    "$trim": {
                      "$coalesce": [
                        {
                          "$ref": "request.resolution"
                        },
                        "720p"
                      ]
                    }
                  }
                },
                [
                  "720p"
                ]
              ]
            },
            "message": "米粒仅支持 720p"
          },
          {
            "assert": {
              "$in": [
                {
                  "$lower": {
                    "$trim": {
                      "$coalesce": [
                        {
                          "$ref": "request.aspectRatio"
                        },
                        "auto"
                      ]
                    }
                  }
                },
                [
                  "auto",
                  "16:9",
                  "9:16",
                  "1:1",
                  "4:3",
                  "3:4",
                  "21:9"
                ]
              ]
            },
            "message": "米粒画幅仅支持 auto、16:9、9:16、1:1、4:3、3:4 或 21:9"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/v1/videos",
          "contentType": "application/json",
          "headers": {
            "Idempotency-Key": {
              "$ref": "request.extra.idempotencyKey"
            }
          },
          "body": {
            "model": {
              "$coalesce": [
                {
                  "$ref": "request.model"
                },
                "bd-seedance2.5"
              ]
            },
            "prompt": {
              "$ref": "request.prompt"
            },
            "seconds": {
              "$if": {
                "condition": {
                  "$eq": [
                    {
                      "$ref": "request.duration"
                    },
                    0
                  ]
                },
                "then": 30,
                "else": {
                  "$ref": "request.duration"
                }
              }
            },
            "ratio": {
              "$coalesce": [
                {
                  "$lower": {
                    "$trim": {
                      "$ref": "request.aspectRatio"
                    }
                  }
                },
                "auto"
              ]
            },
            "resolution": "720p",
            "images": {
              "$omitEmpty": {
                "$map": {
                  "from": {
                    "$ref": "request.images"
                  },
                  "as": "media",
                  "in": {
                    "$omitEmpty": {
                      "name": {
                        "$omitEmpty": {
                          "$ref": "media.name"
                        }
                      },
                      "url": {
                        "$omitEmpty": {
                          "$ref": "media.url"
                        }
                      },
                      "data": {
                        "$omitEmpty": {
                          "$dataPayload": {
                            "$ref": "media.dataUrl"
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "videos": {
              "$omitEmpty": {
                "$map": {
                  "from": {
                    "$ref": "request.videos"
                  },
                  "as": "media",
                  "in": {
                    "$omitEmpty": {
                      "name": {
                        "$omitEmpty": {
                          "$ref": "media.name"
                        }
                      },
                      "url": {
                        "$omitEmpty": {
                          "$ref": "media.url"
                        }
                      },
                      "data": {
                        "$omitEmpty": {
                          "$dataPayload": {
                            "$ref": "media.dataUrl"
                          }
                        }
                      },
                      "seconds": {
                        "$omitEmpty": {
                          "$toFloat": {
                            "$coalesce": [
                              {
                                "$ref": "media.metadata.seconds"
                              },
                              {
                                "$divide": [
                                  {
                                    "$ref": "media.metadata.durationMs"
                                  },
                                  1000
                                ]
                              }
                            ]
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "audios": {
              "$omitEmpty": {
                "$map": {
                  "from": {
                    "$ref": "request.audios"
                  },
                  "as": "media",
                  "in": {
                    "$omitEmpty": {
                      "name": {
                        "$omitEmpty": {
                          "$ref": "media.name"
                        }
                      },
                      "url": {
                        "$omitEmpty": {
                          "$ref": "media.url"
                        }
                      },
                      "data": {
                        "$omitEmpty": {
                          "$dataPayload": {
                            "$ref": "media.dataUrl"
                          }
                        }
                      },
                      "seconds": {
                        "$omitEmpty": {
                          "$toFloat": {
                            "$coalesce": [
                              {
                                "$ref": "media.metadata.seconds"
                              },
                              {
                                "$divide": [
                                  {
                                    "$ref": "media.metadata.durationMs"
                                  },
                                  1000
                                ]
                              }
                            ]
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "poll": {
          "method": "GET",
          "path": "/v1/videos/{{taskId}}"
        },
        "result": {
          "method": "GET",
          "path": "/v1/videos/{{taskId}}/content",
          "query": {
            "download": [
              "1"
            ]
          },
          "headers": {
            "Accept": "video/mp4"
          }
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
                "$ref": "response.taskId"
              },
              {
                "$ref": "taskId"
              }
            ]
          },
          "status": {
            "$ref": "response.status"
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
                "$ref": "response.error.reason"
              }
            ]
          },
          "resultUrlPaths": [
            "url",
            "video_url",
            "data.url",
            "data.video_url"
          ],
          "resultKind": "video",
          "resultEphemeral": true,
          "usage": {
            "$ref": "response.usage"
          },
          "errorPaths": [
            "error.message",
            "error.reason"
          ]
        }
      }
    ]
  },
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>"
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
