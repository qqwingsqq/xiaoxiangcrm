const OPENROUTER_MODEL = 'google/gemini-2.5-flash';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

type ContentPart = { type: string; text?: string; image_url?: { url: string } };
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('未配置 OPENROUTER_API_KEY');
  return key;
}

// 从数据库设置中获取 API Key，如果不是 OpenRouter key 则回退到环境变量
export function getApiKeyFromSettings(dbKey?: string | null): string {
  return (dbKey && dbKey.startsWith('sk-or-')) ? dbKey : getApiKey();
}

export async function callAI(messages: ChatMessage[], maxTokens = 1000): Promise<string> {
  const apiKey = getApiKey();
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
    throw new Error(`AI API错误 ${resp.status}: ${errText.substring(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

export function parseAIResponse(text: string): any {
  return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
}