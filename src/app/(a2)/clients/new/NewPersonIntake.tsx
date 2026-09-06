"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Sheet } from "../../../../components/a2/Sheet";
import {
  addPerson,
  continueToServices,
  type IntakeState,
} from "./actions";

const INITIAL_STATE: IntakeState = {
  status: "idle",
  caseId: null,
  contextId: null,
  name: "",
  email: "",
  notes: "",
  fields: [],
  matchCount: null,
  warning: null,
  error: null,
};

function ExtractButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="a2s-btn-primary a2s-matte" disabled={pending}>
      {pending ? "Extracting info..." : "Extract Info"}
    </button>
  );
}

function FindServicesButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="a2s-btn-primary a2s-matte a2s-intake-next"
      disabled={pending}
    >
      {pending ? "Opening referral profile..." : "Review Top 3 Referrals"}
    </button>
  );
}

export function NewPersonIntake({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const initialState: IntakeState = {
    ...INITIAL_STATE,
    error: initialError,
    status: initialError ? "error" : "idle",
  };
  const [state, formAction] = useActionState(addPerson, initialState);
  const extracted = state.status === "success";

  useEffect(() => {
    if (state.caseId) router.prefetch(`/clients/${state.caseId}/plan`);
  }, [router, state.caseId]);

  return (
    <div className="a2s-intake-layout">
      <Sheet note="Write naturally. The original notes are kept with the case.">
        <form action={formAction} className="a2s-form">
          <label className="a2s-form-row">
            <span className="a2s-spotlight-label">Name</span>
            <input
              className="a2s-field"
              name="name"
              required
              autoComplete="off"
              placeholder="A rough or first name is enough"
              defaultValue={state.name}
              disabled={extracted}
            />
          </label>

          <label className="a2s-form-row">
            <span className="a2s-spotlight-label">Email</span>
            <input
              className="a2s-field"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Only record it when email is safe"
              defaultValue={state.email}
              disabled={extracted}
            />
          </label>

          <label className="a2s-form-row a2s-intake-notes-row">
            <span className="a2s-spotlight-label">Call notes</span>
            <textarea
              className="a2s-field a2s-intake-notes"
              name="notes"
              required
              placeholder="Type what the caller tells you: where they are, immediate needs, children, pets, income, language, visa details, safety concerns, and how it is safe to contact them."
              defaultValue={state.notes}
              disabled={extracted}
            />
          </label>

          <div className="a2s-intake-form-footer">
            <p className="a2s-intake-helper">
              The system will turn these notes into the same fields used by the case database.
            </p>
            {!extracted && <ExtractButton />}
            {extracted && <span className="a2s-intake-complete">Info extracted</span>}
          </div>

          {state.error && (
            <p className="a2s-form-error" role="alert">
              {state.error}
            </p>
          )}
        </form>
      </Sheet>

      <aside className="a2s-intake-review" aria-live="polite">
        <Sheet note="Check the extracted details before searching.">
          <h2 className="a2s-intake-review-title">Extracted information</h2>

          {!extracted && (
            <div className="a2s-intake-empty">
              <span className="a2s-intake-empty-mark" aria-hidden="true">↗</span>
              <p>Extracted details will appear here.</p>
            </div>
          )}

          {extracted && (
            <>
              {state.warning && (
                <p className="a2s-intake-warning" role="alert">
                  {state.warning}
                </p>
              )}
              <dl className="a2s-intake-fields">
                {state.fields.map((field) => (
                  <div className="a2s-intake-field" key={field.key}>
                    <dt>{field.label}</dt>
                    <dd className={field.value ? undefined : "is-empty"}>
                      {field.value ?? "Not mentioned"}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="a2s-intake-match-ready">
                <span className="a2s-route-loading-dot" aria-hidden="true" />
                Top 3 prepared from {state.matchCount ?? 0} ranked services
              </p>

              <form action={continueToServices}>
                <input type="hidden" name="caseId" value={state.caseId ?? ""} />
                <input type="hidden" name="contextId" value={state.contextId ?? ""} />
                <FindServicesButton />
              </form>
            </>
          )}
        </Sheet>
      </aside>
    </div>
  );
}
