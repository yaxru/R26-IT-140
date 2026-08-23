"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAuthHeaders } from "@/shared/auth";
import type {
  BulkCreateWorkersResponse,
  WorkerAccountCreated,
} from "@/shared/auth/types";

interface ParsedWorker {
  firstName: string;
  workerId: string;
  lineId: string;
}

interface ImportResult {
  created: WorkerAccountCreated[];
  failed: { workerId?: string; reason: string }[];
  summary: { total: number; created: number; failed: number };
}

export default function WorkforcePage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<ParsedWorker[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);

  // ──────────────────────────────────────────────────────────────────────
  // Parse CSV file
  // ──────────────────────────────────────────────────────────────────────
  const parseCSV = (csvText: string): ParsedWorker[] => {
    const lines = csvText
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    if (lines.length < 2) {
      throw new Error("CSV file must contain header and at least one row");
    }

    // Skip header and parse rows
    const workers: ParsedWorker[] = [];
    for (let i = 1; i < lines.length; i++) {
      const [firstName, workerId, lineId] = lines[i]
        .split(",")
        .map((v) => v.trim());

      if (firstName && workerId && lineId) {
        workers.push({ firstName, workerId, lineId });
      }
    }

    if (workers.length === 0) {
      throw new Error("No valid worker records found in CSV");
    }

    return workers;
  };

  // ──────────────────────────────────────────────────────────────────────
  // Handle file selection
  // ──────────────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setImportResult(null);

      try {
        const text = await file.text();
        const workers = parseCSV(text);

        if (workers.length > 100) {
          setError(`Too many workers: ${workers.length}. Maximum is 100.`);
          setPreviewData([]);
          return;
        }

        setPreviewData(workers);
        setShowImportModal(true);
      } catch (err) {
        setError(
          `Failed to parse CSV: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        setPreviewData([]);
      }
    },
    [],
  );

  // ──────────────────────────────────────────────────────────────────────
  // Submit import request to Edge Function
  // ──────────────────────────────────────────────────────────────────────
  const handleImportWorkers = useCallback(async () => {
    if (previewData.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      const headers = await getAuthHeaders(supabase);
      if (!headers.Authorization) {
        throw new Error("Not authenticated. Please log in.");
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error("Supabase URL not configured");
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/bulk-create-workers`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ workers: previewData }),
        },
      );

      const result: BulkCreateWorkersResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || `Failed to create workers (${response.status})`,
        );
      }

      setImportResult(result as ImportResult);
      setPreviewData([]);
      setShowImportModal(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(
        `Import failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setImporting(false);
    }
  }, [previewData, supabase]);

  // ──────────────────────────────────────────────────────────────────────
  // Render credential card for printing
  // ──────────────────────────────────────────────────────────────────────
  const CredentialCard = ({ worker }: { worker: WorkerAccountCreated }) => (
    <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-800 p-4 text-center w-64 break-inside-avoid">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">
        Worker Credentials
      </p>
      <div className="border border-zinc-200 dark:border-zinc-700 p-3 mb-3">
        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {worker.firstName}
        </p>
        <p className="text-xs font-mono text-zinc-500 mt-1">
          ID: {worker.workerId}
        </p>
        <p className="text-xs font-mono text-zinc-500">Line: {worker.lineId}</p>
      </div>
      <div className="bg-zinc-100 dark:bg-zinc-800 p-2 mb-3">
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase">
          Email
        </p>
        <p className="text-xs font-mono break-all text-zinc-900 dark:text-zinc-100">
          {worker.email}
        </p>
      </div>
      <div className="bg-emerald-100 dark:bg-emerald-900 p-2">
        <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono uppercase">
          PIN (Keep Secret)
        </p>
        <p className="text-2xl font-mono font-bold text-emerald-900 dark:text-emerald-100">
          {worker.plainTextPin}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Workforce
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Worker Account Management
        </h1>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-wider mb-1">
            Error
          </p>
          {error}
        </div>
      )}

      {/* Import Section */}
      <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Import Workers
        </h2>

        <div className="space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Upload a CSV file with columns:{" "}
            <code className="font-mono">firstName, workerId, lineId</code>
          </p>

          <div className="flex gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
            >
              Select CSV File
            </button>
            {previewData.length > 0 && (
              <p className="text-xs text-zinc-500 self-center">
                {previewData.length} worker(s) ready to import
              </p>
            )}
          </div>

          {/* Import Summary */}
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/50 p-3">
                  <p className="text-[10px] font-mono text-emerald-600 uppercase mb-1">
                    Created
                  </p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {importResult.summary.created}
                  </p>
                </div>
                <div className="bg-red-500/10 border border-red-500/50 p-3">
                  <p className="text-[10px] font-mono text-red-600 uppercase mb-1">
                    Failed
                  </p>
                  <p className="text-2xl font-bold text-red-400">
                    {importResult.summary.failed}
                  </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/50 p-3">
                  <p className="text-[10px] font-mono text-blue-600 uppercase mb-1">
                    Total
                  </p>
                  <p className="text-2xl font-bold text-blue-400">
                    {importResult.summary.total}
                  </p>
                </div>
              </div>

              {/* Failed Records */}
              {importResult.failed.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/30 p-4">
                  <p className="text-xs font-mono text-red-400 uppercase mb-3">
                    Failed Records
                  </p>
                  <ul className="space-y-2">
                    {importResult.failed.map((fail, idx) => (
                      <li key={idx} className="text-xs text-zinc-400 font-mono">
                        {fail.workerId && `[${fail.workerId}] `}
                        {fail.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Print Credentials */}
              {importResult.created.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-zinc-500 uppercase mb-3">
                    Credential Cards (Print & Distribute)
                  </p>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                  >
                    Print Credentials
                  </button>
                  <div className="mt-6 columns-3 gap-6 print:columns-4">
                    {importResult.created.map((worker) => (
                      <CredentialCard key={worker.id} worker={worker} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-700 p-6 max-w-2xl max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Confirm Import
            </h3>

            <div className="bg-zinc-100 dark:bg-zinc-800 p-4 mb-6 max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-300 dark:border-zinc-700">
                    <th className="text-left p-2">First Name</th>
                    <th className="text-left p-2">Worker ID</th>
                    <th className="text-left p-2">Line ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-300 dark:divide-zinc-700">
                  {previewData.map((w, idx) => (
                    <tr key={idx}>
                      <td className="p-2">{w.firstName}</td>
                      <td className="p-2 font-mono">{w.workerId}</td>
                      <td className="p-2 font-mono">{w.lineId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportWorkers}
                disabled={importing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white text-sm font-medium transition-colors"
              >
                {importing ? "Importing..." : "Import Workers"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-500/5 border border-blue-500/30 p-4 text-xs text-blue-400">
        <p className="font-mono uppercase mb-2">CSV Format</p>
        <p className="font-mono">firstName, workerId, lineId</p>
        <p className="mt-2">Example:</p>
        <p className="font-mono">Yasiru, 4092, LINE-A</p>
      </div>
    </div>
  );
}
