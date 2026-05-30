import { headers } from "next/headers";
import { CalendarBuilderPage } from "@/features/calendar-builder/calendar-builder-page";
import { languageCodeFromAcceptLanguage } from "@/features/calendar-builder/browser-locale";

export default async function Home() {
  const requestHeaders = await headers();
  const initialLanguage = languageCodeFromAcceptLanguage(requestHeaders.get("accept-language"));

  return <CalendarBuilderPage initialLanguageCode={initialLanguage.code} />;
}
