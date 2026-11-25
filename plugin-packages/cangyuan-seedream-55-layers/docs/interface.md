# Seedream 5.5 图层拆分接口

## 身份与鉴权

- 插件与 Provider ID：`cangyuan-seedream-55-layers`。
- 模型：`doubao-seedream-5-5-261028`。
- 默认 Base URL：`https://direct-api.cangyuansuanli.cn`。
- 鉴权：`Authorization: Bearer <apiKey>`。
- 创建：`POST /v1/images/generations`。
- 同步结果直接从创建响应提取；请求 `async: true` 时由宿主通过 `GET /v1/images/generations/{id}` 轮询。

## 字段映射

| 上游字段 | 默认或限制 |
| --- | --- |
| `model` | `doubao-seedream-5-5-261028` |
| `prompt` | 必填 |
| `images` | 可选，最多 10 张；拆层时恰好 1 张 |
| `n` | 固定为 1；拆层返回底图和多个图层 |
| `size` | 普通生成默认 `2K`，支持 `1K`、`1.5K`、`2K` 或宽x高尺寸；拆层默认 `auto`，只支持 `1K`、`1.5K`、`2K`、`auto` |
| `background` | 默认 `auto`；支持 `transparent`、`opaque`；透明背景要求 PNG，且不能拆层 |
| `output_format` | 默认 `png`，支持 `png` / `jpeg`；拆层时只控制底图格式，层固定 PNG |
| `layer_decomposition` | 默认 `false` |
| `layer_decomposition_options.max_images` | 2–100，默认 30，含底图 |
| `layer_decomposition_options.text_recognition` | 默认 `false` |
| `optimize_prompt_options.mode` | 固定 `standard` |
| `response_format` | `url` 或 `b64_json`，默认 `url` |
| `watermark` | 仅在明确设置时发送 |
| `safety_identifier` | 可选，最长 64 字符 |
| `async` | 可选，默认 `false` |

## 结果与通用图层处理

`response.data` 整体映射到统一图片结果，`response.usage` 映射为用量。不会重排或裁剪 `data[]`：底图是首项，图层跟随其后。`url`、`size`、`output_format`、`z_index`、`bounding_box`、`name`、`description`、`text_recognition` 和 `background` 均保留为每张图片的上游字段/元数据。

拆层图的宽高和透明画布可能不同于底图，因此宿主的通用图层组画布合成规则不适用于自动把这些输出拼成一张同尺寸合成图；应以普通多图结果展示各层，同时保留 z-index 和 bounding box 供上层工具定位。当前插件只负责忠实返回并持久化结果，不引入协议私有 UI。

