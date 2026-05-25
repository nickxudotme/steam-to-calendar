const SUPPORTED_CC = new Set(['US', 'CN', 'JP', 'GB', 'DE', 'FR', 'BR', 'CA', 'AU']);

export type SteamLocaleOptions = {
  cc: string;
  lang: string;
  uiLang: string;
};

export function steamLocaleFromRequest(request: Request): SteamLocaleOptions {
  const url = new URL(request.url);
  const explicitCc = normalizeCc(url.searchParams.get('cc'));
  const headerCc = normalizeCc(
    request.headers.get('x-vercel-ip-country')
      || request.headers.get('cf-ipcountry')
      || request.headers.get('x-country-code'),
  );
  const acceptLanguage = request.headers.get('accept-language') || '';

  return {
    cc: explicitCc || headerCc || 'US',
    lang: steamLangFromAcceptLanguage(acceptLanguage),
    uiLang: acceptLanguage.toLowerCase().includes('zh') ? 'zh-CN' : 'en',
  };
}

export function normalizeCc(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const cc = value.trim().toUpperCase();
  if (cc === 'UK') {
    return 'GB';
  }

  if (!/^[A-Z]{2}$/.test(cc) || cc === 'XX' || cc === 'T1') {
    return null;
  }

  return SUPPORTED_CC.has(cc) ? cc : null;
}

function steamLangFromAcceptLanguage(value: string): string {
  const lower = value.toLowerCase();

  if (lower.includes('zh-tw') || lower.includes('zh-hk')) {
    return 'tchinese';
  }

  if (lower.includes('zh')) {
    return 'schinese';
  }

  if (lower.includes('ja')) {
    return 'japanese';
  }

  if (lower.includes('ko')) {
    return 'koreana';
  }

  if (lower.includes('pt-br')) {
    return 'brazilian';
  }

  if (lower.includes('es-419') || lower.includes('es-mx')) {
    return 'latam';
  }

  return 'english';
}
