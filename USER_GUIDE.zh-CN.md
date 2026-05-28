# CCodex Studio 简体中文说明书

适用版本：CCodex Studio 0.1.0 alpha  
适用系统：Windows 10 / Windows 11

## 1. 软件简介

CCodex Studio 是一个本地桌面工作台，用来把 Claude Code、Codex、claude-code-router、Agent Skills 等命令行工具放进同一个图形界面中使用。

它本身不是新的大模型服务，也不会替你申请 API Key。它主要做这些事：

- 在桌面窗口里启动内嵌终端，运行 `claude`、`codex` 或 `ccr code`。
- 自动读取本机的 Claude Code / Codex 历史会话。
- 支持从历史会话中预览、阅读、恢复对话。
- 扫描本机已安装的 Skills，并在右侧面板里搜索、复制或插入。
- 按项目显示上下文、脚本、错误信息和最近终端输出。

所有会话、Skills、配置和命令都在当前电脑本地运行。请只在你信任的电脑上使用。

## 2. 安装与启动

### 2.1 免安装版启动

如果你收到的是 `CCodex-Studio-win-unpacked.zip`：

1. 解压 zip 文件。
2. 打开解压后的文件夹。
3. 双击 `CCodex Studio.exe` 启动。

不要只把 `CCodex Studio.exe` 单独拷贝出来运行。它需要同目录下的 `resources`、`locales`、`.dll` 等文件一起存在。

### 2.2 运行前要求

如果只是打开界面，通常不需要额外配置。但如果要真正启动 Claude Code / Codex，需要目标电脑已安装对应命令。

常见要求：

- Node.js 22 或 24。
- Claude Code CLI，并且命令行里可以运行 `claude`。
- 如果使用 Codex 配置，命令行里可以运行 `codex`。
- 如果使用 claude-code-router，命令行里可以运行 `ccr code`。
- 如果使用 DeepSeek 配置，需要在系统环境变量或启动终端中设置 `DEEPSEEK_API_KEY`。

可以在 PowerShell 中检查：

```powershell
node -v
claude --version
codex --version
ccr --version
```

不是每个命令都必须存在。你只需要安装自己打算使用的引擎。

## 3. 首次使用流程

1. 启动 `CCodex Studio.exe`。
2. 点击顶部的项目按钮，或点击主界面里的“打开项目”。
3. 选择你要工作的项目文件夹。
4. 在顶部“引擎”下拉框选择要使用的配置，例如：
   - `Claude Code Default (Claude)`
   - `DeepSeek V4 Pro (Claude)`
   - `Codex (Codex)`
5. 点击终端工具栏里的“启动 Claude Code / Codex”。
6. 在内嵌终端中正常输入和使用对应命令行工具。

## 4. 界面区域说明

### 4.1 顶部栏

顶部栏从左到右主要包含：

- `CCodex Studio`：应用名称。
- 左侧栏按钮：显示或隐藏项目与会话列表。
- Skills 按钮：显示或隐藏右侧 Skills 面板。
- 项目按钮：显示当前项目名，点击可以切换项目。
- `终端 / 阅读`：切换主区域视图。
- `引擎`：选择启动时使用的引擎配置。
- `PTY`：表示当前使用内嵌伪终端运行命令。

### 4.2 左侧项目与会话栏

左侧栏用于管理项目和历史会话：

- “新对话”：在当前项目里启动新的引擎会话。
- “搜索”：搜索项目名和历史会话标题。
- “项目”：显示本机检测到的 Claude Code / Codex 项目历史。
- 单击项目：展开或收起项目下的历史会话。
- 单击会话：进入阅读视图并预览该会话。
- 双击会话：恢复该会话，并切换到对应引擎。

历史来源包括：

- `~/.claude/projects`
- `~/.codex/sessions`

如果左侧没有历史记录，通常说明目标电脑还没有在项目里运行过 `claude` 或 `codex`。

### 4.3 主区域：终端视图

终端视图用于运行 Claude Code、Codex 或 CCR。

常见按钮：

