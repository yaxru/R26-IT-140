"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { getAuthHeaders } from "@/shared/auth";
import type {
  BulkCreateWorkersResponse,
  WorkerAccountCreated,
} from "@/shared/auth/types";
import {
  Download,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface ParsedWorker {
  id: string;
  firstName: string;
  workerId: string;
  lineId: string;
  phoneNumber: string;
  contactEmail: string;
  primarySkill: string;
  proficiencyGrade: string;
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
  const [chunkProgress, setChunkProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<ParsedWorker[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Failed to parse CSV",
            );
            setPreviewData([]);
          }
        },
        error: (err) => {
          setError(`CSV Parse Error: ${err.message}`);
        },
      });
    },
    [],
  );

  const handleImportWorkers = useCallback(async () => {
    if (previewData.length === 0) return;

    setImporting(true);
    setChunkProgress(0);
    setError(null);

    try {
      const headers = await getAuthHeaders(supabase);
      if (!headers.Authorization) throw new Error("Not authenticated.");

      const allSuccess: WorkerAccountCreated[] = [];
      const allFailed: any[] = [];
      let totalCreated = 0;
      let totalFailed = 0;

      const CHUNK_SIZE = 50; // Smaller chunk for smoother progress bar
      const totalChunks = Math.ceil(previewData.length / CHUNK_SIZE);

      for (let i = 0; i < previewData.length; i += CHUNK_SIZE) {
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        setBatchStatus(`Processing batch ${chunkIndex} of ${totalChunks}...`);

        // Update Progress Bar
        setChunkProgress(Math.round((i / previewData.length) * 100));

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

      setChunkProgress(100); // Complete

      setImportResult({
        success: allSuccess,
        failed: allFailed,
        summary: {
          total: previewData.length,
          created: totalCreated,
          failed: totalFailed,
        },
      });

      // Small delay to let user see 100% before closing
      setTimeout(() => {
        setPreviewData([]);
        setShowImportModal(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchExistingWorkers();
        setImporting(false);
      }, 800);
    } catch (err) {
      setError(
        `Import failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      setImporting(false);
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
        { body: { userId } },
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
        { body: { userIds: allIds } },
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

            if (
              !window.confirm(
                `Found ${matchedWorkers.length} matching workers from this CSV in the database.\n\nAre you sure you want to permanently delete them?`,
              )
            )
              return;

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

  const exportCredentialsCsv = () => {
    if (!importResult || importResult.success.length === 0) return;

    // Format the data for CSV
    const data = importResult.success.map((w) => ({
      "Full Name": w.firstName,
      "Worker ID": w.workerId,
      "Line Allocation": w.lineId,
      "Login Email": w.email,
      "Secret PIN": w.plainTextPin,
      Phone: w.phoneNumber || "N/A",
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `opsis_credentials_batch_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const groupedWorkers = previewData.reduce(
    (acc, worker) => {
      if (!acc[worker.lineId]) acc[worker.lineId] = [];
      acc[worker.lineId].push(worker);
      return acc;
    },
    {} as Record<string, ParsedWorker[]>,
  );

  // ── UI Components ─────────────────────────────────────────────────────────

  const CredentialCard = ({ worker }: { worker: WorkerAccountCreated }) => {
    const formatPhoneForWhatsApp = (phone?: string) => {
      if (!phone) return "";
      const cleaned = phone.replace(/\D/g, "");
      return cleaned.startsWith("0") ? `94${cleaned.slice(1)}` : cleaned;
    };
    const messageText = `Hello ${worker.firstName},\n\nYour Opsis factory login credentials:\n• Login Email: ${worker.email}\n• Access PIN: ${worker.plainTextPin}\n• Line: ${worker.lineId}\n\nPlease keep your PIN confidential.`;

    return (
      <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 p-5 text-center w-64 break-inside-avoid shadow-sm">
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
        </div>
        <div className="bg-[#FAFAFA] dark:bg-[#0a0a0c] p-3 mb-2 border border-[#EAEAEA] dark:border-zinc-800">
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
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() =>
              navigator.clipboard.writeText(
                `Email: ${worker.email}\nPIN: ${worker.plainTextPin}\nID: ${worker.workerId}`,
              )
            }
            className="px-2 py-1.5 bg-[#F8F8F8] hover:bg-[#F1F1F1] dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[#242424] dark:text-zinc-300 text-[9px] font-bold uppercase tracking-widest transition-colors border border-[#EAEAEA] dark:border-zinc-700"
          >
            Copy
          </button>
          {worker.phoneNumber ? (
            <button
              onClick={() =>
                window.open(
                  `https://wa.me/${formatPhoneForWhatsApp(worker.phoneNumber)}?text=${encodeURIComponent(messageText)}`,
                  "_blank",
                )
              }
              className="px-2 py-1.5 bg-[#FDFBF8] hover:bg-[#F4E5D1] border border-[#CE8E33]/30 text-[#CE8E33] text-[9px] font-bold uppercase tracking-widest transition-colors dark:bg-amber-950/20 dark:text-[#D7A45A]"
            >
              WhatsApp
            </button>
          ) : (
            <button
              disabled
              className="px-2 py-1.5 bg-[#F8F8F8] dark:bg-zinc-800 text-[#9A9A9A] text-[9px] font-bold uppercase tracking-widest opacity-50 cursor-not-allowed border border-[#EAEAEA] dark:border-zinc-700"
            >
              No Phone
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="flex flex-col h-full bg-[#F8F8F8] dark:bg-[#030C08] text-[#242424] dark:text-zinc-200 min-h-0">
      {/* ── Header ── */}
      <section className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 px-6  py-5 flex flex-col md:flex-row md:items-center justify-between shrink-0">
        <div>
          
          <h1 className="text-xl font-bold tracking-tight text-[#242424] dark:text-zinc-100">
            Worker Account Management
          </h1>
        </div>
        <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 max-w-sm text-right hidden md:block">
          Batch ingest operator profiles and distribute secure access
          credentials via automated SMS/Email.
        </p>
      </section>

      {error && (
        <div className="shrink-0 px-6 py-2 bg-[#F8F8F8] dark:bg-[#0a0a0c]">
          <div className="flex items-center gap-2 border-l-2 border-[#CE8E33] bg-[#FDFBF8] dark:bg-amber-950/10 px-3 py-2 text-xs text-[#A77329] dark:text-[#E1BA82]">
            <AlertTriangle size={14} /> {error}
          </div>
        </div>
      )}

      {/* ── Scrollable Content Area ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Strict Fixed-Height Import Section */}
        <section className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 flex flex-col lg:flex-row h-auto lg:h-[320px] shrink-0">
          {/* Instructions Column */}
          <div className="w-full lg:w-[340px] bg-[#FAFAFA] dark:bg-[#0a0a0c] border-r border-[#EAEAEA] dark:border-zinc-800 p-6 flex flex-col shrink-0">
            <p className="text-[10px] font-bold text-[#242424] dark:text-zinc-200 uppercase tracking-widest mb-4 border-b border-[#EAEAEA] dark:border-zinc-800 pb-3">
              CSV Format Required
            </p>
            <div className="flex-1 overflow-y-auto">
              <p className="text-[9px] font-bold text-[#5F5F5F] dark:text-zinc-400 mb-1.5 uppercase tracking-widest">
                Exact Columns:
              </p>
              <p className="text-[10px] text-[#242424] dark:text-zinc-300 font-mono bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-700 p-2.5 leading-relaxed mb-4">
                firstName, workerId, lineId, primarySkill, proficiencyGrade,
                phoneNumber, contactEmail
              </p>
              <p className="text-[9px] font-bold text-[#5F5F5F] dark:text-zinc-400 mb-1.5 uppercase tracking-widest">
                Example Row:
              </p>
              <div className="font-mono text-[10px] text-[#5F5F5F] dark:text-zinc-400 bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-700 p-2.5 whitespace-nowrap overflow-x-auto">
                Yasiru, 4092, LINE-A, overlock, B, 0771, y@x.co
              </div>
            </div>
          </div>

          {/* Dropzone Column */}
          <div className="flex-1 p-6 lg:p-8 flex flex-col relative bg-white dark:bg-[#111113]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#242424] dark:text-zinc-200">
                Batch Data Ingestion
              </h2>
              {previewData.length > 0 && !showImportModal && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-1.5 bg-[#1A7C4B] hover:bg-[#15633C] text-white text-[9px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 size={12} /> Review {previewData.length} Records
                </button>
              )}
            </div>

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
              className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed transition-colors relative ${
                isDragging
                  ? "border-[#1A7C4B] bg-[#E6F1EC]/30 dark:bg-[#0A321E]/20"
                  : "border-[#EAEAEA] dark:border-zinc-800 bg-[#FAFAFA] dark:bg-[#0a0a0c] hover:border-[#C6C6C6] dark:hover:border-zinc-600"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              <div className="flex flex-col items-center gap-3 pointer-events-none">
                <UploadCloud
                  size={24}
                  className="text-[#9A9A9A] dark:text-zinc-600"
                />
                <div className="text-center">
                  <p className="text-[11px] font-bold text-[#242424] dark:text-zinc-200 uppercase tracking-widest">
                    {selectedFile ? selectedFile : "Drag & Drop CSV"}
                  </p>
                  <p className="text-[10px] text-[#9A9A9A] dark:text-zinc-500 mt-1 uppercase tracking-widest font-mono">
                    {selectedFile
                      ? "Click to change file"
                      : "Strictly .csv format only"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Import Results Section ── */}
        {importResult && (
          <section className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#242424] dark:text-zinc-200">
                Import Diagnostics
              </h2>
              <button
                onClick={exportCredentialsCsv}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#242424] dark:bg-zinc-200 text-white dark:text-[#0d0d0f] hover:bg-black dark:hover:bg-white text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                <Download size={12} /> Export CSV Roster
              </button>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8 border border-[#EAEAEA] dark:border-zinc-800 bg-[#FAFAFA] dark:bg-[#0a0a0c]">
              <div className="p-5 border-r border-[#EAEAEA] dark:border-zinc-800">
                <p className="text-[10px] font-bold text-[#1A7C4B] dark:text-[#47966F] uppercase tracking-widest mb-1">
                  Created Successfully
                </p>
                <p className="text-3xl font-bold tabular-nums text-[#242424] dark:text-zinc-100">
                  {importResult.summary.created}
                </p>
              </div>
              <div className="p-5 border-r border-[#EAEAEA] dark:border-zinc-800 bg-[#FDFBF8] dark:bg-amber-950/10">
                <p className="text-[10px] font-bold text-[#CE8E33] dark:text-[#D7A45A] uppercase tracking-widest mb-1">
                  Failed Records
                </p>
                <p className="text-3xl font-bold tabular-nums text-[#CE8E33] dark:text-[#D7A45A]">
                  {importResult.summary.failed}
                </p>
              </div>
              <div className="p-5">
                <p className="text-[10px] font-bold text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest mb-1">
                  Total Processed
                </p>
                <p className="text-3xl font-bold tabular-nums text-[#242424] dark:text-zinc-100">
                  {importResult.summary.total}
                </p>
              </div>
            </div>

            {importResult.failed.length > 0 && (
              <div className="bg-[#FDFBF8] dark:bg-[#1A1510] border border-[#CE8E33]/30 p-5 mb-8">
                <p className="text-[10px] font-bold text-[#CE8E33] dark:text-[#D7A45A] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Failed Records Details
                </p>
                <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-2">
                  {importResult.failed.map((fail, idx) => (
                    <li
                      key={idx}
                      className="text-[10px] text-[#CE8E33]/90 dark:text-[#D7A45A]/90 font-mono tracking-wide"
                    >
                      {fail.workerId && (
                        <span className="font-bold">[{fail.workerId}]</span>
                      )}{" "}
                      {fail.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {importResult.success.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-6 border-b border-[#EAEAEA] dark:border-zinc-800 pb-2">
                  Generated Credentials Preview
                </p>
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
                      <div className="flex items-center justify-between border-b border-[#EAEAEA] dark:border-zinc-800 pb-3 mb-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#242424] dark:text-zinc-200">
                          Line{" "}
                          <span className="text-[#1A7C4B] dark:text-[#47966F]">
                            {lineId}
                          </span>
                        </h3>
                        {totalPages > 1 && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() =>
                                setCurrentLinePage((prev) => ({
                                  ...prev,
                                  [lineId]: Math.max(1, page - 1),
                                }))
                              }
                              disabled={page === 1}
                              className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-[#F8F8F8] dark:bg-zinc-800 disabled:opacity-30 border border-[#EAEAEA] dark:border-zinc-700 hover:bg-[#F1F1F1]"
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
                              className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-[#F8F8F8] dark:bg-zinc-800 disabled:opacity-30 border border-[#EAEAEA] dark:border-zinc-700 hover:bg-[#F1F1F1]"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-5">
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
                                {/* Actions (WhatsApp, Edit, Delete) - Kept same as original */}
                                <button
                                  onClick={() => setEditingWorker(w)}
                                  className="text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-100 transition-colors"
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
                                <button
                                  onClick={() => handleDeleteWorker(w.id)}
                                  className="text-[#9A9A9A] hover:text-red-600 transition-colors"
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

                    {/* Pagination */}
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
                              setExistingLinePage((p) => ({
                                ...p,
                                [lineId]: Math.max(1, page - 1),
                              }))
                            }
                            disabled={page === 1}
                            className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-300 border-r border-[#EAEAEA] dark:border-zinc-700 disabled:opacity-50 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800"
                          >
                            Prev
                          </button>
                          <button
                            onClick={() =>
                              setExistingLinePage((p) => ({
                                ...p,
                                [lineId]: Math.min(totalPages, page + 1),
                              }))
                            }
                            disabled={page === totalPages}
                            className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-300 disabled:opacity-50 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800"
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

        {/* Import Preview Modal (Now features the Progress Bar) */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl">
              <div className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 p-6 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-[12px] font-bold text-[#242424] dark:text-zinc-100 uppercase tracking-widest">
                    Data Verification
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
                    disabled={importing}
                    className="text-[#9A9A9A] hover:text-[#242424] dark:hover:text-white transition-colors disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-[#F8F8F8] dark:bg-zinc-900/20">
                {Object.entries(groupedWorkers).map(([line, workers]) => (
                  <div
                    key={line}
                    className="mb-6 border border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113]"
                  >
                    <div className="px-4 py-3 border-b border-[#EAEAEA] dark:border-zinc-800 flex items-center">
                      <span className="text-[10px] font-bold text-[#242424] dark:text-zinc-100 uppercase tracking-widest">
                        Line: {line}
                      </span>
                      <span className="ml-4 text-[9px] text-[#5F5F5F] font-mono border border-[#EAEAEA] dark:border-zinc-700 px-2 py-0.5">
                        {workers.length} worker(s)
                      </span>
                    </div>
                    <table className="w-full text-sm text-left">
                      <tbody className="divide-y divide-[#EAEAEA] dark:divide-zinc-800/40">
                        {workers.map((w) => (
                          <tr
                            key={w.id}
                            className="hover:bg-[#F8F8F8] dark:hover:bg-zinc-800/20"
                          >
                            <td className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#242424] dark:text-zinc-100">
                              {w.firstName}
                            </td>
                            <td className="px-4 py-2 text-[10px] font-mono text-[#5F5F5F] dark:text-zinc-400">
                              {w.workerId}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {/* Modal Footer with Progress Bar */}
              <div className="bg-white dark:bg-[#111113] border-t border-[#EAEAEA] dark:border-zinc-800 p-6 shrink-0 h-20 flex flex-col justify-center">
                {importing ? (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A7C4B] animate-pulse">
                        {batchStatus}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#242424] dark:text-zinc-200">
                        {chunkProgress}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#EAEAEA] dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-[#1A7C4B] transition-all duration-300"
                        style={{ width: `${chunkProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-4 w-full">
                    <button
                      onClick={() => setShowImportModal(false)}
                      className="px-6 py-2 bg-[#F8F8F8] dark:bg-zinc-800 text-[#242424] dark:text-zinc-100 text-[10px] font-bold uppercase tracking-widest border border-[#EAEAEA] dark:border-zinc-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImportWorkers}
                      className="px-8 py-2 bg-[#1A7C4B] hover:bg-[#15633C] text-white text-[10px] font-bold uppercase tracking-widest"
                    >
                      Confirm Import
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
