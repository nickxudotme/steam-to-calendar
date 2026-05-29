"use client";

import type { ReactNode } from "react";

export function SourceToggle({
  children,
  checked,
  controlsId,
  description,
  isExpanded,
  onChange,
  onToggleOptions,
  statusLabel,
  title,
}: {
  children?: ReactNode;
  controlsId?: string;
  checked: boolean;
  description?: string;
  isExpanded?: boolean;
  onChange: (checked: boolean) => void;
  onToggleOptions?: () => void;
  statusLabel?: string;
  title: string;
}) {
  return (
    <div className="sourceCard">
      <div className="sourceTitleRow">
        {onToggleOptions ? (
          <button
            aria-controls={controlsId}
            aria-expanded={isExpanded}
            className="sourceDisclosureButton"
            type="button"
            onClick={onToggleOptions}
          >
            <h3>{title}</h3>
            <i aria-hidden="true" className="disclosureArrow" />
          </button>
        ) : (
          <div>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
        )}
        <label className="switch">
          <input
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            type="checkbox"
          />
          <span />
        </label>
      </div>
      {description || statusLabel ? (
        <div className="sourceCardMeta">
          {statusLabel ? <span className="sourceStatusPill">{statusLabel}</span> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
