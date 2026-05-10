# English Reader PWA

极简英语点击发音阅读器（纯 HTML/CSS/JavaScript，无后端）。

## 功能
- 粘贴英文文本并自动切句。
- 单击朗读当前 reading unit。
- 双击或长按单词：本地查词并朗读该词。
- 支持语速、字号、深色模式。
- 支持外部高拟真 TTS 代理（可回退浏览器 TTS）。
- 自动保存文本与阅读进度。
- PWA 离线缓存 + 可添加到主屏幕。

## 外部 TTS 说明
- 前端不保存任何 TTS API key。
- 外部 TTS 需要用户自行提供代理接口地址。
- 可使用 Cloudflare Worker 对接 ElevenLabs / OpenAI / Azure 等供应商。

代理接口示例：

```http
POST /tts
Content-Type: application/json

{
  "text": "This is a sentence.",
  "voice": "british",
  "type": "sentence"
}
```

返回：

```http
Content-Type: audio/mpeg
```

## 本地运行
直接用静态服务器打开仓库根目录，例如：

```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`。

## GitHub Pages 部署
将本仓库直接作为静态站点发布即可（文件都在仓库根目录）。
