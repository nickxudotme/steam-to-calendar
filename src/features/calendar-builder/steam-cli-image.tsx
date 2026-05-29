"use client";

import { useState } from "react";

export function SteamCliImage({
  fallbackClassName,
  src,
}: {
  fallbackClassName: string;
  src?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const shouldShowImage = Boolean(src && failedSrc !== src);

  if (!shouldShowImage) {
    return <span className={fallbackClassName} />;
  }

  return <img src={src} alt="" onError={() => setFailedSrc(src ?? null)} />;
}
