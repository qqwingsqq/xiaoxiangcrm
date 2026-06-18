import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export async function extractText(filePath: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  // Plain text
  if (ext === '.txt' || ext === '.md' || ext === '.csv') {
    return buffer.toString('utf-8');
  }

  // Word documents
  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Excel
  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      lines.push(`【工作表：${sheetName}】`);
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_csv(sheet);
      lines.push(rows);
    }
    return lines.join('\n');
  }

  // PowerPoint (.pptx = zip with XML)
  if (ext === '.pptx') {
    const zip = await JSZip.loadAsync(buffer);
    const texts: string[] = [];
    const slideFiles = Object.keys(zip.files)
      .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort();
    for (const slideFile of slideFiles) {
      const xml = await zip.files[slideFile].async('string');
      // Extract text from XML tags
      const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
      const slideText = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
      if (slideText.trim()) texts.push(slideText);
    }
    return texts.join('\n');
  }

  // PPT old format - basic extraction
  if (ext === '.ppt') {
    return buffer.toString('latin1')
      .replace(/[^\x20-\x7E一-龥　-〿＀-￯]/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 8000);
  }

  throw new Error(`不支持的文件类型: ${ext}`);
}

export function isImageFile(filename: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(filename);
}

export const ALLOWED_EXTENSIONS = [
  '.txt', '.md', '.csv',
  '.doc', '.docx',
  '.xls', '.xlsx',
  '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.pdf',
];
