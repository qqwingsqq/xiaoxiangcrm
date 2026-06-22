function pad(n: number) { return n.toString().padStart(2, '0'); }

function toICSDate(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

export function downloadICS(title: string, remindDate?: string | null, description?: string) {
  const start = remindDate ? new Date(remindDate + 'T09:00:00') : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
  const now = new Date();
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@xiaoxiangcrm`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//小象智能CRM//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(now)}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${title.replace(/\n/g, '\\n')}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:提醒：${title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.slice(0, 20).replace(/[^\w一-龥]/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
