const KNOWN_DEV_SECRETS = [
  'development-only-change-me',
  'change-this-session-secret',
  'generate-a-long-random-secret',
  'replace-with-a-long-random-secret',
];

export function validateAdminEnv(): void {
  const problems: string[] = [];
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) problems.push('ADMIN_SESSION_SECRET 未设置');
  else if (KNOWN_DEV_SECRETS.includes(secret)) problems.push('ADMIN_SESSION_SECRET 仍是已知开发默认值，必须更换为随机长密钥');
  if (!process.env.ADMIN_EMAIL) problems.push('ADMIN_EMAIL 未设置');
  if (!process.env.ADMIN_PASSWORD_HASH) problems.push('ADMIN_PASSWORD_HASH 未设置（应为 argon2id 哈希）');
  if (!problems.length) return;
  const message = `管理员环境变量配置不完整：${problems.join('；')}`;
  if (process.env.NODE_ENV === 'production') throw new Error(message);
  console.warn(`[env] ${message}（非生产环境仅警告，生产环境将拒绝启动）`);
}

export function requireSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET 未配置，无法建立或校验管理员会话');
  return secret;
}
