const OPENROUTER_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// API2D (OpenAI compatible relay service)
const API2D_URL = 'https://oa.api2d.net/v1/chat/completions';
const API2D_MODEL = 'gpt-4o-mini';

// OpenAI official
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

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

function isAPI2DKey(key: string): boolean {
  return key.startsWith('fk');
}

function isOpenAIKey(key: string): boolean {
  return key.startsWith('sk-') && !isOpenRouterKey(key) && !isAnthropicKey(key);
}

export function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('未配置 API Key');
  return key;
}

export function getApiKeyFromSettings(dbKey?: string | null): string {
  if (dbKey && (isOpenRouterKey(dbKey) || isAnthropicKey(dbKey) || isAPI2DKey(dbKey) || isOpenAIKey(dbKey))) return dbKey;
  return getApiKey();
}

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
  } else if (isAPI2DKey(apiKey)) {
    // API2D relay service
    const resp = await fetch(API2D_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: API2D_MODEL,
        max_tokens: maxTokens,
        messages,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`API2D错误 ${resp.status}: ${errText.substring(0, 200)}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  } else if (isOpenAIKey(apiKey)) {
    // OpenAI official
    const resp = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: maxTokens,
        messages,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI API错误 ${resp.status}: ${errText.substring(0, 200)}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  } else {
    // OpenRouter (default)
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
  let cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  
  try {
    return JSON.parse(cleaned);
  } catch {}
  
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
    
    let fixed = jsonMatch[0];
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(fixed);
    } catch {}
  }
  
  console.error('[parseAIResponse] Failed to parse AI response:', cleaned.substring(0, 200));
  return {
    summary: cleaned.substring(0, 100) || '解析失败',
    next_meeting: null,
    next_action: null,
    discussed_features: [],
    next_steps: [],
    intent_level: 'unknown',
    key_points: [],
  };
}