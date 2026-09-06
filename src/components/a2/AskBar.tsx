"use client";

import Link from "next/link";
import { useState } from "react";
import { ASK_PLACEHOLDER } from "../../lib/a2-mock";
import { ReturnGlyph, SearchGlyph } from "./glyphs";

/** One searchable client — a lightweight directory row from the cases table. */
export type DirectoryClient = {
  id: string;
  name: string;
  ref: string;
  status: string;
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/**
 * Spotlight / Bar on Today (136:139). Typing a client's name or case ref
 * filters the real casework directory below the bar; each match opens her
 * profile. (A2 / Today · search 138:2.)
 */
export function AskBar({ clients }: { clients: DirectoryClient[] }) {
  const [value, setValue] = useState("");
  const query = value.trim().toLowerCase();
  const searching = query.length > 1;
  const matches = searching
    ? clients.filter((client) => `${client.name} ${client.ref}`.toLowerCase().includes(query)).slice(0, 8)
    : [];

  return (
    <>
      <div className="a2s-ask a2s-matte">
        <SearchGlyph />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={ASK_PLACEHOLDER}
          aria-label={ASK_PLACEHOLDER}
        />
        <button type="button" className="a2s-ask-go" aria-label="Run">
          <ReturnGlyph />
        </button>
      </div>

      {searching && (
        <div className="a2s-results" data-testid="a2-search-result">
          {matches.length === 0 ? (
            <p className="a2s-dim">No client matches “{value.trim()}”.</p>
          ) : (
            <div className="a2s-result-list">
              {matches.map((client) => (
                <Link
                  className="a2s-result-row"
                  href={`/clients/${client.id}`}
                  key={client.id}
                >
                  <span className="a2s-avatar">{initialsOf(client.name)}</span>
                  <span className="a2s-row-text">
                    <span className="a2s-result-name">{client.name}</span>
                    <span className="a2s-result-line">
                      {client.ref} · {client.status === "closed" ? "Closed" : "Open case"}
                    </span>
                  </span>
                  <span className="a2s-result-open">Open profile →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
