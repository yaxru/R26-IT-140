"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { getAuthHeaders } from "@/shared/auth";
import type {
  BulkCreateWorkersResponse,
  WorkerAccountCreated,
} from "@/shared/auth/types";

interface ParsedWorker {
  id: string; // Temporary unique ID for UI rendering/deletion
  firstName: string;
  workerId: string;
  lineId: string;
  phoneNumber: string;
  contactEmail: string;
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

interface ExistingWorker {
  id: string;
  worker_id: string;
  name: string;
  phone_number: string;
  contact_email: string;
  internal_email: string;
  line_id: string;
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
  const [batchStatus, setBatchStatus] = useState("");
  const [currentLinePage, setCurrentLinePage] = useState<Record<string, number>>({});

  // Existing Workforce State
  const [existingWorkers, setExistingWorkers] = useState<ExistingWorker[]>([]);
  const [fetchingWorkers, setFetchingWorkers] = useState(true);
  const [editingWorker, setEditingWorker] = useState<ExistingWorker | null>(null);
  const [existingLinePage, setExistingLinePage] = useState<Record<string, number>>({});
  
  const fetchExistingWorkers = useCallback(async () => {
    setFetchingWorkers(true);
    try {
      const { data, error } = await supabase
        .from("operators")
        .select(`
          id, worker_id, name, phone_number, contact_email, internal_email,
          operator_productivity ( current_line_id )
        `);
      
      if (error) throw error;
      
      const mapped = (data || []).map((w: any) => ({
        id: w.id,
        worker_id: w.worker_id,
        name: w.name,
        phone_number: w.phone_number || "",
        contact_email: w.contact_email || "",
        internal_email: w.internal_email,
        line_id: w.operator_productivity?.current_line_id || "UNASSIGNED"
      }));
      
      setExistingWorkers(mapped);
    } catch (err: any) {
      console.error("Failed to fetch workers:", err);
    } finally {
      setFetchingWorkers(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchExistingWorkers();
  }, [fetchExistingWorkers]);


  // ──────────────────────────────────────────────────────────────────────
  // Handle file selection & PapaParse
  // ──────────────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setImportResult(null);
      setUploadProgress("validating");
      setSelectedFile(file.name);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rawData = results.data as Record<string, string>[];
            const workers: ParsedWorker[] = rawData
              .map((row) => ({
                id: crypto.randomUUID(),
                firstName: row.firstName || row.name || "",
                workerId: String(row.workerId || row.worker_id || "").trim(),
                lineId: row.lineId || row.line_id || "UNASSIGNED",
                phoneNumber: row.phoneNumber || row.phone_number || "",
                contactEmail: row.contactEmail || row.contact_email || "",
              }))
              .filter((w) => w.firstName && w.workerId); // Drop completely empty rows

            if (workers.length === 0) {
              throw new Error("No valid worker records found in CSV.");
            }

            setPreviewData(workers);
            setShowImportModal(true);
            setUploadProgress("idle");
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Failed to parse CSV",
            );
            setPreviewData([]);
            setUploadProgress("idle");
          }
        },
        error: (err) => {
          setError(`CSV Parse Error: ${err.message}`);
          setUploadProgress("idle");
        },
      });
    },
    [],
  );

  // ──────────────────────────────────────────────────────────────────────
  // Chunked API Submission
  // ──────────────────────────────────────────────────────────────────────
  const handleImportWorkers = useCallback(async () => {
    if (previewData.length === 0) return;

    setImporting(true);
    setUploadProgress("uploading");
    setError(null);

    try {
      const headers = await getAuthHeaders(supabase);
      if (!headers.Authorization) throw new Error("Not authenticated.");

      const allSuccess: WorkerAccountCreated[] = [];
      const allFailed: any[] = [];
      let totalCreated = 0;
      let totalFailed = 0;

      const CHUNK_SIZE = 100;
      const totalChunks = Math.ceil(previewData.length / CHUNK_SIZE);

      // Process in batches to respect Edge Function rate limits
      for (let i = 0; i < previewData.length; i += CHUNK_SIZE) {
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        setBatchStatus(`Processing batch ${chunkIndex} of ${totalChunks}...`);

        const chunk = previewData.slice(i, i + CHUNK_SIZE);

        const { data, error: invokeError } = await supabase.functions.invoke(
          "bulk-create-workers",
          { body: { workers: chunk } },
        );

        if (invokeError)
          throw new Error(`Batch ${chunkIndex} failed: ${invokeError.message}`);
        if (data?.error) throw new Error(data.error);

        allSuccess.push(...(data?.success || []));
        allFailed.push(...(data?.failed || []));
        totalCreated += data?.summary?.created || 0;
        totalFailed += data?.summary?.failed || 0;
      }

      setImportResult({
        success: allSuccess,
        failed: allFailed,
        summary: {
          total: previewData.length,
          created: totalCreated,
          failed: totalFailed,
        },
      });

      setPreviewData([]);
      setShowImportModal(false);
      setUploadProgress("complete");
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      fetchExistingWorkers();

    } catch (err) {
      setError(
        `Import failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      setUploadProgress("idle");
    } finally {
      setImporting(false);
      setBatchStatus("");
    }
  }, [previewData, supabase]);

  // ──────────────────────────────────────────────────────────────────────
  // List Management Utilities
  // ──────────────────────────────────────────────────────────────────────
  const removeWorker = (idToRemove: string) => {
    setPreviewData((prev) => prev.filter((w) => w.id !== idToRemove));
  };

  const clearList = () => {
    setPreviewData([]);
    setShowImportModal(false);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteWorker = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this worker? This will permanently delete their account.")) return;
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("delete-worker", {
        body: { userId }
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      
      fetchExistingWorkers();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleUpdateWorker = async (worker: ExistingWorker) => {
    try {
      const { error } = await supabase.from("operators").update({
        name: worker.name,
        worker_id: worker.worker_id,
        phone_number: worker.phone_number,
        contact_email: worker.contact_email
      }).eq("id", worker.id);
      
      if (error) throw error;
      
      setEditingWorker(null);
      fetchExistingWorkers();
    } catch (err: any) {
      alert(`Failed to update: ${err.message}`);
    }
  };

  // Group workers by Line ID for the UI
  const groupedWorkers = previewData.reduce(
    (acc, worker) => {
      if (!acc[worker.lineId]) acc[worker.lineId] = [];
      acc[worker.lineId].push(worker);
      return acc;
    },
    {} as Record<string, ParsedWorker[]>,
  );

  // ──────────────────────────────────────────────────────────────────────
  // UI Components
  // ──────────────────────────────────────────────────────────────────────
  const CredentialCard = ({ worker }: { worker: WorkerAccountCreated }) => {
    const handleCopy = () => {
      navigator.clipboard.writeText(
        `Email: ${worker.email}\nPIN: ${worker.plainTextPin}`,
      );
      // Simple visual feedback could be added here
    };

    const handleEmail = () => {
      const subject = encodeURIComponent("Your Opsis Login Credentials");
      const body = encodeURIComponent(
        `Hello ${worker.firstName},\n\nYour Opsis worker account has been created.\n\nInternal Login Email: ${worker.email}\nPIN: ${worker.plainTextPin}\n\nPlease keep this information secure.\n`,
      );
      window.location.href = `mailto:${worker.contactEmail || worker.email}?subject=${subject}&body=${body}`;
    };

    return (
      <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-800 p-4 text-center w-64 break-inside-avoid mb-6">
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
          <p className="text-xs font-mono text-zinc-500">
            Line: {worker.lineId}
          </p>
        </div>
        <div className="bg-zinc-100 dark:bg-zinc-800 p-2 mb-3">
          <p className="text-[10px] text-zinc-500 font-mono uppercase">Email</p>
          <p className="text-xs font-mono break-all text-zinc-900 dark:text-zinc-100">
            {worker.email}
          </p>
        </div>
        <div className="bg-emerald-100 dark:bg-emerald-900 p-2 mb-3">
          <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono uppercase">
            PIN (Keep Secret)
          </p>
          <p className="text-2xl font-mono font-bold text-emerald-900 dark:text-emerald-100">
            {worker.plainTextPin}
          </p>
        </div>

        <div className="flex gap-2 print:hidden mt-3">
          <button
            onClick={handleCopy}
            className="flex-1 px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium rounded transition-colors border border-zinc-200 dark:border-zinc-700"
          >
            Copy Both
          </button>
          <button
            onClick={handleEmail}
            className="flex-1 px-2 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-medium rounded transition-colors border border-blue-200 dark:border-blue-800/60"
          >
            Email
          </button>
        </div>
      </div>
    );
  };

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
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded transition-colors"
            >
              Select CSV File
            </button>
          </div>

          {previewData.length > 0 && !showImportModal && (
            <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 p-3 rounded text-sm">
              <div>
                <p className="text-blue-600 dark:text-blue-400 font-medium">
                  ✓ {previewData.length} worker(s) ready to import
                </p>
                <p className="text-xs text-blue-500 mt-1">
                  Click below to review the parsed data
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                Review Data
              </button>
            </div>
          )}

          {/* Import Summary & Credentials */}
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

              {importResult.success.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-mono text-zinc-500 uppercase">
                      Credential Cards (Print & Distribute)
                    </p>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                    >
                      Print Credentials
                    </button>
                  </div>

                  {Object.entries(
                    importResult.success.reduce(
                      (acc, worker) => {
                        if (!acc[worker.lineId]) acc[worker.lineId] = [];
                        acc[worker.lineId].push(worker);
                        return acc;
                      },
                      {} as Record<string, WorkerAccountCreated[]>,
                    ),
                  ).map(([lineId, workers]) => {
                    const CARDS_PER_PAGE = 8;
                    const page = currentLinePage[lineId] || 1;
                    const totalPages = Math.ceil(
                      workers.length / CARDS_PER_PAGE,
                    );
                    const paginatedWorkers = workers.slice(
                      (page - 1) * CARDS_PER_PAGE,
                      page * CARDS_PER_PAGE,
                    );

                    return (
                      <div key={lineId} className="mb-10">
                        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 pb-2 mb-4">
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            Production Line:{" "}
                            <span className="text-blue-600 dark:text-blue-400">
                              {lineId}
                            </span>
                          </h3>
                          {totalPages > 1 && (
                            <div className="flex items-center gap-2 print:hidden">
                              <button
                                onClick={() =>
                                  setCurrentLinePage((prev) => ({
                                    ...prev,
                                    [lineId]: Math.max(1, page - 1),
                                  }))
                                }
                                disabled={page === 1}
                                className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 disabled:opacity-50 rounded"
                              >
                                Prev
                              </button>
                              <span className="text-xs text-zinc-500 font-mono">
                                Page {page} of {totalPages}
                              </span>
                              <button
                                onClick={() =>
                                  setCurrentLinePage((prev) => ({
                                    ...prev,
                                    [lineId]: Math.min(totalPages, page + 1),
                                  }))
                                }
                                disabled={page === totalPages}
                                className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 disabled:opacity-50 rounded"
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-6">
                          {paginatedWorkers.map((worker) => (
                            <CredentialCard key={worker.id} worker={worker} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Existing Workforce Section */}
      <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Existing Workforce Database</h2>
          <button onClick={fetchExistingWorkers} className="text-xs text-blue-500 hover:underline">Refresh List</button>
        </div>
        
        {fetchingWorkers ? (
          <div className="py-8 text-center text-xs text-zinc-500 animate-pulse">Loading workers...</div>
        ) : existingWorkers.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">No workers found in the database.</div>
        ) : (
          Object.entries(
            existingWorkers.reduce((acc, worker) => {
              if (!acc[worker.line_id]) acc[worker.line_id] = [];
              acc[worker.line_id].push(worker);
              return acc;
            }, {} as Record<string, ExistingWorker[]>)
          ).map(([lineId, workers]) => {
            const WORKERS_PER_PAGE = 10;
            const page = existingLinePage[lineId] || 1;
            const totalPages = Math.ceil(workers.length / WORKERS_PER_PAGE);
            const paginatedWorkers = workers.slice((page - 1) * WORKERS_PER_PAGE, page * WORKERS_PER_PAGE);

            return (
              <div key={lineId} className="mb-6 border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-[#111113] overflow-hidden">
                <div className="bg-zinc-100 dark:bg-zinc-800/50 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/60 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      Production Line: <span className="text-blue-600 dark:text-blue-400">{lineId}</span>
                    </span>
                    <span className="ml-3 text-[10px] text-zinc-500 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
                      {workers.length} worker(s)
                    </span>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2 print:hidden">
                      <button 
                        onClick={() => setExistingLinePage(prev => ({ ...prev, [lineId]: Math.max(1, page - 1) }))} 
                        disabled={page === 1}
                        className="px-2 py-1 text-[10px] bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 disabled:opacity-50 rounded transition-colors"
                      >
                        Prev
                      </button>
                      <span className="text-[10px] text-zinc-500 font-mono">Page {page} of {totalPages}</span>
                      <button 
                        onClick={() => setExistingLinePage(prev => ({ ...prev, [lineId]: Math.min(totalPages, page + 1) }))} 
                        disabled={page === totalPages}
                        className="px-2 py-1 text-[10px] bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 disabled:opacity-50 rounded transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800/40 text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50">
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">ID</th>
                        <th className="text-left p-3 font-medium">Phone</th>
                        <th className="text-left p-3 font-medium">Internal Email</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                      {paginatedWorkers.map((w) => (
                        <tr key={w.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors group">
                          <td className="p-3 text-zinc-900 dark:text-zinc-100 font-medium">{w.name}</td>
                          <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">{w.worker_id}</td>
                          <td className="p-3 font-mono text-zinc-600 dark:text-zinc-400">{w.phone_number || '-'}</td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">{w.internal_email}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setEditingWorker(w)}
                              className="text-[10px] px-2 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded mr-2 transition-colors border border-blue-200 dark:border-blue-800/60"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteWorker(w.id)}
                              className="text-[10px] px-2 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded transition-colors border border-red-200 dark:border-red-800/60"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Worker Modal */}
      {editingWorker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-6 rounded shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Edit Worker Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Name</label>
                <input 
                  type="text" 
                  value={editingWorker.name}
                  onChange={e => setEditingWorker({ ...editingWorker, name: e.target.value })}
                  className="w-full text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 bg-transparent px-3 py-2 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Worker ID</label>
                <input 
                  type="text" 
                  value={editingWorker.worker_id}
                  onChange={e => setEditingWorker({ ...editingWorker, worker_id: e.target.value })}
                  className="w-full text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 bg-transparent px-3 py-2 rounded font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Phone Number</label>
                <input 
                  type="text" 
                  value={editingWorker.phone_number}
                  onChange={e => setEditingWorker({ ...editingWorker, phone_number: e.target.value })}
                  className="w-full text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 bg-transparent px-3 py-2 rounded font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Personal Contact Email</label>
                <input 
                  type="email" 
                  value={editingWorker.contact_email}
                  onChange={e => setEditingWorker({ ...editingWorker, contact_email: e.target.value })}
                  className="w-full text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 bg-transparent px-3 py-2 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
                <button 
                  onClick={() => setEditingWorker(null)}
                  className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleUpdateWorker(editingWorker)}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="bg-white dark:bg-[#111113] border-b border-zinc-200 dark:border-zinc-800/60 p-5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Review & Confirm Upload
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  {previewData.length} total workers mapped.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearList}
                  disabled={importing}
                  className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50 font-medium px-3 py-1.5 border border-red-500/30 rounded"
                >
                  Clear List
                </button>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-zinc-50 dark:bg-zinc-900/30">
              {Object.keys(groupedWorkers).length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-sm">
                  No data remaining.
                </div>
              ) : (
                Object.entries(groupedWorkers).map(([line, workers]) => (
                  <div
                    key={line}
                    className="mb-6 border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-[#111113] overflow-hidden"
                  >
                    <div className="bg-zinc-100 dark:bg-zinc-800/50 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/60">
                      <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                        Production Line:{" "}
                        <span className="text-blue-600 dark:text-blue-400">
                          {line}
                        </span>
                      </span>
                      <span className="ml-3 text-[10px] text-zinc-500 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
                        {workers.length} worker(s)
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-100 dark:border-zinc-800/40 text-zinc-500">
                            <th className="text-left p-3 font-medium w-40">
                              Name
                            </th>
                            <th className="text-left p-3 font-medium w-24">
                              ID
                            </th>
                            <th className="text-left p-3 font-medium w-32">
                              Phone
                            </th>
                            <th className="text-left p-3 font-medium min-w-[150px]">
                              Email
                            </th>
                            <th className="text-right p-3 font-medium w-20">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                          {workers.map((w) => (
                            <tr
                              key={w.id}
                              className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors group"
                            >
                              <td className="p-3 text-zinc-900 dark:text-zinc-100">
                                {w.firstName}
                              </td>
                              <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">
                                {w.workerId}
                              </td>
                              <td className="p-3 font-mono text-zinc-600 dark:text-zinc-400">
                                {w.phoneNumber || "-"}
                              </td>
                              <td className="p-3 text-zinc-600 dark:text-zinc-400">
                                {w.contactEmail || "-"}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => removeWorker(w.id)}
                                  disabled={importing}
                                  className="text-[10px] text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline disabled:opacity-0"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-white dark:bg-[#111113] border-t border-zinc-200 dark:border-zinc-800/60 p-5 flex items-center justify-between shrink-0">
              <div className="text-xs font-mono text-blue-600 animate-pulse">
                {batchStatus}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  disabled={importing}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-900 dark:text-zinc-100 text-sm font-medium rounded transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportWorkers}
                  disabled={importing || previewData.length === 0}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <span className="animate-spin">◌</span> Importing...
                    </>
                  ) : (
                    <>
                      <span>✓</span> Import {previewData.length} Worker(s)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-500/5 border border-blue-500/30 p-6 rounded mt-auto">
        <p className="text-xs font-mono text-blue-600 dark:text-blue-400 uppercase font-bold mb-2">
          📋 CSV Format Required
        </p>
        <p className="text-xs text-zinc-700 dark:text-zinc-300 font-mono bg-zinc-100 dark:bg-zinc-800 p-2 rounded mb-3">
          firstName, workerId, lineId, phoneNumber, contactEmail
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold mb-1">
          Example:
        </p>
        <div className="space-y-1 font-mono text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 p-2 rounded">
          <p>Yasiru, 4092, LINE-A, 0771234567, yasiru@example.com</p>
          <p>Kasun, 5092, LINE-B, , kasun@example.com</p>
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
          ℹ️ Upload limits bypassed via frontend auto-batching. Worker IDs must
          be 4 digits.
        </p>
      </div>

      <p className="text-center text-[10px] font-mono text-zinc-400 dark:text-zinc-700 pb-2">
        Opsis · Workforce Administration v1.0
      </p>
    </div>
  );
}
