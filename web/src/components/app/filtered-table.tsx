"use client";

import { useMemo, useState } from "react";

/**
 * A search box and a category filter over a table that only grows.
 *
 * The audit log and the import history are both append-only by design: nothing
 * in either can be edited or deleted, which is exactly what makes them worth
 * having and also what makes them unreadable after a few months. A gym asking
 * "who deleted that member, and when" should not be scrolling.
 *
 * Filtering happens in the browser over rows already on the page, which is the
 * right trade at this size: these lists are hundreds of rows, not millions, and
 * a round trip per keystroke would be slower and more code. When a gym's log
 * outgrows one page, this becomes a server-side query and this component keeps
 * its shape.
 */

export type FilterableRow = {
  id: string;
  /** Everything the search box should look inside, already flattened. */
  haystack: string;
  /** Which group this belongs to, for the dropdown. Null hides it from it. */
  group?: string | null;
  cells: React.ReactNode[];
};

export function FilteredTable({
  columns,
  rows,
  groupLabel,
  groups,
  searchPlaceholder,
  emptyMessage,
}: {
  columns: string[];
  rows: FilterableRow[];
  /** e.g. "Action" or "Result". Omit to hide the dropdown entirely. */
  groupLabel?: string;
  /** value -> label, in the order they should appear. */
  groups?: { value: string; label: string }[];
  searchPlaceholder: string;
  emptyMessage: string;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (group && row.group !== group) return false;
      if (!needle) return true;
      return row.haystack.toLowerCase().includes(needle);
    });
  }, [rows, query, group]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          className="field max-w-[20rem]"
          aria-label={searchPlaceholder}
        />

        {groupLabel && groups && groups.length > 0 ? (
          <select
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            aria-label={groupLabel}
            className="field w-auto"
          >
            <option value="">Everything</option>
            {groups.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}

        {query || group ? (
          <>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setGroup("");
              }}
              className="text-[0.875rem] text-stone underline underline-offset-4 hover:text-ink"
            >
              Clear
            </button>
            <span className="text-[0.875rem] text-stone">
              {filtered.length} of {rows.length}
            </span>
          </>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="text-[0.9375rem] text-graphite">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  {row.cells.map((cell, index) => (
                    <td key={index}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
