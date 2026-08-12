// AI API client - supports both Anthropic and OpenRouter
const ANTHROPIC_MODEL = 'claude-3-5-haiku-20241022';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENROUTER_MODEL = 'deepseek/deepseek-chat';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
  // Try OPENROUTER_API_KEY first, then ANTHROPIC_API_KEY
  const key = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('未配置 API Key（需要 OPENROUTER_API_KEY 或 ANTHROPIC_API_KEY）');
  return key;
}

// Get API key from database settings, accept any valid key format
export function getApiKeyFromSettings(dbKey?: string | null): string {
  if (dbKey && (dbKey.startsWith('sk-or-') || dbKey.startsWith('sk-ant-'))) {
    return dbKey;
  }
  return getApiKey();
}

// Convert ChatMessage[] to Anthropic format
function toAnthropicMessages(messages: ChatMessage[]) {
  let systemPrompt = '';
  const userMessages: any[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt = typeof msg.content === 'string' ? msg.content : '';
    } else {
      const content = typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((p: any) => p.type === 'text' ? p.text : '').join('');
      userMessages.push({ role: msg.role, content });
    }
  }
  return { system: systemPrompt, messages: userMessages };
}

export async function callAI(messages: ChatMessage[], maxTokens = 1000, apiKeyOverride?: string): Promise<string> {
  const apiKey = apiKeyOverride || getApiKey();

  if (isAnthropicKey(apiKey)) {
    // Use Anthropic API directly
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
        messages: anthropicMessages.length > 0 ? anthropicMessages : [{ role: 'user', content: 'hi' }],
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic API错误 ${resp.status}: ${errText.substring(0, 300)}`);
    }
    const data = await resp.json();
    return data.content?.[0]?.text || '';
  } else {
    // Use OpenRouter API
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
      throw new Error(`AI API错误 ${resp.status}: ${errText.substring(0, 300)}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

export function parseAIResponse(text: string): any {
  return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
}
