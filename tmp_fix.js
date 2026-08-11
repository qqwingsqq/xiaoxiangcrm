const fs = require('fs');
const filePath = 'D:\\\\CRM\\\\XCRM\\\\crm-app\\\\app\\\\wechat\\\\page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add orgError state after organizing state
content = content.replace(
  '  const [organizing, setOrganizing] = useState(false);',
  '  const [organizing, setOrganizing] = useState(false);\n  const [orgError, setOrgError] = useState(\'\');'
);

// 2. Replace organizeAll function
const oldFunc = \  const organizeAll = useCallback(async () => {
    setOrganizing(true);
    setOrgProgress({ done: 0, remaining: 0 });
    let totalDone = 0;
    while (true) {
      try {
        const res = await fetch('/api/wechat/batch-analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_size: 8 }),
        });
        const data = await res.json();
        totalDone += data.processed ?? 0;
        setOrgProgress({ done: totalDone, remaining: data.remaining ?? 0 });
        if (data.done || data.remaining === 0) break;
        await new Promise(r => setTimeout(r, 800));
      } catch { break; }
    }
    setOrganizing(false);
    loadChats();
  }, [loadChats]);\;

const newFunc = \  const organizeAll = useCallback(async () => {
    setOrganizing(true);
    setOrgError('');
    setOrgProgress({ done: 0, remaining: 0 });
    let totalDone = 0;
    while (true) {
      try {
        const res = await fetch('/api/wechat/batch-analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_size: 8 }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setOrgError(errData.error || 'API error ' + res.status);
          break;
        }
        const data = await res.json();
        if (data.failed > 0 && data.processed === 0) {
          setOrgError('AI analysis failed, please check API Key in settings');
          break;
        }
        totalDone += data.processed ?? 0;
        setOrgProgress({ done: totalDone, remaining: data.remaining ?? 0 });
        if (data.done || data.remaining === 0) break;
        await new Promise(r => setTimeout(r, 800));
      } catch (e) {
        setOrgError('network error: ' + String(e).substring(0, 100));
        break;
      }
    }
    setOrganizing(false);
    loadChats();
  }, [loadChats]);\;

if (content.includes(oldFunc)) {
  content = content.replace(oldFunc, newFunc);
  console.log('Replaced organizeAll function');
} else {
  console.log('Could not find old organizeAll function');
}

// 3. Add error display after button
const oldBtn = \) : '\u2728 \u4e00\u952e\u6574\u7406\u804a\u5929\u8bb0\u5f55'}\n          </button>\;
const newBtn = \) : '\u2728 \u4e00\u952e\u6574\u7406\u804a\u5929\u8bb0\u5f55'}\n          </button>\n          {orgError && <p className='text-xs text-red-400 mt-1'>{orgError}</p>}\;

if (content.includes(oldBtn)) {
  content = content.replace(oldBtn, newBtn);
  console.log('Added error display');
} else {
  console.log('Could not find button text');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('File saved');