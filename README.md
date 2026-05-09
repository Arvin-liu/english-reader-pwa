# English Reader PWA

极简英语点击发音阅读器（纯 HTML/CSS/JavaScript，无后端）。

## 功能
- 粘贴英文文本并自动切句。
- 点击句子朗读（优先英音 en-GB，自动回退英文语音）。
- 点击单词朗读；双击或长按查本地词典。
- 支持语速、字号、深色模式。
- 自动保存文本与阅读进度。
- PWA 离线缓存 + 可添加到主屏幕。

## 本地运行
直接用静态服务器打开仓库根目录，例如：

```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`。

## GitHub Pages 部署
将本仓库直接作为静态站点发布即可（文件都在仓库根目录）。

Test Codex PR flow.
