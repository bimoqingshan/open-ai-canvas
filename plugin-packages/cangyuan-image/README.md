# 沧源图片生成插件

沧源（Cangyuan）图片生成协议插件，支持异步文生图、参考图编辑和蒙版功能。

## 特性

- ✅ 异步文生图（`POST /v1/images/generations`）
- ✅ 参考图编辑（`POST /v1/images/edits`）
- ✅ 异步轮询查询（`GET /v1/images/generations/{task_id}`）
- ✅ 最多 9 张参考图
- ✅ 蒙版支持
- ✅ 画幅比例选择（1:1、3:2、2:3、4:3、3:4、16:9、21:9、9:16）
- ✅ 多档位选择（1K / 2K / 4K）
- ✅ 自动尺寸选项已移除，默认使用 1:1 画幅和 1K 档位

## 配置说明

1. **API Key**: 从沧源平台获取
2. **Base URL**: 配置沧源 API 地址

## 支持的参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | string | 固定传 `gpt-image-2-x` |
| `prompt` | string | 生成内容的描述 |
| `n` | integer | 生成张数（1-1） |
| `size` | string | 画幅比例：1:1、3:2、2:3、4:3、3:4、16:9、21:9、9:16 |
| `quality` | string | 输出质量：medium/low/high/xhigh/max |
| `tier` | string | 档位：1k/2k/4k，插件默认 1k |
| `images` | array | 参考图 URL 数组（最多 9 张） |
| `mask` | string | 蒙版 URL |
| `async` | boolean | 异步模式（固定为 true） |

## 档位说明

- **1k**: 1K 分辨率
- **2k**: 2K 分辨率（默认 ¥0.07/次）
- **4k**: 4K 高清档位

## 使用注意

- 默认使用异步模式
- 不同档位的费用由系统实时价格决定
- 插件界面默认发送 `1k`
- 参考图和蒙版必须是公网可访问的 HTTPS URL
