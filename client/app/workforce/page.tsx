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
  success: WorkerAccountCreated[];
  failed: {
    firstName?: string;
    workerId?: string;
    lineId?: string;
    reason: string;
  }[];
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
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<
    "idle" | "validating" | "uploading" | "complete"
  >("idle");

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
      setUploadProgress("validating");
      setSelectedFile(file.name);

      try {
        const text = await file.text();
        const workers = parseCSV(text);

        if (workers.length > 100) {
          setError(`Too many workers: ${workers.length}. Maximum is 100.`);
          setPreviewData([]);
          setUploadProgress("idle");
          return;
        }

        setPreviewData(workers);
        setShowImportModal(true);
        setUploadProgress("idle");
      } catch (err) {
        setError(
          `Failed to parse CSV: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        setPreviewData([]);
        setUploadProgress("idle");
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
    setUploadProgress("uploading");
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

      const result = (await response.json()) as
        | BulkCreateWorkersResponse
        | { error: string };

      if (!response.ok) {
        const errorMsg =
          "error" in result ? result.error : "Failed to create workers";
        throw new Error(
          errorMsg + (response.status ? ` (${response.status})` : ""),
        );
      }

      if ("error" in result) {
        throw new Error(result.error);
      }

      setImportResult(result);
      setPreviewData([]);
      setShowImportModal(false);
      setUploadProgress("complete");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Import failed: ${errorMessage}`);
      setUploadProgress("idle");
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
          Import Workers from CSV
        </h2>

        <div className="space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Upload a CSV file with columns:{" "}
            <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono text-[10px]">
              firstName, workerId, lineId
            </code>
          </p>

          {/* Drag and Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file && file.name.endsWith(".csv")) {
                const input = fileInputRef.current;
                if (input) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  input.files = dt.files;
                  handleFileSelect({
                    target: input,
                  } as React.ChangeEvent<HTMLInputElement>);
                }
              }
            }}
            className={`border-2 border-dashed rounded p-8 text-center transition-colors ${
              isDragging
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-zinc-300 dark:border-zinc-700 hover:border-emerald-500/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-3">
              <svg
                className="w-8 h-8 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>

              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Drag and drop your CSV file here
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  or click to browse
                </p>
              </div>

              {selectedFile && (
                <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 mt-2">
                  ✓ {selectedFile}
                </p>
              )}

              {uploadProgress === "validating" && (
                <p className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                  Validating CSV...
                </p>
              )}

              {uploadProgress === "uploading" && (
                <p className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                  Creating worker accounts...
                </p>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded transition-colors"
            >
              Select CSV File
            </button>
          </div>

          {previewData.length > 0 && !showImportModal && (
            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded text-sm">
              <p className="text-blue-600 dark:text-blue-400 font-medium">
                ✓ {previewData.length} worker(s) ready to import
              </p>
              <p className="text-xs text-blue-500 mt-1">
                Click "Select CSV File" again to review or import
              </p>
            </div>
          )}

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
              {importResult.success.length > 0 && (
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
                    {importResult.success.map((worker) => (
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-[#111113] border-b border-zinc-200 dark:border-zinc-800/60 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Review & Confirm Import
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    {previewData.length} worker
                    {previewData.length !== 1 ? "s" : ""} ready to be created
                  </p>
                </div>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded">
                  <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 uppercase mb-1">
                    To Import
                  </p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {previewData.length}
                  </p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded">
                  <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase mb-1">
                    Expected
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    ✓
                  </p>
                </div>
                <div className="bg-zinc-500/10 border border-zinc-500/30 p-3 rounded">
                  <p className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                    Status
                  </p>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Ready
                  </p>
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 uppercase mb-3">
                  Preview
                </p>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800/60 rounded overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-100 dark:bg-zinc-800/30">
                        <th className="text-left p-3 font-semibold text-zinc-700 dark:text-zinc-300 w-32">
                          First Name
                        </th>
                        <th className="text-left p-3 font-semibold text-zinc-700 dark:text-zinc-300 w-24">
                          Worker ID
                        </th>
                        <th className="text-left p-3 font-semibold text-zinc-700 dark:text-zinc-300">
                          Line ID
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                      {previewData.map((w, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
                        >
                          <td className="p-3 text-zinc-900 dark:text-zinc-100">
                            {w.firstName}
                          </td>
                          <td className="p-3 font-mono text-blue-600 dark:text-blue-400">
                            {w.workerId}
                          </td>
                          <td className="p-3 font-mono text-zinc-600 dark:text-zinc-400">
                            {w.lineId}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded">
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  ⚠️ After importing, worker credentials will be generated and
                  ready for distribution. Ensure all information is correct
                  before proceeding.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-[#111113] border-t border-zinc-200 dark:border-zinc-800/60 p-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowImportModal(false)}
                disabled={importing}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 text-zinc-900 dark:text-zinc-100 text-sm font-medium transition-colors rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleImportWorkers}
                disabled={importing}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 disabled:opacity-50 text-white text-sm font-medium transition-colors rounded flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <span className="animate-spin">◌</span>
                    Importing...
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    Import {previewData.length} Worker
                    {previewData.length !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-500/5 border border-blue-500/30 p-6 rounded">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-mono text-blue-600 dark:text-blue-400 uppercase font-bold mb-2">
              📋 CSV Format Required
            </p>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 font-mono bg-zinc-100 dark:bg-zinc-800 p-2 rounded">
              firstName, workerId, lineId
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold mb-2">
              Example:
            </p>
            <div className="space-y-1 font-mono text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 p-2 rounded">
              <p>Yasiru, 4092, LINE-A</p>
              <p>Praveen, 4093, LINE-B</p>
              <p>Lakshan, 4094, LINE-A</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              ℹ️ Maximum 100 workers per import. Worker IDs must be 4 digits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
