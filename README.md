# AutoDL GPU Availability Monitor

一个帮你盯着 AutoDL GPU 什么时候空出来的浏览器扩展。

## 我为什么做它

我经常在 AutoDL 租服务器，最头疼的不是训练慢，而是明明实例已经租好了，却因为宿主机上的 GPU 被别人占着，暂时开不了机。

AutoDL 会在 GPU 空出来后显示一行绿色的“GPU充足”，问题是——谁有空一直刷新网页看它？

所以我做了这个小扩展。你只要告诉它想等哪台实例，然后把 AutoDL 页面留在浏览器里。GPU 一旦空出来，它就会弹窗、响铃，把你叫回来。

![Chrome](https://img.shields.io/badge/Chrome-supported-4285F4?logo=googlechrome&logoColor=white)
![Edge](https://img.shields.io/badge/Edge-supported-0078D7?logo=microsoftedge&logoColor=white)
![Arc](https://img.shields.io/badge/Arc-supported-FCBFBD)
![License](https://img.shields.io/badge/license-MIT-green)

## 它能做什么

- 同时盯住多台实例，名称或实例 ID 都可以
- GPU 空出来时弹出提示、发送系统通知并响铃
- 可以只响一次，也可以持续响到你回来
- 页面右下角会告诉你它有没有正常工作
- 识别出问题时可以一键复制诊断信息，方便反馈

它只负责提醒，**不会替你开机，也不会偷偷产生费用**。

## 安装

1. 在 [Releases](https://github.com/Kenny-Huang-mz/autodl-gpu-availability-monitor/releases) 下载最新 ZIP 并解压。
2. 打开浏览器的扩展管理页：Chrome `chrome://extensions`、Edge `edge://extensions`、Arc `arc://extensions`。
3. 打开“开发者模式”，选择“加载已解压的扩展程序”。
4. 选中刚才解压出来的文件夹。

装好后，打开 AutoDL 的“容器实例”页面并刷新。点击扩展图标，填入想监控的实例名称或 ID，保存就可以了。

## 使用时需要知道

目前扩展是通过 AutoDL 实例页面判断状态的，所以浏览器要保持运行，并留着这个页面。它不会读取你的密码、Cookie 或登录令牌，也不会把实例信息发送给我。

如果右下角显示“识别异常”，先检查实例名称是否完全一致；还不行的话，点一下“复制诊断”，然后来 [提个 Issue](https://github.com/Kenny-Huang-mz/autodl-gpu-availability-monitor/issues)。请不要在 Issue 里粘贴 Cookie 或登录令牌。

## 最后

这是我自己遇到问题后做出来的小工具，目前还是第一个版本。AutoDL 改版可能会让识别暂时失效，如果你发现 bug，欢迎告诉我；有好点子也欢迎一起折腾。

详细信息：[隐私说明](PRIVACY.md) · [更新记录](CHANGELOG.md) · [参与贡献](CONTRIBUTING.md) · [English](README_EN.md)

MIT License