API 请求失败或任意图层失败时，按上游整单失败语义处理，不把部分层伪装为成功结果。

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "cangyuan-seedream-55-layers",
  "name": "Seedream 5.5 图层拆分",
  "version": "1.0.0",
  "author": "影策",
  "description": "独立的 Seedream 5.5 图片生成协议，支持透明背景、图层拆分与文字识别。",
  "enabled": false,
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
        "id": "cangyuan-seedream-55-layers",
        "label": "Seedream 5.5 图层拆分",
        "capabilities": [
          "image"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation",
          "agent"
        ],
        "baseUrl": "https://direct-api.cangyuansuanli.cn",
        "requiresPublicMediaUrls": true,
        "auth": {
          "type": "bearer",
          "field": "apiKey"
        },
        "imageParameters": [
          {
            "name": "imageCount",
            "label": "生成数量",
            "type": "integer",
            "binding": "imageCount",
            "min": 1,
            "max": 1,
            "step": 1,
            "default": 1
          },
          {
            "name": "imageResolution",
            "label": "分辨率",
            "type": "string",
            "binding": "resolution",
            "values": [
              "1K",
              "1.5K",
              "2K"
            ],
            "default": "2K",
            "pricing": true
          },
          {
            "name": "layerDecomposition",
            "label": "图层拆分",
            "type": "boolean",
            "binding": "providerOptions.cangyuan-seedream-55-layers.layer_decomposition",
            "default": false,
            "pricing": true
          },
          {
            "name": "maxImages",
            "label": "最多输出张数（含底图）",
            "type": "integer",
            "binding": "providerOptions.cangyuan-seedream-55-layers.max_images",
            "min": 2,
            "max": 100,
            "step": 1,
            "default": 30
          },
          {
            "name": "textRecognition",
            "label": "识别规整文字图层",
            "type": "boolean",
            "binding": "providerOptions.cangyuan-seedream-55-layers.text_recognition",
            "default": false
          },
          {
            "name": "outputFormat",
            "label": "输出格式",
            "type": "string",
            "binding": "providerOptions.cangyuan-seedream-55-layers.output_format",
            "values": [
              "png",
              "jpeg"
            ],
            "default": "png"
          },
          {
            "name": "background",
            "label": "背景",
            "type": "string",
            "binding": "providerOptions.cangyuan-seedream-55-layers.background",
            "values": [
              "auto",
              "transparent",
              "opaque"
            ],
            "default": "auto"
          },
          {
            "name": "layerSize",
            "label": "拆层尺寸",
            "type": "string",
            "binding": "providerOptions.cangyuan-seedream-55-layers.layer_size",
            "values": [
              "auto",
              "1K",
              "1.5K",
              "2K"
            ],
            "default": "auto"
          },
          {
            "name": "responseFormat",
            "label": "响应格式",
            "type": "string",
            "binding": "providerOptions.cangyuan-seedream-55-layers.response_format",
            "values": [
              "url",
              "b64_json"
            ],
            "default": "url"
          },
          {
            "name": "async",
            "label": "异步响应",
            "type": "boolean",
            "binding": "providerOptions.cangyuan-seedream-55-layers.async",
            "default": false
          }
        ],
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "model",
            "description": "固定模型 ID：doubao-seedream-5-5-261028。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "图片生成提示词。"
          },
          {
            "name": "images",
            "type": "media[]",
            "required": false,
            "mapping": "images",
            "description": "最多 10 张参考图；图层拆分时必须且只能 1 张。"
          },
          {
            "name": "imageCount",
            "type": "integer",
            "required": false,
            "mapping": "n=1",
            "description": "固定每次生成一张；图层拆分例外，按图层数量返回多张。"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "required": false,
            "mapping": "size",
            "description": "普通生成可为 1K、1.5K、2K 或宽x高尺寸；拆层使用 layer_size。"
          },
          {
            "name": "resolution",
            "type": "string",
            "required": false,
            "mapping": "size",
            "description": "分辨率档位 1K、1.5K、2K。"
          },
          {
            "name": "providerOptions",
            "type": "object",
            "required": false,
            "mapping": "providerOptions.cangyuan-seedream-55-layers",
            "description": "透明背景、拆层、输出格式、响应格式和协议扩展项。"
          }
        ],
        "validations": [
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$ref": "request.images"
                  }
                },
                10
              ]
            },
            "message": "参考图最多 10 张"
          },
          {
            "assert": {
              "$or": [
                {
                  "$ne": [
                    {
                      "$ref": "request.providerOptions.cangyuan-seedream-55-layers.layer_decomposition"
                    },
                    true
                  ]
                },
                {
                  "$eq": [
                    {
                      "$len": {
                        "$ref": "request.images"
                      }
                    },
                    1
                  ]
                }
              ]
            },
            "message": "图层拆分必须且只能提供 1 张参考图"
          },
          {
            "assert": {
              "$or": [
                {
                  "$ne": [
                    {
                      "$ref": "request.providerOptions.cangyuan-seedream-55-layers.layer_decomposition"
                    },
                    true
                  ]
                },
                {
                  "$ne": [
                    {
                      "$ref": "request.providerOptions.cangyuan-seedream-55-layers.background"
                    },
                    "transparent"
                  ]
                }
              ]
            },
            "message": "透明背景不能与图层拆分同时使用"
          },
          {
            "assert": {
              "$or": [
                {
                  "$ne": [
                    {
                      "$ref": "request.providerOptions.cangyuan-seedream-55-layers.background"
                    },
                    "transparent"
                  ]
                },
                {
                  "$eq": [
                    {
                      "$ref": "request.providerOptions.cangyuan-seedream-55-layers.output_format"
                    },
                    "png"
                  ]
                }
              ]
            },
            "message": "透明背景必须使用 PNG"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/v1/images/generations",
          "contentType": "application/json",
          "body": {
            "model": {
              "$ref": "request.model"
            },
            "prompt": {
              "$ref": "request.prompt"
            },
            "n": 1,
            "images": {
              "$omitEmpty": {
                "$map": {
                  "from": {
                    "$ref": "request.images"
                  },
                  "as": "image",
                  "in": {
                    "$ref": "image.value"
                  }
                }
              }
            },
            "size": {
              "$if": {
                "condition": {
                  "$eq": [
                    {
                      "$ref": "request.providerOptions.cangyuan-seedream-55-layers.layer_decomposition"
                    },
                    true
                  ]
                },
                "then": {
                  "$coalesce": [
                    {
                      "$ref": "request.providerOptions.cangyuan-seedream-55-layers.layer_size"
                    },
                    "auto"
                  ]
                },
                "else": {
                  "$switch": {
                    "cases": [
                      {
                        "when": {
                          "$eq": [
                            {
                              "$ref": "request.aspectRatio"
                            },
                            "auto"
                          ]
                        },
                        "then": "2K"
                      },
                      {
                        "when": {
                          "$eq": [
                            {
                              "$ref": "request.aspectRatio"
                            },
                            "1:1"
                          ]
                        },
                        "then": "2048x2048"
                      },
                      {
                        "when": {
                          "$eq": [
                            {
                              "$ref": "request.aspectRatio"
                            },
                            "4:3"
                          ]
                        },
                        "then": "2304x1728"
                      },
                      {
                        "when": {
                          "$eq": [
                            {
                              "$ref": "request.aspectRatio"
                            },
                            "3:4"
                          ]
                        },
                        "then": "1728x2304"
                      },
                      {
                        "when": {
                          "$eq": [
                            {
                              "$ref": "request.aspectRatio"
                            },
                            "16:9"
                          ]
                        },
                        "then": "2560x1440"
                      },
                      {
                        "when": {
                          "$eq": [
                            {
                              "$ref": "request.aspectRatio"
                            },
                            "9:16"
                          ]
                        },
                        "then": "1440x2560"
                      },
                      {
                        "when": {
                          "$eq": [
                            {
                              "$ref": "request.aspectRatio"
                            },
                            "3:2"
                          ]
                        },
                        "then": "2496x1664"
                      },
                      {
                        "when": {
                          "$eq": [
                            {
                              "$ref": "request.aspectRatio"
                            },
                            "2:3"
                          ]
                        },
                        "then": "1664x2496"
                      },
                      {
                        "when": {
                          "$eq": [
                            {
                              "$ref": "request.aspectRatio"
                            },
                            "21:9"
                          ]
                        },
                        "then": "3024x1296"
                      }
                    ],
                    "default": {
                      "$coalesce": [
                        {
                          "$ref": "request.aspectRatio"
                        },
                        {
                          "$ref": "request.resolution"
                        },
                        "2K"
                      ]
                    }
                  }
                }
              }
            },
            "background": {
              "$if": {
                "condition": {
                  "$eq": [
                    {
                      "$ref": "request.providerOptions.cangyuan-seedream-55-layers.layer_decomposition"
                    },
                    true
                  ]
                },
                "then": null,
                "else": {
                  "$coalesce": [
                    {
                      "$ref": "request.providerOptions.cangyuan-seedream-55-layers.background"
                    },
                    "auto"
                  ]
                }
              }
            },
            "output_format": {
              "$coalesce": [
                {
                  "$ref": "request.providerOptions.cangyuan-seedream-55-layers.output_format"
                },
                "png"
              ]
            },
            "layer_decomposition": {
              "$coalesce": [
                {
                  "$ref": "request.providerOptions.cangyuan-seedream-55-layers.layer_decomposition"
                },
                false
              ]
            },
            "layer_decomposition_options": {
              "$if": {
                "condition": {
                  "$eq": [
                    {
                      "$ref": "request.providerOptions.cangyuan-seedream-55-layers.layer_decomposition"
                    },
                    true
                  ]
                },
                "then": {
                  "max_images": {
                    "$coalesce": [
                      {
                        "$ref": "request.providerOptions.cangyuan-seedream-55-layers.max_images"
                      },
                      30
                    ]
                  },
                  "text_recognition": {
                    "$coalesce": [
                      {
                        "$ref": "request.providerOptions.cangyuan-seedream-55-layers.text_recognition"
                      },
                      false
                    ]
                  }
                },
                "else": null
              }
            },
            "optimize_prompt_options": {
              "mode": "standard"
            },
            "response_format": {
              "$coalesce": [
                {
                  "$ref": "request.providerOptions.cangyuan-seedream-55-layers.response_format"
                },
                "url"
              ]
            },
            "watermark": {
              "$omitEmpty": {
                "$ref": "request.providerOptions.cangyuan-seedream-55-layers.watermark"
              }
            },
            "safety_identifier": {
              "$omitEmpty": {
                "$ref": "request.providerOptions.cangyuan-seedream-55-layers.safety_identifier"
              }
            },
            "async": {
              "$coalesce": [
                {
                  "$ref": "request.providerOptions.cangyuan-seedream-55-layers.async"
                },
                false
              ]
            }
          }
        },
        "poll": {
          "method": "GET",
          "path": "/v1/images/generations/{{taskId}}"
        },
        "response": {
          "taskId": {
            "$ref": "response.id"
          },
          "status": {
            "$coalesce": [
              {
                "$ref": "response.status"
              },
              "succeeded"
            ]
          },
          "images": {
            "$ref": "response.data"
          },
          "usage": {
            "$ref": "response.usage"
          },
          "errorPaths": [
            "error",
            "error.code"
          ],
          "messagePaths": [
            "error.message"
          ]
        }
      }
    ]
  },
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>"
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
