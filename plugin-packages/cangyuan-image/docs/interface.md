# 沧元内置协议：用户提供的 no-auto 版本

内置包以 `cangyuan-image-v3-no-auto.yingce-plugin` 为基础，补充完整接口文档并按参考图请求路由到编辑端点。当前包版本为 1.0.2，其余参数、权限和配置保持原样。

- 插件 ID：`cangyuan-image`；包内版本：`1.0.2`（文件名 v3 不代表清单版本）。
- Provider ID：`cangyuan-image`，替代旧的 `cangyuan-image-generation` 与 `cangyuan-image-edits`。
- 原包 SHA-256：`65cbc56f0f610022a4ac436e82ed7af528425a8b3bee097d831956cfea2f3e97`。
- 创建：无参考图时 `POST /v1/images/generations`，带参考图时 `POST /v1/images/edits`；固定 `async: true`，参考图映射为 `images` URL 数组。
- 轮询：按创建阶段使用 `GET /v1/images/generations/{taskId}` 或 `GET /v1/images/edits/{taskId}`；响应提取 `id` / `task_id`、`status`、`data[].url` / `data[].b64_json`。
- 比例无 auto 选项，默认 `1:1`；分辨率提供 `1k` / `2k` / `4k`，默认 `1k`；数量固定为 1。
- `apiKey` 使用 Bearer 鉴权；包内 baseUrl 是 example.com 占位地址，实际渠道必须配置真实上游地址。
- 参考图是否进入编辑路由由 `request.images` 是否非空判定；原 README 提及蒙版，但当前清单未映射 `mask`，也没有 agent scope。

## 文档补充与原包保留

原包只包含 `manifest.json` 和 `README.md`，没有内嵌 documentation 或 `docs/interface.md`。原始 ZIP 保存在 `backend/internal/app/testdata/cangyuan-image-original/`，仅作为回归样本，不进入官方插件目录。

发布包通过仓库现有 `embed-documentation.mjs cangyuan-image` 生成 `documentation` 和本文件的完整清单合同，再仅打包此插件。发布包哈希因此变化，原 README 字节保持不变，以本文件及完整清单澄清其接口范围。回归测试固定原件哈希，并逐字段比较去除顶层 `documentation` 后的清单，确保没有修改运行协议；同时验证发布包与源文件一致。官方完整文档测试保持不变。

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "cangyuan-image",
  "name": "沧源图片生成",
  "version": "1.0.2",
  "author": "沧源 / 影策",
  "description": "沧源图片生成异步协议插件，支持文生图、参考图编辑和蒙版功能。",
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
        "id": "cangyuan-image",
        "label": "沧源图片",
        "capabilities": [
          "image"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation"
        ],
        "baseUrl": "https://api.cangyuan.example.com",
        "requiresPublicMediaUrls": true,
        "auth": {
          "type": "bearer",
          "field": "apiKey"
        },
        "imageParameters": [
          {
            "name": "size",
            "label": "画幅比例",
            "type": "string",
            "binding": "aspectRatio",
            "encoding": "ratio",
            "values": [
              "1:1",
              "3:2",
              "2:3",
              "4:3",
              "3:4",
              "16:9",
              "21:9",
              "9:16"
            ],
            "default": "1:1"
          },
          {
            "name": "imageResolution",
            "label": "分辨率档位",
            "type": "string",
            "binding": "resolution",
            "values": [
              "1k",
              "2k",
              "4k"
            ],
            "default": "1k",
            "pricing": true
          },
          {
            "name": "quality",
            "label": "质量",
            "type": "string",
            "binding": "quality",
            "values": [
              "medium",
              "low",
              "high",
              "xhigh",
              "max"
            ]
          },
          {
            "name": "count",
            "label": "生成数量",
            "type": "integer",
            "binding": "imageCount",
            "min": 1,
            "max": 1,
            "step": 1,
            "default": 1
          }
        ],
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "model",
            "description": "图片模型 ID"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "图片提示词"
          },
          {
            "name": "images",
            "type": "media[]",
            "required": false,
            "mapping": "provider image/reference fields",
            "description": "参考图或编辑源图"
          },
          {
            "name": "imageCount",
            "type": "integer",
            "required": false,
            "mapping": "n/sample_count",
            "description": "输出数量"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "required": false,
            "mapping": "size/aspect_ratio",
            "description": "比例或尺寸"
          },
          {
            "name": "resolution",
            "type": "string",
            "required": false,
            "mapping": "resolution/tier",
            "description": "分辨率档位：web / 1k / 2k / 4k"
          },
          {
            "name": "quality",
            "type": "string",
            "required": false,
            "mapping": "quality",
            "description": "质量档位"
          },
          {
            "name": "providerOptions",
            "type": "object",
            "required": false,
            "mapping": "provider-specific fields",
            "description": "厂商扩展字段"
          }
        ],
        "create": {
          "method": "POST",
          "pathTemplate": {
            "$if": {
              "condition": {
                "$gt": [
                  {
                    "$len": {
                      "$ref": "request.images"
                    }
                  },
                  0
                ]
              },
              "then": "/v1/images/edits",
              "else": "/v1/images/generations"
            }
          },
          "contentType": "application/json",
          "body": {
            "model": {
              "$ref": "request.model"
            },
            "prompt": {
              "$ref": "request.prompt"
            },
            "async": true,
            "n": {
              "$omitEmpty": {
                "$ref": "request.imageCount"
              }
            },
            "size": {
              "$omitEmpty": {
                "$ref": "request.aspectRatio"
              }
            },
            "tier": {
              "$omitEmpty": {
                "$ref": "request.resolution"
              }
            },
            "quality": {
              "$omitEmpty": {
                "$ref": "request.quality"
              }
            },
            "images": {
              "$omitEmpty": {
                "$map": {
                  "from": {
                    "$ref": "request.images"
                  },
                  "as": "img",
                  "in": {
                    "$ref": "img.url"
                  }
                }
              }
            }
          }
        },
        "poll": {
          "method": "GET",
          "pathTemplate": {
            "$concat": [
              {
                "$if": {
                  "condition": {
                    "$gt": [
                      {
                        "$len": {
                          "$ref": "request.images"
                        }
                      },
                      0
                    ]
                  },
                  "then": "/v1/images/edits/",
                  "else": "/v1/images/generations/"
                }
              },
              "{{taskId}}"
            ]
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
          "message": {
            "$ref": "response.error.message"
          },
          "images": {
            "$coalesce": [
              {
                "$map": {
                  "from": {
                    "$ref": "response.data"
                  },
                  "as": "item",
                  "in": {
                    "url": {
                      "$omitEmpty": {
                        "$ref": "item.url"
                      }
                    },
                    "b64_json": {
                      "$omitEmpty": {
                        "$ref": "item.b64_json"
                      }
                    }
                  }
                }
              },
              []
            ]
          },
          "errorPaths": [
            "error",
            "error.type"
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
