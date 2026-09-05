"use client";

import Papa from "papaparse";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, CardTitle } from "./ui";
import { guessMapping, headerOffset, normalizeRow } from "@/lib/ingestion/csv";
import type {
  ColumnMapping,
  DateFormat,
  RowIssue,
} from "@/lib/ingestion/types";

/**
 * Upload, map, check, import.
 *
 * The file is parsed in the browser first, purely to learn the column names and
 * show the gym what their data will look like once read. Nothing is sent
 * anywhere during that step. The file only leaves the browser when they press
 * the final button, and the server parses it again from scratch rather than
 * trusting anything computed here.
 */

type Step = "choose" | "map" | "done";

type Summary = {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  issues: RowIssue[];
};

const FIELDS: {
  key: keyof ColumnMapping;
  label: string;
  hint: string;
  required?: boolean;
}[] = [
  { key: "lastVisitAt", label: "Last visit date", hint: "Required. This is what lapse is measured from.", required: true },
  { key: "email", label: "Email", hint: "Needed to contact them. A member without one still counts." },
  { key: "externalRef", label: "Member reference", hint: "Their id in your software. Keeps repeat imports from duplicating." },
  { key: "firstName", label: "First name", hint: "" },
  { key: "lastName", label: "Surname", hint: "" },
  { key: "fullName", label: "Full name", hint: "Only if your file has one name column instead of two." },
  { key: "phone", label: "Phone", hint: "Optional. Stored on the member record." },
  { key: "visitCount", label: "Number of visits", hint: "If missing, every member counts as one visit." },
];

const DATE_FORMATS: { value: DateFormat; label: string; example: string }[] = [
  { value: "dmy", label: "Day first", example: "05/03/2024 is 5 March" },
  { value: "iso", label: "Year first", example: "2024-03-05" },
  { value: "mdy", label: "Month first", example: "03/05/2024 is 5 March" },
];

