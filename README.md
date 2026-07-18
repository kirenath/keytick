# KeyTick

个人用 AI API 端点检测与调试工具。它面向 OpenAI 兼容格式的接口，可以保存多个 Base URL，检测连通性，拉取模型列表，并做简单的流式对话测试。

## 功能

- 管理多个 API 端点
- 为每个端点选择一个默认协议类型：OpenAI Chat（默认）/ OpenAI Responses / Anthropic Messages / Google Gemini v1beta
- 检测模型列表端点可访问性（根据端点类型走 `/v1/models` 或 `/v1beta/models`）
- 拉取并搜索模型 ID
- 通过 `{BaseUrl}/v1/chat/completions` 做流式对话测试
- 模型选择支持类型筛选：点击下拉查看列表，也可以直接输入名称进行模糊匹配，列表很大时也能快速定位
- 协议端点探测：同时检测 OpenAI Responses、Anthropic Messages、Google Gemini v1beta 三种协议端点，并高亮标记当前端点的默认协议
- 记录最近 20 条检测历史
- API Key 只保存在当前浏览器会话的 `sessionStorage`，不会写入服务端文件

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui 风格组件
- pnpm

## 本地运行

安装依赖：

```bash
pnpm install
```

启动开发服务：

```bash
pnpm dev
```

默认访问：

```text
http://localhost:3000
```

生产构建：

```bash
pnpm build
```

启动生产服务：

```bash
pnpm start
```

## 使用方式

1. 点击左侧「新增」，填写端点名称和 Base URL，例如 `https://api.openai.com`。
2. 在「端点类型」中选择该端点默认走哪个协议：`OpenAI Chat`/`OpenAI Responses`/`Anthropic Messages`/`Gemini v1beta`。默认为 `OpenAI Chat`，也可以不选。
3. 选择端点后，在「检测」页输入 API Key。
4. 点击「测试连接」会根据端点类型检测对应的模型端点（Chat/Responses/Messages 走 `/v1/models`，Gemini 走 `/v1beta/models`）。
5. 点击「拉取模型」获取模型列表，返回体同样会按端点类型解析对应的字段。
6. 在「检测」页底部的「协议端点检测」卡片可分别探测 `/v1/responses`、`/v1/messages`、`/v1beta/models`。若端点类型选了非 `Chat`，对应的探测项会带上「默认」标记并置于首位；任何协议都可以随时手动探测。
7. 到「对话」页选择或输入模型名：点击输入框查看下拉列表，或直接输入关键字进行模糊筛选；模型不在列表里也可手动输入。发送消息测试流式响应。
8. 到「历史」页查看该端点最近的检测记录。

Base URL 会自动去掉末尾的 `/` 和 `/v1`，所以 `https://api.example.com` 与 `https://api.example.com/v1` 都可以填写。

## 数据存储

端点配置和检测历史保存在本地文件：

```text
data/endpoints.json
```

这个项目按个人本地工具设计，不依赖数据库。该文件可能包含你的私有端点地址和备注，默认不建议提交到仓库。

API Key 不会写入 `data/endpoints.json`。它只保存在浏览器当前会话中，关闭会话后需要重新输入。

## 注意事项

- 当前服务端会代理请求到你填写的 Base URL，请只在可信本地环境使用。
- 文件存储不适合多实例部署或无持久磁盘环境。
- `next.config.mjs` 当前配置了 `typescript.ignoreBuildErrors: true`，生产构建会跳过类型错误校验。
