import path from 'path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export async function extractTextFromBuffer(buffer: Buffer, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.txt' || ext === '.md' || ext === '.csv') {
    return buffer.toString('utf-8');
  }

  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      lines.push(`【工作表：${sheetName}】`);
      const sheet = workbook.Sheets[sheetName];
      lines.push(XLSX.utils.sheet_to_csv(sheet));
    }
    return lines.join('\n');
  }

  if (ext === '.pptx') {
    const zip = await JSZip.loadAsync(buffer);
    const texts: string[] = [];
    const slideFiles = Object.keys(zip.files)
      .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort();
    for (const slideFile of slideFiles) {
      const xml = await zip.files[slideFile].async('string');
      const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
      const slideText = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
      if (slideText.trim()) texts.push(slideText);
    }
    return texts.join('\n');
  }

  if (ext === '.ppt') {
    return buffer.toString('latin1')
      .replace(/[^\x20-\x7E一-龥　-〿＀-￯]/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 8000);
  }

  if (ext === '.pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
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

// Legacy file-path version (for local use / existing analyze route)
import fs from 'fs';
export async function extractText(filePath: string, originalName: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  return extractTextFromBuffer(buffer, originalName);
}
