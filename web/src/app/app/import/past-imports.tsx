"use client";

import { useActionState } from "react";

import { Card, Notice, formatDate } from "@/components/app/ui";
import { FilteredTable } from "@/components/app/filtered-table";
import { ConfirmButton } from "@/components/app/confirm-button";
import { undoImportAction, type UndoImportState } from "./actions";

const INITIAL: UndoImportState = { error: null, message: null };

export type ImportRun = {
  id: string;
  created_at: string;
  filename: string | null;
  source: string;
  status: string;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
};

/**
 * What has been imported, searchable, with a way back out of a mistake.
 *
 * The list only grows, and a gym importing monthly has a screen of rows within
 * a year, so it is searchable by filename and filterable by how the import
 * ended. Undo lives on the row rather than behind a settings page because the
 * moment somebody wants it is the moment they are looking at the row that went
 * wrong.
 */
export function PastImports({
  runs,
  canUndo,
}: {
  runs: ImportRun[];
  canUndo: boolean;
}) {
  const [state, undo, undoing] = useActionState(undoImportAction, INITIAL);

  if (runs.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="display mb-1 text-[1.25rem]">Past imports</h2>
      <p className="mb-4 text-[0.9375rem] text-graphite">
        Every file casdey has read. Undoing one removes the members it added, as
        long as casdey has not written to them yet. It cannot put back what an
        import overwrote, so members it updated keep the values it wrote.
      </p>

      {state.error ? (
        <div className="mb-4">
          <Notice tone="warn">{state.error}</Notice>
        </div>
      ) : null}
      {state.message ? (
        <div className="mb-4">
          <Notice>{state.message}</Notice>
        </div>
      ) : null}

      <Card>
        <FilteredTable
          columns={
            canUndo
              ? ["When", "File", "Added", "Updated", "Skipped", ""]
              : ["When", "File", "Added", "Updated", "Skipped"]
          }
          searchPlaceholder="Search by file name"
          groupLabel="Result"
          groups={[
            { value: "completed", label: "Completed" },
            { value: "failed", label: "Failed" },
          ]}
          emptyMessage="No import matches that."
          rows={runs.map((run) => {
            const name = run.filename ?? run.source;
            const cells = [
              <span key="when" className="literal text-[0.8125rem]">
                {formatDate(run.created_at)}
              </span>,
              <span key="file" className="block max-w-[16rem] truncate">
                {name}
              </span>,
              <span key="a" className="literal">
                {run.imported_count}
              </span>,
              <span key="u" className="literal">
                {run.updated_count}
              </span>,
              <span key="s" className="literal">
                {run.skipped_count}
              </span>,
            ];

            if (canUndo) {
              cells.push(
                run.imported_count === 0 ? (
                  <span key="undo" className="text-[0.8125rem] text-stone">
                    added nobody
                  </span>
                ) : (
                  <span key="undo" className="whitespace-nowrap">
                    <form
                      id={`undo-${run.id}`}
                      action={undo}
                      className="contents"
                    >
                      <input type="hidden" name="importId" value={run.id} />
                    </form>
                    <ConfirmButton
                      disabled={undoing}
                      formId={`undo-${run.id}`}
                      confirmLabel="Undo this import"
                      title="Undo this import?"
                      body={
                        <>
                          casdey removes the{" "}
                          <strong>{run.imported_count}</strong>{" "}
                          {run.imported_count === 1 ? "member" : "members"} this
                          file added, and only the ones nothing has happened to
                          yet: anyone casdey has written to, who came back, or
                          who has a booking stays. It cannot put back what the
                          import overwrote, so members it merely updated keep
                          the values it wrote.
                        </>
                      }
                      className="text-[0.8125rem] whitespace-nowrap text-stone underline underline-offset-4 hover:text-ink"
                    >
                      Undo
                    </ConfirmButton>
                  </span>
                ),
              );
            }

            return {
              id: run.id,
              group: run.status,
              haystack: `${name} ${formatDate(run.created_at)} ${run.status}`,
              cells,
            };
          })}
        />
      </Card>
    </section>
  );
}
