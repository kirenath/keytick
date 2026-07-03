/**
 * 规范化 base URL：
 * - 去掉首尾空白与结尾的 `/`
 * - 兼容用户输入带或不带 `/v1` 结尾（统一去掉）
 */
export function normalizeBaseUrl(input: string): string {
  let url = input.trim()
  url = url.replace(/\/+$/, '')
  url = url.replace(/\/v1$/i, '')
  return url
}
