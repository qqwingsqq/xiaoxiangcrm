'use client';

interface Props {
  title: string;
  summary: string;
  keyPoints: string[];
  onClose: () => void;
}

const BRANCH_COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

function wrapText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const words = text.split('');
  const lines: string[] = [];
  let cur = '';
  for (const ch of words) {
    if (cur.length >= maxLen) { lines.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export default function MindMapModal({ title, summary, keyPoints, onClose }: Props) {
  const W = 720, H = 480;
  const cx = W / 2, cy = H / 2;
  const R = 170;
  const n = keyPoints.length;

  // Distribute nodes around center, starting from top
  const nodes = keyPoints.map((kp, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return {
      kp,
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
      color: BRANCH_COLORS[i % BRANCH_COLORS.length],
      angle,
    };
  });

  const summaryLines = wrapText(summary || title, 14);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}>
      <div
        style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '20px', overflow: 'hidden', width: '100%', maxWidth: '760px' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🗺️</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>思维导图</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>— {title}</span>
          </div>
          <button onClick={onClose} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>

        {/* Mind map SVG */}
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', minHeight: '300px' }}>
            {/* Background grid dots */}
            <defs>
              <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#1e293b" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#dots)" />

            {/* Branch curves */}
            {nodes.map((node, i) => {
              const midX = cx + (node.x - cx) * 0.5;
              const midY = cy + (node.y - cy) * 0.5;
              return (
                <path
                  key={i}
                  d={`M${cx},${cy} Q${midX + (node.y - cy) * 0.15},${midY - (node.x - cx) * 0.15} ${node.x},${node.y}`}
                  stroke={node.color}
                  strokeWidth="2"
                  fill="none"
                  opacity="0.5"
                />
              );
            })}

            {/* Center node */}
            <rect
              x={cx - 80} y={cy - 36}
              width="160" height={summaryLines.length > 1 ? 56 + (summaryLines.length - 1) * 16 : 52}
              rx="12" ry="12"
              fill="#1e40af" opacity="0.9"
            />
            <rect
              x={cx - 80} y={cy - 36}
              width="160" height={summaryLines.length > 1 ? 56 + (summaryLines.length - 1) * 16 : 52}
              rx="12" ry="12"
              fill="none" stroke="#3b82f6" strokeWidth="1.5"
            />
            {summaryLines.map((line, i) => (
              <text
                key={i}
                x={cx} y={cy - 6 + i * 16}
                textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="12" fontWeight="600"
                fontFamily="-apple-system, 'PingFang SC', sans-serif">
                {line}
              </text>
            ))}

            {/* Branch nodes */}
            {nodes.map((node, i) => {
              const lines = wrapText(node.kp, 12);
              const nodeW = Math.min(Math.max(lines[0].length * 8 + 24, 80), 160);
              const nodeH = 24 + lines.length * 16;
              const isLeft = node.x < cx - 10;
              const isRight = node.x > cx + 10;
              // Number badge position
              const badgeX = node.x + (isLeft ? -nodeW / 2 - 12 : isRight ? nodeW / 2 + 12 : 0);
              const badgeY = node.y - nodeH / 2 - 10;

              return (
                <g key={i}>
                  {/* Node background */}
                  <rect
                    x={node.x - nodeW / 2} y={node.y - nodeH / 2}
                    width={nodeW} height={nodeH}
                    rx="10" ry="10"
                    fill={node.color + '20'}
                  />
                  <rect
                    x={node.x - nodeW / 2} y={node.y - nodeH / 2}
                    width={nodeW} height={nodeH}
                    rx="10" ry="10"
                    fill="none" stroke={node.color} strokeWidth="1.5"
                  />
                  {/* Number badge */}
                  <circle cx={node.x - nodeW / 2 + 10} cy={node.y - nodeH / 2 + 10} r="8" fill={node.color} />
                  <text
                    x={node.x - nodeW / 2 + 10} y={node.y - nodeH / 2 + 10}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize="9" fontWeight="700">
                    {i + 1}
                  </text>
                  {/* Key point text */}
                  {lines.map((line, li) => (
                    <text
                      key={li}
                      x={node.x} y={node.y - (lines.length - 1) * 8 + li * 16}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={node.color} fontSize="11"
                      fontFamily="-apple-system, 'PingFang SC', sans-serif">
                      {line}
                    </text>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Key points list */}
        <div style={{ padding: '12px 18px 16px', borderTop: '1px solid #1e293b' }}>
          <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>要点列表</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {keyPoints.map((kp, i) => (
              <span key={i} style={{
                fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                background: BRANCH_COLORS[i % BRANCH_COLORS.length] + '20',
                border: `1px solid ${BRANCH_COLORS[i % BRANCH_COLORS.length]}50`,
                color: BRANCH_COLORS[i % BRANCH_COLORS.length],
              }}>
                {i + 1}. {kp}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
