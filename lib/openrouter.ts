const OPENROUTER_MODEL = 'deepseek/deepseek-chat';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

type ContentPart = { type: string; text?: string; image_url?: { url: string } };
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

function isAnthropicKey(key: string): boolean {
  return key.startsWith('sk-ant-');
}

function isOpenRouterKey(key: string): boolean {
  return key.startsWith('sk-or-');
}

export function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('未配置 OPENROUTER_API_KEY 或 ANTHROPIC_API_KEY');
  return key;
}

// 从数据库设置中获取 API Key，支持 OpenRouter 和 Anthropic 两种 key
export function getApiKeyFromSettings(dbKey?: string | null): string {
  if (dbKey && (isOpenRouterKey(dbKey) || isAnthropicKey(dbKey))) return dbKey;
  return getApiKey();
}

// 将 ChatMessage[] 转换为 Anthropic 格式
function toAnthropicMessages(messages: ChatMessage[]): { system: string; messages: any[] } {
  let system = '';
  const anthropicMessages: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      const text = typeof msg.content === 'string' ? msg.content : '';
      system += (system ? '\n' : '') + text;
    } else {
      const text = typeof msg.content === 'string'
        ? msg.content
        : msg.content.map(p => p.text || '').join('');
      anthropicMessages.push({ role: msg.role, content: text });
    }
  }

  return { system, messages: anthropicMessages };
}

export async function callAI(messages: ChatMessage[], maxTokens = 1000, apiKeyOverride?: string): Promise<string> {
  const apiKey = apiKeyOverride || getApiKey();

  if (isAnthropicKey(apiKey)) {
    // 使用 Anthropic API
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system: system || undefined,
        messages: anthropicMessages,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic API错误 ${resp.status}: ${errText.substring(0, 200)}`);
    }
    const data = await resp.json();
    return data.content?.[0]?.text || '';
  } else {
    // 使用 OpenRouter API
    const resp = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: maxTokens,
        messages,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenRouter API错误 ${resp.status}: ${errText.substring(0, 200)}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

export function parseAIResponse(text: string): any {
  return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
}