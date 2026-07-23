/**
 * 对话页快捷发送预设。
 * 直接改这个文件即可，无需改存储结构。
 *
 * - id: 唯一标识
 * - label: 按钮上显示的短文案
 * - content: 实际发送给模型的完整内容
 */
export interface ChatPreset {
  id: string
  label: string
  content: string
}

export const CHAT_PRESETS: ChatPreset[] = [
  {
    id: 'intro',
    label: '自我介绍',
    content: '你好，你是谁？请你自我介绍一下',
  },
  {
    id: 'poem',
    label: '背诵古诗',
    content: '随机背诵一首中文古诗',
  },
  {
    id: 'joke',
    label: 'AI 笑话',
    content: '说一个笑话，最好是关于 AI LLM 的',
  },
  {
    id: 'math',
    label: '简单计算',
    content: '请计算 17 × 24 + 56，并简要说明计算步骤',
  },
  {
    id: 'translate',
    label: '中英互译',
    content:
      '请把下面这句话翻译成英文，再译回中文，并指出两种译法的细微差别：\n“技术改变世界，但善意决定方向。”',
  },
  {
    id: 'code',
    label: '写段代码',
    content:
      '请用 TypeScript 写一个防抖函数 debounce，要求支持泛型参数、可取消防抖，并附带简短用法示例。',
  },
  {
    id: 'reason',
    label: '逻辑推理',
    content:
      '有三个人 A、B、C。已知：A 说“B 在说谎”，B 说“C 在说谎”，C 说“A 和 B 都在说谎”。假设三句话中只有一句为真，请推理谁在说谎、谁说了真话，并给出理由。',
  },
  {
    id: 'stream-test',
    label: '长文流式',
    content:
      '请用约 300 字介绍大语言模型的基本原理，分 3 段输出，适合用来测试流式响应是否顺畅。',
  },
]
