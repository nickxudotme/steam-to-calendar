import Script from "next/script";
import { Fragment } from "react";

const DEFAULT_UMAMI_SCRIPT_URL = "https://umami.nickxu.me/script.js";
const DEFAULT_UMAMI_RECORDER_URL = "https://umami.nickxu.me/recorder.js";
const DEFAULT_UMAMI_REPLAY_BLOCK_SELECTOR = ".manualSubscribeHint";
const DEFAULT_UMAMI_REPLAY_MAX_DURATION = "300000";
const DEFAULT_UMAMI_REPLAY_MASK_LEVEL = "moderate";
const DEFAULT_UMAMI_REPLAY_SAMPLE_RATE = "0.15";

function isReplayEnabled() {
  const value = process.env.NEXT_PUBLIC_UMAMI_REPLAY_ENABLED?.trim().toLowerCase();

  return value !== "0" && value !== "false";
}

export function UmamiAnalytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();

  if (!websiteId) {
    return null;
  }

  const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim() || DEFAULT_UMAMI_SCRIPT_URL;
  const recorderUrl =
    process.env.NEXT_PUBLIC_UMAMI_RECORDER_URL?.trim() || DEFAULT_UMAMI_RECORDER_URL;

  return (
    <Fragment>
      <Script async data-website-id={websiteId} src={scriptUrl} strategy="afterInteractive" />
      {isReplayEnabled() ? (
        <Script
          defer
          data-block-selector={
            process.env.NEXT_PUBLIC_UMAMI_REPLAY_BLOCK_SELECTOR?.trim() ||
            DEFAULT_UMAMI_REPLAY_BLOCK_SELECTOR
          }
          data-mask-level={
            process.env.NEXT_PUBLIC_UMAMI_REPLAY_MASK_LEVEL?.trim() ||
            DEFAULT_UMAMI_REPLAY_MASK_LEVEL
          }
          data-max-duration={
            process.env.NEXT_PUBLIC_UMAMI_REPLAY_MAX_DURATION?.trim() ||
            DEFAULT_UMAMI_REPLAY_MAX_DURATION
          }
          data-sample-rate={
            process.env.NEXT_PUBLIC_UMAMI_REPLAY_SAMPLE_RATE?.trim() ||
            DEFAULT_UMAMI_REPLAY_SAMPLE_RATE
          }
          data-website-id={websiteId}
          src={recorderUrl}
          strategy="afterInteractive"
        />
      ) : null}
    </Fragment>
  );
}