export function ImportWizard() {
  const router = useRouter();
  const id = useId();

  const [step, setStep] = useState<Step>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sample, setSample] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [dateFormat, setDateFormat] = useState<DateFormat>("dmy");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  function onFile(chosen: File) {
    setError(null);
    setFile(chosen);

    Papa.parse<Record<string, string>>(chosen, {
      header: true,
      skipEmptyLines: "greedy",
      // Mirrors the server: a report title above the table would otherwise
      // become the header here too, and the gym would be asked to map a
      // single column called "Client Attendance Report".
      beforeFirstChunk: (chunk) => {
        const skip = headerOffset(chunk);
        return skip ? chunk.split(/\r?\n/).slice(skip).join("\n") : chunk;
      },
      // Only enough rows to show them what we read. The rest stays on disk.
      preview: 6,
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        const found = (result.meta.fields ?? []).filter(Boolean);
        if (found.length === 0) {
          setError("We could not find a header row in that file.");
          return;
        }
        setHeaders(found);
        setSample(result.data);
        setMapping(guessMapping(found));
        setStep("map");
      },
      error: () => setError("We could not read that file."),
    });
  }

  function setField(field: keyof ColumnMapping, column: string) {
    setMapping((current) => {
      const next = { ...current };
      if (column) next[field] = column;
      else delete next[field];
      return next;
    });
  }

  async function onImport() {
    if (!file || !mapping.lastVisitAt) return;
    setBusy(true);
    setError(null);

    const body = new FormData();
    body.set("file", file);
    body.set("mapping", JSON.stringify(mapping));
    body.set("dateFormat", dateFormat);

    try {
      const response = await fetch("/api/import", { method: "POST", body });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "The import failed.");
        setBusy(false);
        return;
      }

      setSummary(payload as Summary);
      setStep("done");
      // The dashboard and member counts are stale the moment this lands.
      router.refresh();
    } catch {
      setError("We could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  /* --- Preview of the mapping, computed with the same code the server uses --- */
  const preview = mapping.lastVisitAt
    ? sample
        .slice(0, 5)
        .map((row, index) =>
          normalizeRow(row, mapping as ColumnMapping, dateFormat, index + 2),
        )
    : [];
  const previewOk = preview.filter((r) => r.ok).length;

  if (step === "done" && summary) {
    return (
      <Card>
        <CardTitle>Import finished</CardTitle>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure label="Rows read" value={summary.total} />
          <Figure label="Added" value={summary.imported} />
          <Figure label="Updated" value={summary.updated} />
          <Figure label="Skipped" value={summary.skipped} />
        </dl>

        {summary.issues.length > 0 ? (
          <details className="mt-6">
            <summary className="cursor-pointer text-[0.9375rem] font-semibold text-graphite">
              Why {summary.skipped} were skipped
            </summary>
            <ul className="mt-3 space-y-1">
              {summary.issues.map((issue) => (
                <li
                  key={`${issue.row}-${issue.field}`}
                  className="literal text-[0.8125rem] text-stone"
                >
                  {issue.row > 0 ? `Row ${issue.row}: ` : ""}
                  {issue.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="mt-6 flex gap-2">
          <Button onClick={() => router.push("/app/members")}>
            See who has gone quiet
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              setStep("choose");
              setFile(null);
              setSummary(null);
            }}
          >
            Import another file
          </Button>
        </div>
      </Card>
    );
  }

  if (step === "choose") {
    return (
      <Card>
        <CardTitle>Upload your member list</CardTitle>
        <p className="mt-1 mb-5 text-[0.9375rem] text-graphite">
          A CSV export from your gym software. It needs one row per member
          and a column with their last visit date. Nothing is uploaded until you
          have checked the columns on the next screen.
        </p>

        <label
          htmlFor={`${id}-file`}
          className="lift flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border border-dashed border-ash bg-paper px-6 py-10 text-center"
        >
          <span className="text-[0.9375rem] font-semibold text-ink">
            Choose a CSV file
          </span>
          <span className="text-[0.875rem] text-stone">
            Up to 12 MB. It stays in your browser until you press import.
          </span>
        </label>
        <input
          id={`${id}-file`}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) onFile(chosen);
          }}
        />

        {error ? (
          <p role="alert" className="notice notice-error mt-4">
            {error}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Which column is which</CardTitle>
        <p className="mt-1 mb-5 text-[0.9375rem] text-graphite">
          We guessed from your headers. Correct anything that is wrong.{" "}
          <span className="literal text-stone">{file?.name}</span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label
                htmlFor={`${id}-${field.key}`}
                className="field-label"
              >
                {field.label}
                {field.required ? (
                  <span className="text-teal"> *</span>
                ) : null}
              </label>
              <select
                id={`${id}-${field.key}`}
                className="field"
                value={mapping[field.key] ?? ""}
                onChange={(event) => setField(field.key, event.target.value)}
              >
                <option value="">Not in my file</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
              {field.hint ? <p className="field-hint">{field.hint}</p> : null}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>How dates are written in your file</CardTitle>
        <p className="mt-1 mb-4 text-[0.9375rem] text-graphite">
          03/04/2024 is the 3rd of April in the UK and the 4th of March in the
          US. We will not guess: the wrong choice moves every member&apos;s
          last visit by months.
        </p>
        <div className="flex flex-wrap gap-2">
          {DATE_FORMATS.map((format) => (
            <button
              key={format.value}
              type="button"
              onClick={() => setDateFormat(format.value)}
              aria-pressed={dateFormat === format.value}
              className={`rounded-[10px] border px-4 py-2.5 text-left transition-[transform,border-color] duration-200 hover:-translate-y-px ${
                dateFormat === format.value
                  ? "border-teal bg-shallow"
                  : "border-ash bg-white"
              }`}
            >
              <span className="block text-[0.9375rem] font-semibold text-ink">
                {format.label}
              </span>
              <span className="literal block text-[0.75rem] text-stone">
                {format.example}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>What we read</CardTitle>
        {!mapping.lastVisitAt ? (
          <p className="mt-1 text-[0.9375rem] text-graphite">
            Choose the last visit date column to see a preview.
          </p>
        ) : (
          <>
            <p className="mt-1 mb-4 text-[0.9375rem] text-graphite">
              The first {preview.length} rows of your file, as casdey reads
              them. If the dates look wrong, change the format above.
            </p>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Last visit</th>
                    <th>Visits</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((result, index) =>
                    result.ok ? (
                      <tr key={index}>
                        <td>
                          {[result.member.firstName, result.member.lastName]
                            .filter(Boolean)
                            .join(" ") || "no name"}
                        </td>
                        <td className="literal text-[0.8125rem]">
                          {result.member.email ?? "none"}
                        </td>
                        <td className="literal text-[0.8125rem]">
                          {result.member.lastVisitAt}
                        </td>
                        <td className="literal text-[0.8125rem]">
                          {result.member.visitCount}
                        </td>
                      </tr>
                    ) : (
                      <tr key={index}>
                        <td colSpan={4} className="text-[0.8125rem] text-stone">
                          {result.issue.row > 0
                            ? `Row ${result.issue.row} would be skipped: `
                            : "Would be skipped: "}
                          {result.issue.reason}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {error ? (
        <p role="alert" className="notice notice-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onImport}
          disabled={busy || !mapping.lastVisitAt || previewOk === 0}
        >
          {busy ? "Importing" : "Import these members"}
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            setStep("choose");
            setFile(null);
            setError(null);
          }}
        >
          Choose a different file
        </Button>
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="label text-stone">{label}</dt>
      <dd className="literal mt-1 text-[1.5rem] leading-none font-medium text-ink">
        {value}
      </dd>
    </div>
  );
}
