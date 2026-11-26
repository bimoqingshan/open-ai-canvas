# 米粒 BD Seedance2.5

米粒 `bd-seedance2.5` 视频生成协议插件，支持文字、图片、视频和音频参考素材，以及异步轮询和 MP4 下载。

- Provider：`mili-bd-seedance25`
- 创建：`POST https://miliapi.com/v1/videos`
- 查询：`GET https://miliapi.com/v1/videos/{id}`
- 下载：`GET https://miliapi.com/v1/videos/{id}/content?download=1`
- 鉴权：米粒 API Key（Bearer）

插件使用宿主的任务持久化、幂等重试、轮询和媒体保存能力。完整字段、素材限制和已知运行时边界见 [`docs/interface.md`](docs/interface.md)。
