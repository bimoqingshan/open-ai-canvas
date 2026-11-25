# Base-Image-V1 接口说明

---

## 渠道配置

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiKey` | secret | 是 | API Key，统一保存，不出现在请求日志中 |

---

## Provider：volcengine-ark-seedream-55

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型 ID |
| `prompt` | string | 是 | 图片描述或编辑指令 |
| `size` | string | 否 | 画幅比例，支持 auto、1:1、3:2、2:3、4:3、3:4、16:9、9:16、21:9、9:21；auto 或省略时按 1:1 处理 |
| `resolution` | string | 否 | 分辨率档位，1k 或 2k，默认 1k |
| `images` | media[] | 否 | 参考图数组，最多 10 张，按 order 升序排列后映射为 URL 数组 |
| `n` | integer | 否 | 生成数量，固定为 1 |

### 响应

同步返回，images 从 `response.data` 提取（b64_json 格式）。失败时 `error.code` 触发失败状态，`error.message` 作为错误信息。

---

## Manifest 合同

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "volcengine-ark-seedream-55",
  "name": "Base-Image-V1",
  "version": "1.0.0",
  "author": "",
  "description": "",
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
        "id": "volcengine-ark-seedream-55",
        "label": "Base-Image-V1",
        "capabilities": [
          "image"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation"
        ],
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
            "description": "模型 ID，仅接受 doubao-seedream-5-5"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "图片描述或编辑指令"
          },
          {
            "name": "size",
            "type": "string",
            "required": false,
            "mapping": "size",
            "description": "画幅比例，支持 auto、1:1、3:2、2:3、4:3、3:4、16:9、9:16、21:9、9:21；auto 或省略时按 1:1 处理"
          },
          {
            "name": "resolution",
            "type": "string",
            "required": false,
            "mapping": "resolution",
            "description": "分辨率档位，1k 或 2k，默认 1k"
          },
          {
            "name": "images",
            "type": "media[]",
            "required": false,
            "mapping": "images",
            "description": "参考图数组，最多 10 张，按 order 升序排列后映射为 URL 数组"
          },
          {
            "name": "n",
            "type": "integer",
            "required": false,
            "mapping": "n",
            "description": "生成数量，固定为 1"
          }
        ],
        "imageParameters": [
          {
            "name": "size",
            "label": "画幅比例",
            "type": "string",
            "binding": "aspectRatio",
            "encoding": "ratio",
            "values": [
              "auto",
              "1:1",
              "3:2",
              "2:3",
              "4:3",
              "3:4",
              "16:9",
              "9:16",
              "21:9",
              "9:21"
            ],
            "default": "1:1"
          },
          {
            "name": "imageResolution",
            "label": "分辨率",
            "type": "string",
            "binding": "resolution",
            "values": [
              "1k",
              "2k"
            ],
            "default": "1k",
            "pricing": true
          }
        ],
        "validations": [
          {
            "assert": {
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
            "message": "提示词不能为空"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$ref": "request.imageCount"
                },
                1
              ]
            },
            "message": "每次只能提交 1 张（n 固定为 1）"
          },
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
                  "$eq": [
                    {
                      "$ref": "request.aspectRatio"
                    },
                    ""
                  ]
                },
                {
                  "$in": [
                    {
                      "$ref": "request.aspectRatio"
                    },
                    [
                      "auto",
                      "1:1",
                      "3:2",
                      "2:3",
                      "4:3",
                      "3:4",
                      "16:9",
                      "9:16",
                      "21:9",
                      "9:21"
                    ]
                  ]
                }
              ]
            },
            "message": "不支持该画幅比例，请使用标准比例或 auto"
          },
          {
            "assert": {
              "$or": [
                {
                  "$eq": [
                    {
                      "$ref": "request.resolution"
                    },
                    ""
                  ]
                },
                {
                  "$in": [
                    {
                      "$ref": "request.resolution"
                    },
                    [
                      "1k",
                      "2k"
                    ]
                  ]
                }
              ]
            },
            "message": "resolution 只支持 1k 或 2k"
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
            "size": {
              "$if": {
                "condition": {
                  "$in": [
                    {
                      "$lower": {
                        "$trim": {
                          "$ref": "request.aspectRatio"
                        }
                      }
                    },
                    [
                      "",
                      "auto"
                    ]
                  ]
                },
                "then": "1:1",
                "else": {
                  "$ref": "request.aspectRatio"
                }
              }
            },
            "resolution": {
              "$omitEmpty": {
                "$ref": "request.resolution"
              }
            },
            "images": {
              "$omitEmpty": {
                "$map": {
                  "from": {
                    "$sortByOrder": {
                      "$ref": "request.images"
                    }
                  },
                  "as": "media",
                  "in": {
                    "$ref": "media.value"
                  }
                }
              }
            }
          }
        },
        "response": {
          "images": {
            "$ref": "response.data"
          },
          "errorPaths": [
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
