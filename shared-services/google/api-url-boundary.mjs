export function assertAllowedGoogleApiUrl(url) {
  const parsed = new URL(String(url));
  const allowed = parsed.protocol === 'https:' && (
    (parsed.hostname === 'sheets.googleapis.com' && parsed.pathname.startsWith('/v4/spreadsheets'))
    || (parsed.hostname === 'www.googleapis.com' && parsed.pathname.startsWith('/drive/v3/'))
    || (parsed.hostname === 'www.googleapis.com' && parsed.pathname.startsWith('/upload/drive/v3/'))
  );
  if (!allowed) throw new Error(`허용되지 않은 Google API URL입니다: ${parsed.hostname}${parsed.pathname}`);
  return parsed;
}
