const DEFAULT_STEAM_STORE_TIME_ZONE = "America/Los_Angeles";

const STEAM_STORE_TIME_ZONE_BY_REGION: Record<string, string> = {
  AE: "Asia/Dubai",
  AR: "America/Argentina/Buenos_Aires",
  AT: "Europe/Vienna",
  AU: "Australia/Sydney",
  BE: "Europe/Brussels",
  BR: "America/Sao_Paulo",
  CA: "America/Toronto",
  CH: "Europe/Zurich",
  CL: "America/Santiago",
  CN: "Asia/Shanghai",
  CO: "America/Bogota",
  CZ: "Europe/Prague",
  DE: "Europe/Berlin",
  DK: "Europe/Copenhagen",
  ES: "Europe/Madrid",
  FI: "Europe/Helsinki",
  FR: "Europe/Paris",
  GB: "Europe/London",
  HK: "Asia/Hong_Kong",
  HU: "Europe/Budapest",
  ID: "Asia/Jakarta",
  IN: "Asia/Kolkata",
  IT: "Europe/Rome",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  MX: "America/Mexico_City",
  MY: "Asia/Kuala_Lumpur",
  NL: "Europe/Amsterdam",
  NO: "Europe/Oslo",
  NZ: "Pacific/Auckland",
  PE: "America/Lima",
  PH: "Asia/Manila",
  PL: "Europe/Warsaw",
  RO: "Europe/Bucharest",
  SA: "Asia/Riyadh",
  SE: "Europe/Stockholm",
  SG: "Asia/Singapore",
  TH: "Asia/Bangkok",
  TR: "Europe/Istanbul",
  TW: "Asia/Taipei",
  UA: "Europe/Kyiv",
  US: DEFAULT_STEAM_STORE_TIME_ZONE,
  VN: "Asia/Ho_Chi_Minh",
  ZA: "Africa/Johannesburg",
};

export function steamStoreTimeZone(regionCode?: string): string {
  const normalizedRegionCode = regionCode?.trim().toUpperCase();

  return normalizedRegionCode
    ? (STEAM_STORE_TIME_ZONE_BY_REGION[normalizedRegionCode] ?? DEFAULT_STEAM_STORE_TIME_ZONE)
    : DEFAULT_STEAM_STORE_TIME_ZONE;
}

export function steamStoreLocalIsoDate(unixSeconds: number, timeZone: string): string {
  const parts = zonedDateTimeParts(unixSeconds, timeZone);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function steamStoreDiscountEndExclusiveIsoDate(
  unixSeconds: number,
  timeZone: string,
  addDays: (isoDate: string, days: number) => string,
): string {
  const parts = zonedDateTimeParts(unixSeconds, timeZone);
  const localEndDate = `${parts.year}-${parts.month}-${parts.day}`;

  return parts.hour === "00" && parts.minute === "00" && parts.second === "00"
    ? localEndDate
    : addDays(localEndDate, 1);
}

function zonedDateTimeParts(
  unixSeconds: number,
  timeZone: string,
): { day: string; hour: string; minute: string; month: string; second: string; year: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date(unixSeconds * 1000));

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "00";

  return {
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    month: part("month"),
    second: part("second"),
    year: part("year"),
  };
}