- “启动 Claude Code / Codex”：在当前项目目录中启动所选引擎。
- `Stop`：停止当前内嵌终端会话。
- “重置显示”：重建终端显示区域，适合终端显示错乱时使用。
- “阅读模式”：切换到历史阅读视图。
- “修复最近错误”：当终端检测到错误输出时出现，会把最近错误上下文发送给当前引擎。

终端的当前工作目录就是你选择的项目目录。

### 4.4 主区域：阅读视图

阅读视图用于查看历史会话内容。

它会显示：

- 会话摘要。
- 下一步线索。
- 涉及的文件路径。
- 最近的对话片段。
- 如果识别到 Markdown / 文本文件，还会尝试显示文件预览。

常见按钮：

- “刷新”：重新读取当前历史文件。
- “终端优先 / 阅读优先”：在终端和阅读视图之间切换。
- “恢复会话”：恢复当前选中的历史会话。

### 4.5 右侧 Skills 面板

右侧 Skills 面板会扫描本地已安装的 Skills。

扫描路径包括：

- `~/.claude/skills`
- `~/.agents/skills`
- `~/.codex/skills`
- `~/.codex/skills/.system`
- 当前项目的 `.claude/skills`

常见操作：

- 搜索框：按名称、说明或关键词搜索 Skill。
- “智能推荐”：根据当前项目、终端输出和最近错误推荐可能有用的 Skill。
- “使用”：把 `/<skill-name>` 插入当前终端输入。
- “复制”：复制 `/<skill-name>`。
- “打开”：打开该 Skill 所在文件夹。
- 双击 Skill：直接插入使用。
- 拖拽 Skill 到终端：把对应命令放入终端。

如果没有安装 Skills，面板会提示“还没有安装 skills”。你可以通过 `skills.sh` 或自己的方式安装后再重新打开应用。

## 5. 引擎配置说明

应用内置几个默认配置：

### 5.1 Claude Code Default

默认使用本机已有的 Claude Code 配置，启动命令是：

```powershell
claude
```

适合已经正常使用官方 Claude Code 的电脑。

### 5.2 DeepSeek V4 Pro

这是一个 Claude Code 环境变量配置，启动命令仍然是：

```powershell
claude
```

但会附加类似下面的环境变量：

- `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`
- `ANTHROPIC_AUTH_TOKEN=$DEEPSEEK_API_KEY`
- `ANTHROPIC_MODEL=deepseek-v4-pro`

注意：应用不会保存你的 DeepSeek Key。它只读取当前系统环境变量里的 `DEEPSEEK_API_KEY`。

### 5.3 Codex

Codex 配置启动命令是：

```powershell
codex
```

适合已安装 OpenAI Codex CLI 的电脑。

### 5.4 CCR

如果配置为 claude-code-router 模式，启动命令是：

```powershell
ccr code
```

应用会检测：

```text
~/.claude-code-router/config.json
```

## 6. 常用工作流

### 6.1 新项目开始工作

1. 点击顶部项目按钮。
2. 选择项目文件夹。
3. 选择引擎。
4. 点击“启动”。
5. 在终端中输入你的任务。

### 6.2 继续之前的 Claude Code 会话

1. 打开左侧栏。
2. 找到对应项目。
3. 展开项目。
4. 单击历史会话查看内容。
5. 点击“恢复会话”，或双击该历史会话。

### 6.3 用 Skill 辅助当前任务

1. 打开右侧 Skills 面板。
2. 搜索需要的 Skill。
3. 点击“使用”，或把 Skill 拖进终端。
4. 在终端里补充你的具体要求后发送。

### 6.4 让引擎修复最近终端错误

1. 在终端中运行命令。
2. 如果出现错误，等待“修复最近错误”按钮出现。
3. 点击该按钮。
4. 应用会把最近错误上下文插入当前引擎输入中。

## 7. 本地数据与隐私

CCodex Studio 会读取这些本地路径：

