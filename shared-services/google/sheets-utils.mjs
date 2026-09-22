export const colL = (n) => { let s = ''; n++; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; } return s; };
export const num = (v) => Number(String(v ?? '').replace(/[,\s원]/g, '')) || 0;
export const serial2date = (s) => new Date((Number(s) - 25569) * 864e5).toISOString().slice(0, 10);
export const date2serial = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5);
