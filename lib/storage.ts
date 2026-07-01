// 文件存储路径配置
// Vercel 部署：使用 /tmp 临时存储（Vercel 无持久化文件系统）
// 本地开发：使用 ./uploads

import fs from 'fs';

/**
 * 获取上传文件存储目录
 * - Vercel 部署: /tmp/uploads（临时存储，函数实例间不共享）
 * - 本地开发: ./uploads
 */
export function getUploadsDir(): string {
  const isVercel = !!process.env.VERCEL;
  const uploadsDir = process.env.UPLOADS_DIR ?? (isVercel ? '/tmp/uploads' : './uploads');
  // 确保目录存在
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

/**
 * 获取上传文件完整路径
 */
export function getUploadFilePath(filename: string): string {
  return `${getUploadsDir()}/${filename}`;
}

/**
 * 获取音频文件存储目录
 */
export function getAudioDir(): string {
  const dir = `${getUploadsDir()}/audio`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}