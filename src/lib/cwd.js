/**
 * cwd 路径映射与 projectKey（SPEC §3.6 + docs/format.md §1）
 */
// Windows <-> WSL 单条映射
export function convertCwd(cwd, direction, mapRules = []) {
  if (direction === 'auto') direction = detectDirection(cwd);
  // 自定义映射（最长前缀优先）
  for (const rule of mapRules) {
    const [src, dst] = rule;
    if (cwd.startsWith(src)) return dst + cwd.slice(src.length);
    if (cwd.startsWith(dst)) return src + cwd.slice(dst.length);
  }
  if (direction === 'to-wsl') {
    const m = cwd.match(/^([A-Za-z]):\\(.*)$/);
    if (m) return '/mnt/' + m[1].toLowerCase() + '/' + m[2].replace(/\\/g, '/');
    return cwd;
  }
  const m = cwd.match(/^\/mnt\/([a-z])\/(.*)$/);
  if (m) return m[1].toUpperCase() + ':\\' + m[2].replace(/\//g, '\\');
  return cwd;
}

export function detectDirection(cwd) {
  if (/^[A-Za-z]:\\/.test(cwd)) return 'to-wsl';
  if (/^\/mnt\/[a-z]\//.test(cwd)) return 'to-win';
  return null;
}

export function projectKey(cwd) {
  let out = '';
  let sep = false;
  for (const ch of cwd) {
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!sep) out += '-';
      sep = true;
    } else if (/^[A-Za-z0-9._-]$/.test(ch) && ch !== '~') {
      out += ch; sep = false;
    } else {
      out += '~' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
      sep = false;
    }
  }
  const slug = out.replace(/^-+/, '') || 'root';
  return '--' + slug.slice(0, 251) + '--';
}
