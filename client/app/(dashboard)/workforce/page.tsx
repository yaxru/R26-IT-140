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
  id: string;
  firstName: string;
  workerId: string;
  lineId: string;
  phoneNumber: string;
  contactEmail: string;
  primarySkill: string; // NEW
  proficiencyGrade: string; // NEW
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
  const deleteFileInputRef = useRef<HTMLInputElement>(null);

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
  const [currentLinePage, setCurrentLinePage] = useState<
    Record<string, number>
  >({});

  // Existing Workforce State
  const [existingWorkers, setExistingWorkers] = useState<ExistingWorker[]>([]);
  const [fetchingWorkers, setFetchingWorkers] = useState(true);
  const [editingWorker, setEditingWorker] = useState<ExistingWorker | null>(
    null,
  );
  const [existingLinePage, setExistingLinePage] = useState<
    Record<string, number>
  >({});

  const fetchExistingWorkers = useCallback(async () => {
    setFetchingWorkers(true);
    try {
      const { data, error } = await supabase.from("operators").select(`
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
        line_id: w.operator_productivity?.current_line_id || "UNASSIGNED",
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
                primarySkill: row.primarySkill || row.primary_skill || "",
                proficiencyGrade: String(
                  row.proficiencyGrade || row.proficiency_grade || "B",
                )
                  .toUpperCase()
                  .trim(),
              }))
              .filter((w) => w.firstName && w.workerId);

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
  }, [previewData, supabase, fetchExistingWorkers]);

  // ── DELETE ACTIONS ─────────────────────────────────────────────────────────

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
    if (
      !confirm(
        "Are you sure you want to delete this worker? This will permanently delete their account.",
      )
    )
      return;
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "delete-worker",
        {
          body: { userId },
        },
      );
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      fetchExistingWorkers();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleBulkDeleteAll = async () => {
    if (existingWorkers.length === 0) return;
    const confirmDelete = window.confirm(
      `CRITICAL WARNING: You are about to permanently delete ALL ${existingWorkers.length} workers. This cannot be undone.\n\nAre you sure?`,
    );
    if (!confirmDelete) return;

    try {
      const allIds = existingWorkers.map((w) => w.id);
      const { data, error: invokeError } = await supabase.functions.invoke(
        "bulk-delete-workers",
        {
          body: { userIds: allIds },
        },
      );
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);

      alert(`Successfully deleted ${data.success} workers.`);
      fetchExistingWorkers();
    } catch (err: any) {
      alert(`Failed to bulk delete: ${err.message}`);
    }
  };

  const handleBatchDeleteCSV = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const rawData = results.data as Record<string, string>[];
            const csvWorkerIds = rawData
              .map((row) => String(row.workerId || row.worker_id || "").trim())
              .filter(Boolean);

            if (csvWorkerIds.length === 0) {
              alert("No valid worker IDs found in this CSV.");
              return;
            }

            const matchedWorkers = existingWorkers.filter((w) =>
              csvWorkerIds.includes(w.worker_id),
            );

            if (matchedWorkers.length === 0) {
              alert(
                "None of the workers in this CSV currently exist in the database.",
              );
              return;
            }

            const confirmMsg = `Found ${matchedWorkers.length} matching workers from this CSV in the database.\n\nAre you sure you want to permanently delete them?`;
            if (!window.confirm(confirmMsg)) return;

            const allIds = matchedWorkers.map((w) => w.id);
            const { data, error: invokeError } =
              await supabase.functions.invoke("bulk-delete-workers", {
                body: { userIds: allIds },
              });

            if (invokeError) throw new Error(invokeError.message);
            if (data?.error) throw new Error(data.error);

            alert(
              `Successfully deleted ${data.success} workers from this CSV batch.`,
            );
            fetchExistingWorkers();
          } catch (err: any) {
            alert(`Failed to batch delete: ${err.message}`);
          } finally {
            if (deleteFileInputRef.current)
              deleteFileInputRef.current.value = "";
          }
        },
        error: (err) => {
          alert(`CSV Parse Error: ${err.message}`);
          if (deleteFileInputRef.current) deleteFileInputRef.current.value = "";
        },
      });
    },
    [existingWorkers, supabase, fetchExistingWorkers],
  );

  const handleUpdateWorker = async (worker: ExistingWorker) => {
    try {
      const { error } = await supabase
        .from("operators")
        .update({
          name: worker.name,
          worker_id: worker.worker_id,
          phone_number: worker.phone_number,
          contact_email: worker.contact_email,
        })
        .eq("id", worker.id);

      if (error) throw error;
      setEditingWorker(null);
      fetchExistingWorkers();
    } catch (err: any) {
      alert(`Failed to update: ${err.message}`);
    }
  };

  const groupedWorkers = previewData.reduce(
    (acc, worker) => {
      if (!acc[worker.lineId]) acc[worker.lineId] = [];
      acc[worker.lineId].push(worker);
      return acc;
    },
    {} as Record<string, ParsedWorker[]>,
  );

  const CredentialCard = ({ worker }: { worker: WorkerAccountCreated }) => {
    const formatPhoneForWhatsApp = (phone?: string) => {
      if (!phone) return "";
      const cleaned = phone.replace(/\D/g, "");
      return cleaned.startsWith("0") ? `94${cleaned.slice(1)}` : cleaned;
    };

    const messageText = `Hello ${worker.firstName},\n\nYour Opsis factory login credentials:\n• Login Email: ${worker.email}\n• Access PIN: ${worker.plainTextPin}\n• Line: ${worker.lineId}\n\nPlease keep your PIN confidential.`;

    return (
      <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 p-5 text-center w-64 break-inside-avoid">
        <p className="text-[9px] font-bold text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest mb-3">
          Worker Credentials
        </p>
        <div className="border-b border-[#EAEAEA] dark:border-zinc-800 pb-4 mb-4">
          <p className="text-lg font-bold text-[#242424] dark:text-zinc-100">
            {worker.firstName}
          </p>
          <p className="text-[10px] font-mono text-[#5F5F5F] mt-1 uppercase tracking-widest">
            ID: {worker.workerId}
          </p>
          <p className="text-[10px] font-mono text-[#5F5F5F] uppercase tracking-widest">
            Line: {worker.lineId}
          </p>
          {worker.phoneNumber && (
            <p className="text-[9px] font-mono text-[#9A9A9A] mt-2 tracking-widest">
              Tel: {worker.phoneNumber}
            </p>
          )}
        </div>
        <div className="bg-[#F8F8F8] dark:bg-zinc-900/50 p-3 mb-2 border border-[#EAEAEA] dark:border-zinc-800">
          <p className="text-[9px] text-[#9A9A9A] font-bold uppercase tracking-widest mb-1">
            Login Email
          </p>
          <p className="text-[11px] font-mono break-all text-[#242424] dark:text-zinc-200">
            {worker.email}
          </p>
        </div>
        <div className="bg-[#E6F1EC] dark:bg-[#0A321E]/30 border border-[#1A7C4B]/20 p-3 mb-4">
          <p className="text-[9px] text-[#15633C] dark:text-[#47966F] font-bold uppercase tracking-widest mb-1">
            PIN (Keep Secret)
          </p>
          <p className="text-xl font-mono font-bold text-[#1A7C4B] dark:text-[#47966F]">
            {worker.plainTextPin}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 print:hidden">
          <button
            onClick={() =>
              navigator.clipboard.writeText(
                `Email: ${worker.email}\nPIN: ${worker.plainTextPin}\nID: ${worker.workerId}`,
              )
            }
            className="px-2 py-1.5 bg-[#F8F8F8] hover:bg-[#F1F1F1] dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[#242424] dark:text-zinc-300 text-[9px] font-bold uppercase tracking-widest transition-colors border border-[#EAEAEA] dark:border-zinc-700"
          >
            📋 Copy
          </button>
          {worker.phoneNumber ? (
            <button
              onClick={() =>
                window.open(
                  `https://wa.me/${formatPhoneForWhatsApp(worker.phoneNumber)}?text=${encodeURIComponent(messageText)}`,
                  "_blank",
                )
              }
              className="px-2 py-1.5 bg-[#FDFBF8] hover:bg-[#F4E5D1] border border-[#CE8E33]/30 text-[#CE8E33] text-[9px] font-bold uppercase tracking-widest transition-colors dark:bg-amber-950/20 dark:hover:bg-amber-950/40 dark:text-[#D7A45A]"
            >
              💬 WhatsApp
            </button>
          ) : (
            <button
              disabled
              className="px-2 py-1.5 bg-[#F8F8F8] dark:bg-zinc-800 text-[#9A9A9A] text-[9px] font-bold uppercase tracking-widest opacity-50 cursor-not-allowed border border-[#EAEAEA] dark:border-zinc-700"
            >
              No Phone
            </button>
          )}
          <button
            onClick={() => {
              window.location.href = `sms:${worker.phoneNumber || ""}?body=${encodeURIComponent(messageText)}`;
            }}
            disabled={!worker.phoneNumber}
            className="px-2 py-1.5 bg-[#F8F8F8] hover:bg-[#F1F1F1] dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[#242424] dark:text-zinc-300 text-[9px] font-bold uppercase tracking-widest transition-colors border border-[#EAEAEA] dark:border-zinc-700 disabled:opacity-50"
          >
            📱 SMS
          </button>
          <button
            onClick={() => {
              window.location.href = `mailto:${worker.contactEmail || worker.email}?subject=${encodeURIComponent("Your Opsis Login")}&body=${encodeURIComponent(messageText)}`;
            }}
            disabled={!worker.contactEmail}
            className="px-2 py-1.5 bg-[#F8F8F8] hover:bg-[#F1F1F1] dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[#242424] dark:text-zinc-300 text-[9px] font-bold uppercase tracking-widest transition-colors border border-[#EAEAEA] dark:border-zinc-700 disabled:opacity-50"
          >
            ✉️ Email
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="flex flex-col h-full bg-[#F8F8F8] dark:bg-[#030C08] text-[#242424] dark:text-zinc-200 min-h-0">
      {/* ── Header ── */}
      <section className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 px-6 lg:px-8 py-6 flex flex-col md:flex-row md:items-start justify-between shrink-0">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">
            Workforce
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#242424] dark:text-zinc-100">
            Worker Account Management
          </h1>
          <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 mt-1.5 leading-relaxed">
            Import, view, and manage operator accounts across the factory.
          </p>
        </div>
      </section>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 text-sm rounded-none">
          <p className="font-mono text-[10px] uppercase tracking-wider mb-1">
            Error
          </p>
          {error}
        </div>
      )}

      {/* ── Scrollable Content Area ── */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-[#F1F1F1] dark:bg-zinc-900/20">
        {/* Import Section */}
        <section className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 p-6 lg:p-8 flex flex-col lg:flex-row gap-8">
          {/* Main Upload Area */}
          <div className="flex-1">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#242424] dark:text-zinc-200 mb-4">
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
                  if (
                    file &&
                    file.name.endsWith(".csv") &&
                    fileInputRef.current
                  ) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    fileInputRef.current.files = dt.files;
                    handleFileSelect({
                      target: fileInputRef.current,
                    } as React.ChangeEvent<HTMLInputElement>);
                  }
                }}
                className={`border border-dashed p-10 text-center transition-colors ${
                  isDragging
                    ? "border-[#1A7C4B] bg-[#E6F1EC] dark:bg-[#0A321E]/30"
                    : "border-[#C6C6C6] dark:border-zinc-700 bg-[#F8F8F8] dark:bg-zinc-900/40 hover:border-[#9A9A9A] dark:hover:border-zinc-500"
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
                    className="w-8 h-8 text-[#9A9A9A] dark:text-zinc-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <div>
                    <p className="text-[11px] font-bold text-[#242424] dark:text-zinc-200 uppercase tracking-widest">
                      Drag and drop your CSV file here
                    </p>
                    <p className="text-[10px] text-[#9A9A9A] dark:text-zinc-500 mt-1 uppercase tracking-widest font-mono">
                      or click to browse
                    </p>
                  </div>
                  {selectedFile && (
                    <p className="text-xs font-mono text-[#1A7C4B] dark:text-[#47966F] mt-2 font-bold">
                      ✓ {selectedFile}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-6 px-4 py-2 border border-[#EAEAEA] dark:border-zinc-700 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800 text-[#242424] dark:text-zinc-200 text-[10px] font-bold uppercase tracking-widest transition-colors"
                >
                  Select CSV File
                </button>
              </div>

              {previewData.length > 0 && !showImportModal && (
                <div className="flex items-center justify-between bg-[#E6F1EC] dark:bg-[#0A321E]/30 border border-[#1A7C4B]/20 p-3 text-sm">
                  <div>
                    <p className="text-[#15633C] dark:text-[#47966F] font-bold text-[10px] uppercase tracking-widest">
                      ✓ {previewData.length} worker(s) ready to import
                    </p>
                  </div>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 bg-[#1A7C4B] hover:bg-[#15633C] text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    Review Data
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Instructions Area */}
          <div className="lg:w-80 bg-[#F8F8F8] dark:bg-zinc-900/40 border border-[#EAEAEA] dark:border-zinc-800 p-6 shrink-0 h-fit">
            <p className="text-[10px] font-bold text-[#242424] dark:text-zinc-200 uppercase tracking-widest mb-4 border-b border-[#EAEAEA] dark:border-zinc-700 pb-2">
              CSV Format Required
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-bold text-[#5F5F5F] dark:text-zinc-400 mb-1 uppercase tracking-widest">
                  Columns must match exactly:
                </p>
                <p className="text-[10px] text-[#242424] dark:text-zinc-300 font-mono bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-700 p-3 leading-relaxed">
                  firstName, workerId, lineId, primarySkill, proficiencyGrade,
                  phoneNumber, contactEmail
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-[#5F5F5F] dark:text-zinc-400 mb-1 uppercase tracking-widest">
                  Example:
                </p>
                <div className="font-mono text-[10px] text-[#5F5F5F] dark:text-zinc-400 bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-700 p-3 space-y-1.5 whitespace-nowrap overflow-x-auto">
                  <p>Yasiru, 4092, LINE-A, overlock, B, 0771, y@x.co</p>
                  <p>Kasun, 5092, LINE-B, flatlock, A, , k@x.co</p>
                </div>
              </div>
              <p className="text-[9px] text-[#9A9A9A] dark:text-zinc-500 leading-relaxed border-t border-[#EAEAEA] dark:border-zinc-700 pt-3 uppercase tracking-widest">
                Worker IDs must be precisely 4 digits. Large CSV uploads are
                batched automatically.
              </p>
            </div>
          </div>
        </section>

        {/* Render Import Results */}
        {importResult && (
          <section className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 p-6 lg:p-8">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#242424] dark:text-zinc-200 mb-6">
              Import Results
            </h2>
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-[#E6F1EC] dark:bg-[#0A321E]/30 border border-[#1A7C4B]/20 p-4">
                <p className="text-[10px] font-bold text-[#15633C] dark:text-[#47966F] uppercase tracking-widest mb-1">
                  Created
                </p>
                <p className="text-3xl font-bold text-[#1A7C4B] dark:text-[#47966F]">
                  {importResult.summary.created}
                </p>
              </div>
              <div className="bg-[#FDFBF8] dark:bg-amber-950/20 border border-[#CE8E33]/30 p-4">
                <p className="text-[10px] font-bold text-[#CE8E33] dark:text-[#D7A45A] uppercase tracking-widest mb-1">
                  Failed
                </p>
                <p className="text-3xl font-bold text-[#CE8E33] dark:text-[#D7A45A]">
                  {importResult.summary.failed}
                </p>
              </div>
              <div className="bg-[#F8F8F8] dark:bg-zinc-900/40 border border-[#EAEAEA] dark:border-zinc-700 p-4">
                <p className="text-[10px] font-bold text-[#5F5F5F] dark:text-zinc-400 uppercase tracking-widest mb-1">
                  Total
                </p>
                <p className="text-3xl font-bold text-[#242424] dark:text-zinc-100">
                  {importResult.summary.total}
                </p>
              </div>
            </div>

            {importResult.failed.length > 0 && (
              <div className="bg-[#FDFBF8] dark:bg-amber-950/20 border border-[#CE8E33]/30 p-6 mb-8">
                <p className="text-[10px] font-bold text-[#CE8E33] dark:text-[#D7A45A] uppercase tracking-widest mb-4">
                  Failed Records
                </p>
                <ul className="space-y-1.5">
                  {importResult.failed.map((fail, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-[#CE8E33]/90 dark:text-[#D7A45A]/90 font-mono"
                    >
                      {fail.workerId && `[${fail.workerId}] `}
                      {fail.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {importResult.success.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6 border-t border-[#EAEAEA] dark:border-zinc-800 pt-8">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#242424] dark:text-zinc-200">
                    Generated Credentials
                  </p>
                  <button
                    onClick={() => window.print()}
                    className="px-5 py-2 bg-[#242424] hover:bg-black text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    Print All
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
                  const totalPages = Math.ceil(workers.length / CARDS_PER_PAGE);
                  const paginatedWorkers = workers.slice(
                    (page - 1) * CARDS_PER_PAGE,
                    page * CARDS_PER_PAGE,
                  );

                  return (
                    <div key={lineId} className="mb-12">
                      <div className="flex items-center justify-between border-b border-[#EAEAEA] dark:border-zinc-800 pb-3 mb-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#242424] dark:text-zinc-200">
                          Line{" "}
                          <span className="text-[#1A7C4B] dark:text-[#47966F]">
                            {lineId}
                          </span>
                        </h3>
                        {totalPages > 1 && (
                          <div className="flex items-center gap-3 print:hidden">
                            <button
                              onClick={() =>
                                setCurrentLinePage((prev) => ({
                                  ...prev,
                                  [lineId]: Math.max(1, page - 1),
                                }))
                              }
                              disabled={page === 1}
                              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-[#F8F8F8] dark:bg-zinc-800 disabled:opacity-30 border border-[#EAEAEA] dark:border-zinc-700 hover:bg-[#F1F1F1]"
                            >
                              Prev
                            </button>
                            <span className="text-[9px] text-[#9A9A9A] font-mono uppercase tracking-widest">
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
                              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-[#F8F8F8] dark:bg-zinc-800 disabled:opacity-30 border border-[#EAEAEA] dark:border-zinc-700 hover:bg-[#F1F1F1]"
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
          </section>
        )}

        {/* Existing Workforce Section */}
        <section className="bg-white dark:bg-[#111113] p-6 lg:p-8">
          {/* Table Header & Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-[#EAEAEA] dark:border-zinc-800 pb-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#242424] dark:text-zinc-200">
              Existing Workforce Database
            </h2>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <button
                onClick={fetchExistingWorkers}
                className="text-[9px] font-bold uppercase tracking-widest text-[#1A7C4B] dark:text-[#47966F] hover:text-[#15633C] transition-colors"
              >
                Refresh Data
              </button>
              <div className="w-px h-3 bg-[#EAEAEA] dark:bg-zinc-700"></div>

              {/* NEW: Batch Delete CSV Button */}
              <input
                ref={deleteFileInputRef}
                type="file"
                accept=".csv"
                onChange={handleBatchDeleteCSV}
                className="hidden"
              />
              <button
                onClick={() => deleteFileInputRef.current?.click()}
                className="text-[9px] font-bold uppercase tracking-widest text-[#CE8E33] dark:text-[#D7A45A] hover:text-[#A77329] transition-colors"
                title="Upload a CSV to delete those specific workers"
              >
                Delete via CSV
              </button>

              <div className="w-px h-3 bg-[#EAEAEA] dark:bg-zinc-700"></div>
              <button
                onClick={handleBulkDeleteAll}
                disabled={existingWorkers.length === 0}
                className="text-[9px] font-bold uppercase tracking-widest text-red-600 dark:text-red-500 hover:text-red-700 disabled:opacity-30 transition-colors"
              >
                Delete All Data
              </button>
            </div>
          </div>

          {/* Table Rendering */}
          {fetchingWorkers ? (
            <div className="py-12 text-center text-[10px] text-[#9A9A9A] dark:text-zinc-500 animate-pulse font-mono uppercase tracking-widest border border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-zinc-900/20">
              Loading Records...
            </div>
          ) : existingWorkers.length === 0 ? (
            <div className="py-12 text-center text-[10px] text-[#9A9A9A] dark:text-zinc-500 font-mono uppercase tracking-widest border border-dashed border-[#C6C6C6] dark:border-zinc-700 bg-[#F8F8F8] dark:bg-zinc-900/20">
              No active workers found.
            </div>
          ) : (
            Object.entries(
              existingWorkers.reduce(
                (acc, worker) => {
                  if (!acc[worker.line_id]) acc[worker.line_id] = [];
                  acc[worker.line_id].push(worker);
                  return acc;
                },
                {} as Record<string, ExistingWorker[]>,
              ),
            ).map(([lineId, workers]) => {
              const WORKERS_PER_PAGE = 10;
              const page = existingLinePage[lineId] || 1;
              const totalPages = Math.ceil(workers.length / WORKERS_PER_PAGE);
              const paginatedWorkers = workers.slice(
                (page - 1) * WORKERS_PER_PAGE,
                page * WORKERS_PER_PAGE,
              );

              return (
                <div key={lineId} className="mb-12">
                  <div className="mb-4">
                    <span className="text-[10px] font-bold text-[#242424] dark:text-zinc-200 uppercase tracking-widest border-l-2 border-[#1A7C4B] pl-3">
                      Production Line {lineId}
                    </span>
                  </div>

                  <div className="border border-[#EAEAEA] dark:border-zinc-800 overflow-x-auto bg-[#F8F8F8] dark:bg-zinc-900/10">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white dark:bg-[#111113] text-[9px] uppercase font-bold text-[#9A9A9A] tracking-widest border-b border-[#EAEAEA] dark:border-zinc-800">
                        <tr>
                          <th className="px-6 py-4 w-1/3">Worker</th>
                          <th className="px-6 py-4 w-32">ID</th>
                          <th className="px-6 py-4 w-40">Phone</th>
                          <th className="px-6 py-4 w-32">Status (Line)</th>
                          <th className="px-6 py-4 text-right w-24">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAEAEA] dark:divide-zinc-800 bg-white dark:bg-[#111113]">
                        {paginatedWorkers.map((w) => (
                          <tr
                            key={w.id}
                            className="hover:bg-[#F8F8F8] dark:hover:bg-zinc-900/50 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="font-bold text-[#242424] dark:text-zinc-100 text-[11px] uppercase tracking-widest">
                                {w.name}
                              </div>
                              <div className="text-[10px] text-[#9A9A9A] mt-1 font-mono break-all">
                                {w.internal_email}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-[10px] text-[#5F5F5F] dark:text-zinc-400 tracking-widest">
                              {w.worker_id}
                            </td>
                            <td className="px-6 py-4 font-mono text-[10px] text-[#5F5F5F] dark:text-zinc-400 tracking-widest">
                              {w.phone_number || "-"}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-[#E6F1EC] text-[#1A7C4B] dark:bg-[#0A321E]/60 dark:text-[#47966F] border border-[#1A7C4B]/20 uppercase tracking-widest">
                                {lineId} Active
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-4 items-center">
                                {/* WhatsApp Icon */}
                                <button
                                  onClick={() => {
                                    if (w.phone_number) {
                                      const cleaned = w.phone_number.replace(
                                        /\D/g,
                                        "",
                                      );
                                      const phone = cleaned.startsWith("0")
                                        ? `94${cleaned.slice(1)}`
                                        : cleaned;
                                      window.open(
                                        `https://wa.me/${phone}`,
                                        "_blank",
                                      );
                                    }
                                  }}
                                  disabled={!w.phone_number}
                                  className={`transition-colors ${w.phone_number ? "text-[#9A9A9A] hover:text-[#1A7C4B]" : "text-[#EAEAEA] dark:text-zinc-800 cursor-not-allowed"}`}
                                  title={
                                    w.phone_number
                                      ? "WhatsApp Worker"
                                      : "No Phone Number"
                                  }
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="square"
                                  >
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                  </svg>
                                </button>

                                {/* Email Icon */}
                                <button
                                  onClick={() => {
                                    const email =
                                      w.contact_email || w.internal_email;
                                    if (email)
                                      window.location.href = `mailto:${email}`;
                                  }}
                                  className="text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-100 transition-colors"
                                  title="Email Worker"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="square"
                                  >
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                  </svg>
                                </button>

                                <div className="w-px h-3 bg-[#EAEAEA] dark:bg-zinc-700"></div>

                                {/* Edit Icon */}
                                <button
                                  onClick={() => setEditingWorker(w)}
                                  className="text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-100 transition-colors"
                                  title="Edit Worker"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="square"
                                  >
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>

                                {/* Delete Icon */}
                                <button
                                  onClick={() => handleDeleteWorker(w.id)}
                                  className="text-[#9A9A9A] hover:text-red-600 transition-colors"
                                  title="Delete Worker"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="square"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Table Pagination Footer */}
                    <div className="bg-[#F8F8F8] dark:bg-zinc-900/40 px-6 py-4 border-t border-[#EAEAEA] dark:border-zinc-800 flex items-center justify-between">
                      <div className="text-[9px] font-mono uppercase tracking-widest text-[#9A9A9A]">
                        Showing {(page - 1) * WORKERS_PER_PAGE + 1} to{" "}
                        {Math.min(page * WORKERS_PER_PAGE, workers.length)} of{" "}
                        {workers.length} entries
                      </div>
                      {totalPages > 1 && (
                        <div className="flex border border-[#EAEAEA] dark:border-zinc-700 bg-white dark:bg-[#111113]">
                          <button
                            onClick={() =>
                              setExistingLinePage((prev) => ({
                                ...prev,
                                [lineId]: Math.max(1, page - 1),
                              }))
                            }
                            disabled={page === 1}
                            className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-300 border-r border-[#EAEAEA] dark:border-zinc-700 disabled:opacity-50 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800 transition-colors"
                          >
                            Prev
                          </button>
                          {[...Array(totalPages)].map((_, i) => (
                            <button
                              key={i}
                              onClick={() =>
                                setExistingLinePage((prev) => ({
                                  ...prev,
                                  [lineId]: i + 1,
                                }))
                              }
                              className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border-r border-[#EAEAEA] dark:border-zinc-700 ${
                                page === i + 1
                                  ? "bg-[#1A7C4B] text-white dark:bg-[#47966F]"
                                  : "text-[#5F5F5F] dark:text-zinc-300 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800"
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                          <button
                            onClick={() =>
                              setExistingLinePage((prev) => ({
                                ...prev,
                                [lineId]: Math.min(totalPages, page + 1),
                              }))
                            }
                            disabled={page === totalPages}
                            className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-300 disabled:opacity-50 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800 transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Edit Worker Modal */}
        {editingWorker && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 p-8 w-full max-w-md">
              <h3 className="font-bold text-[#242424] dark:text-zinc-100 mb-6 uppercase tracking-widest text-[10px] border-b border-[#EAEAEA] dark:border-zinc-800 pb-3">
                Edit Worker Details
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editingWorker.name}
                    onChange={(e) =>
                      setEditingWorker({
                        ...editingWorker,
                        name: e.target.value,
                      })
                    }
                    className="w-full text-sm border border-[#C6C6C6] dark:border-zinc-700 text-[#242424] dark:text-zinc-100 bg-transparent px-3 py-2 focus:outline-none focus:border-[#1A7C4B] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-2">
                    Worker ID
                  </label>
                  <input
                    type="text"
                    value={editingWorker.worker_id}
                    onChange={(e) =>
                      setEditingWorker({
                        ...editingWorker,
                        worker_id: e.target.value,
                      })
                    }
                    className="w-full text-sm border border-[#C6C6C6] dark:border-zinc-700 text-[#242424] dark:text-zinc-100 bg-transparent px-3 py-2 font-mono focus:outline-none focus:border-[#1A7C4B] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editingWorker.phone_number}
                    onChange={(e) =>
                      setEditingWorker({
                        ...editingWorker,
                        phone_number: e.target.value,
                      })
                    }
                    className="w-full text-sm border border-[#C6C6C6] dark:border-zinc-700 text-[#242424] dark:text-zinc-100 bg-transparent px-3 py-2 font-mono focus:outline-none focus:border-[#1A7C4B] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={editingWorker.contact_email}
                    onChange={(e) =>
                      setEditingWorker({
                        ...editingWorker,
                        contact_email: e.target.value,
                      })
                    }
                    className="w-full text-sm border border-[#C6C6C6] dark:border-zinc-700 text-[#242424] dark:text-zinc-100 bg-transparent px-3 py-2 focus:outline-none focus:border-[#1A7C4B] transition-colors"
                  />
                </div>
                <div className="pt-6 flex justify-end gap-3 mt-4">
                  <button
                    onClick={() => setEditingWorker(null)}
                    className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400 bg-[#F8F8F8] hover:bg-[#F1F1F1] dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors border border-[#EAEAEA] dark:border-transparent"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateWorker(editingWorker)}
                    className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest bg-[#1A7C4B] hover:bg-[#15633C] text-white transition-colors"
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl">
              <div className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 p-6 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-[12px] font-bold text-[#242424] dark:text-zinc-100 uppercase tracking-widest">
                    Review Data
                  </h3>
                  <p className="text-[10px] text-[#9A9A9A] mt-1 font-mono uppercase tracking-widest">
                    {previewData.length} records parsed
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={clearList}
                    disabled={importing}
                    className="text-[9px] text-[#CE8E33] hover:bg-[#FDFBF8] dark:hover:bg-amber-950/20 disabled:opacity-50 font-bold uppercase tracking-widest px-4 py-2 border border-[#CE8E33]/30 transition-colors"
                  >
                    Clear List
                  </button>
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="text-[#9A9A9A] hover:text-[#242424] dark:hover:text-white transition-colors"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-[#F8F8F8] dark:bg-zinc-900/20">
                {Object.keys(groupedWorkers).length === 0 ? (
                  <div className="text-center py-10 text-[#9A9A9A] text-[10px] font-mono uppercase tracking-widest border border-dashed border-[#C6C6C6] dark:border-zinc-700">
                    No data to display
                  </div>
                ) : (
                  Object.entries(groupedWorkers).map(([line, workers]) => (
                    <div
                      key={line}
                      className="mb-8 border border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113]"
                    >
                      <div className="bg-white dark:bg-[#111113] px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 flex items-center">
                        <span className="text-[10px] font-bold text-[#242424] dark:text-zinc-100 uppercase tracking-widest">
                          Line: {line}
                        </span>
                        <span className="ml-4 text-[9px] text-[#5F5F5F] dark:text-zinc-400 font-mono border border-[#EAEAEA] dark:border-zinc-700 px-2 py-0.5 uppercase tracking-widest">
                          {workers.length} worker(s)
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-[#F8F8F8] dark:bg-zinc-900/50 text-[9px] uppercase font-bold text-[#9A9A9A] tracking-widest border-b border-[#EAEAEA] dark:border-zinc-800">
                            <tr>
                              <th className="px-6 py-3 w-48">Worker</th>
                              <th className="px-6 py-3 w-32">ID</th>
                              <th className="px-6 py-3 w-32">Phone</th>
                              <th className="px-6 py-3 text-right w-24">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EAEAEA] dark:divide-zinc-800/40">
                            {workers.map((w) => (
                              <tr
                                key={w.id}
                                className="hover:bg-[#F8F8F8] dark:hover:bg-zinc-800/20 transition-colors"
                              >
                                <td className="px-6 py-3">
                                  <div className="font-bold text-[#242424] dark:text-zinc-100 text-[11px] uppercase tracking-widest">
                                    {w.firstName}
                                  </div>
                                  <div className="text-[10px] text-[#9A9A9A] mt-1 font-mono break-all">
                                    {w.contactEmail || "-"}
                                  </div>
                                </td>
                                <td className="px-6 py-3 font-mono text-[10px] text-[#5F5F5F] dark:text-zinc-400 tracking-widest">
                                  {w.workerId}
                                </td>
                                <td className="px-6 py-3 font-mono text-[10px] text-[#5F5F5F] dark:text-zinc-400 tracking-widest">
                                  {w.phoneNumber || "-"}
                                </td>
                                <td className="px-6 py-3 text-right">
                                  <button
                                    onClick={() => removeWorker(w.id)}
                                    disabled={importing}
                                    className="text-[#9A9A9A] hover:text-red-600 transition-colors disabled:opacity-0"
                                    title="Remove from batch"
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                    >
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
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

              <div className="bg-white dark:bg-[#111113] border-t border-[#EAEAEA] dark:border-zinc-800 p-6 flex items-center justify-between shrink-0">
                <div className="text-[10px] font-mono text-[#1A7C4B] animate-pulse uppercase tracking-widest font-bold">
                  {batchStatus}
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowImportModal(false)}
                    disabled={importing}
                    className="px-6 py-2 bg-[#F8F8F8] dark:bg-zinc-800 hover:bg-[#F1F1F1] text-[#242424] dark:text-zinc-100 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 border border-[#EAEAEA] dark:border-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportWorkers}
                    disabled={importing || previewData.length === 0}
                    className="px-8 py-2 bg-[#1A7C4B] hover:bg-[#15633C] text-white text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {importing ? (
                      <>
                        <span className="animate-spin text-lg leading-none">
                          ◌
                        </span>{" "}
                        PROCESSING...
                      </>
                    ) : (
                      <>CONFIRM IMPORT ↗</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 text-center text-[9px] font-mono text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-widest border-t border-[#EAEAEA] dark:border-zinc-800 shrink-0 bg-white dark:bg-[#111113]">
        Opsis · Workforce Administration v1.0
      </div>
    </main>
  );
}
