"use client";

import { useState } from "react";
import { Sheet } from "../Sheet";
import { Empty } from "../Empty";
import { keepAltEmailDraft } from "../../../app/(a2)/clients/[id]/plan/actions";

/**
 * Step 3 — the email to an alternative community service. The body arrives
 * prewritten from her approved summary and the chosen service's stored facts;
 * the worker edits it and keeps it as a draft. Nothing is transmitted.
 */
export function AltServiceEmail({
  caseId,
  serviceId,
  serviceName,
  subject,
  body,
  known,
  firstName,
}: {
  caseId: string;
  serviceId: string | null;
  serviceName: string | null;
  subject: string;
  body: string;
  known: { label: string; value: string }[];
  firstName: string;
}) {
  const [text, setText] = useState(body);

  if (!serviceId) {
    return (
      <Sheet title="3 · Email an alternative service" note="Nothing is sent from this screen.">
        <Empty>
          Pick a service from the list above and the email is written for you here.
        </Empty>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={`3 · Email ${serviceName}`}
      note="Prewritten from her approved summary and this service's stored facts. Nothing is sent."
    >
      <p className="a2s-dim" style={{ marginTop: 0 }}>
        Subject · {subject}
      </p>
      <form action={keepAltEmailDraft}>
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="serviceId" value={serviceId} />
        <textarea
          className="a2s-field"
          name="body"
          rows={16}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label={`Email to ${serviceName}`}
          style={{ fontFamily: "inherit", lineHeight: 1.55, width: "100%" }}
        />
        <div className="a2s-btn-row" style={{ marginTop: 12 }}>
          <button type="submit" className="a2s-btn-primary">
            Keep as draft
          </button>
          <button
            type="button"
            className="a2s-matte a2s-btn a2s-btn-sm"
            onClick={() => setText(body)}
          >
            Reset to the prewritten draft
          </button>
        </div>
      </form>

      {known.length > 0 && (
        <>
          <p className="a2s-spotlight-label" style={{ marginTop: 18 }}>
            What we know about {firstName}
          </p>
          <ul className="a2s-rail-rows">
            {known.map((item) => (
              <li key={item.label}>
                <span className="a2s-rail-top">
                  <span className="a2s-rail-name" style={{ fontSize: 14 }}>
                    {item.label}
                  </span>
                </span>
                <span className="a2s-dim">{item.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
