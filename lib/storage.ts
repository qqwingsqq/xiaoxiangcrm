// 文件存储路径配置
// 支持本地开发和云平台部署

/**
 * 获取上传文件存储目录
 * - 本地开发: ./uploads
 * - Zeabur/云平台: /data/uploads (持久化存储)
 */
export function getUploadsDir(): string {
  const dataDir = process.env.DATA_DIR ?? '/data';
  const uploadsDir = process.env.UPLOADS_DIR ?? `${dataDir}/uploads`;
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
  return `${getUploadsDir()}/audio`;
}