```text
~/.claude/projects
~/.claude/skills
~/.agents/skills
~/.codex/sessions
~/.codex/history.jsonl
~/.codex/skills
<项目目录>/.claude/skills
```

应用自己的配置保存到：

```text
~/.ccodex-studio
```

主要文件：

```text
~/.ccodex-studio/profiles.json
```

说明：

- 应用会读取本机 Claude Code / Codex 历史，用于显示项目和会话。
- 应用会启动本机命令行程序，例如 `claude`、`codex`、`ccr`。
- 应用不主动上传历史会话或 API Key。
- 真正的网络请求由你启动的 Claude Code、Codex、CCR 或对应模型服务完成。

## 8. 常见问题

### 8.1 启动时报 `ERR_CONNECTION_REFUSED http://localhost:9000`

这通常表示运行到了开发模式版本，或旧版本打包时错误地加载了开发服务器。

处理方式：

1. 确认使用的是新的 `release/win-unpacked/CCodex Studio.exe`。
2. 不要从源码目录里直接运行旧的 Electron 开发命令。
3. 如果仍然出现，重新打包或联系打包者更新版本。

### 8.2 双击 exe 没反应

可以用 PowerShell 启动以查看错误：

```powershell
& "C:\路径\到\CCodex Studio.exe"
```

常见原因：

- zip 没有完整解压。
- 只拷贝了 exe，没有拷贝同目录文件。
- 杀毒软件拦截了未签名 Electron 应用。
- 旧进程还在后台运行。

### 8.3 点击“启动”后提示找不到 `claude`

说明目标电脑没有安装 Claude Code CLI，或 `claude` 不在 PATH 中。

处理方式：

1. 在 PowerShell 中运行 `claude --version`。
2. 如果无法识别命令，先安装 Claude Code CLI。
3. 安装后重启 PowerShell 和 CCodex Studio。

### 8.4 Codex 启动失败

检查：

```powershell
codex --version
```

如果命令不存在，说明目标电脑没有安装 Codex CLI，或 PATH 未配置。

### 8.5 DeepSeek 配置启动后鉴权失败

检查环境变量：

```powershell
echo $env:DEEPSEEK_API_KEY
```

如果没有输出，需要先设置 `DEEPSEEK_API_KEY`。设置后重新启动 CCodex Studio。

### 8.6 左侧没有历史会话

可能原因：

- 目标电脑还没有 Claude Code / Codex 历史。
- 历史路径不存在。
- 你选择的是新项目，还没有运行过会话。

可以先在项目里启动一次 Claude Code 或 Codex，之后历史会自动出现在左侧。

### 8.7 Skills 面板为空

可能原因：

- 没有安装任何 Skills。
- Skills 没放在支持的目录中。
- Skill 文件夹里没有有效的 `SKILL.md`。

支持目录见“右侧 Skills 面板”章节。

### 8.8 打包时提示 `Access is denied`

通常是旧的 `CCodex Studio.exe` 还在运行，导致打包器无法覆盖文件。

处理方式：

1. 关闭 CCodex Studio 窗口。
2. 打开任务管理器，结束残留的 `CCodex Studio.exe`。
3. 重新执行打包命令。

## 9. 发送给另一台 Windows 电脑

推荐发送整个 zip：

```text
release/CCodex-Studio-win-unpacked.zip
```

对方收到后：

1. 解压 zip。
2. 双击 `CCodex Studio.exe`。
3. 如果需要运行 Claude Code / Codex，在对方电脑上安装对应 CLI。

不要只发送单独的 exe。

## 10. 开发者命令

如果你要从源码运行或重新打包，请在项目目录中执行：

```powershell
npm install
npm run dev
npm run build
npm run pack
```

命令说明：

- `npm run dev`：启动开发模式，渲染器会监听 `http://localhost:9000`。
- `npm run build`：构建渲染器和 Electron 主进程。
- `npm run pack`：生成免安装版目录 `release/win-unpacked`。
- `npm run dist`：生成安装器产物。

打包前请确认没有正在运行的 `CCodex Studio.exe`，否则可能无法覆盖旧文件。

