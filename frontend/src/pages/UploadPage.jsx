import { useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import AppShell from "../components/layout/AppShell";
import { studentsApi } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

const formatBytes = (bytes = 0) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** power;
  return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
};

const parseCsvLine = (line = "") => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const buildCsvPreview = (text, maxRows = 20) => {
  const rawLines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (rawLines.length === 0) {
    return { headers: [], rows: [], totalRows: 0, totalColumns: 0 };
  }

  const headers = parseCsvLine(rawLines[0]);
  const dataRows = rawLines.slice(1).map((line) => {
    const parsed = parseCsvLine(line);
    return headers.map((_, colIndex) => parsed[colIndex] ?? "");
  });

  return {
    headers,
    rows: dataRows.slice(0, maxRows),
    totalRows: dataRows.length,
    totalColumns: headers.length,
  };
};

export default function UploadPage() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [lastUploadMeta, setLastUploadMeta] = useState(null);
  const [csvPreview, setCsvPreview] = useState({ headers: [], rows: [], totalRows: 0, totalColumns: 0 });
  const [previewError, setPreviewError] = useState("");

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setSummary(null);
    setLastUploadMeta(null);
    setPreviewError("");
    setSelectedFileName(file.name || "");
    setSelectedFile(file);

    try {
      const fileText = await file.text();
      setCsvPreview(buildCsvPreview(fileText, 20));
    } catch {
      setCsvPreview({ headers: [], rows: [], totalRows: 0, totalColumns: 0 });
      setPreviewError("Unable to parse CSV preview. You can still try uploading.");
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await studentsApi.uploadCsv(formData);
      setSummary(res.data);
      setLastUploadMeta({
        uploadedAt: new Date().toISOString(),
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "text/csv",
      });
      toast.success(`Uploaded ${res.data.added} students`);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  });

  return (
    <AppShell notifications={[]}>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass-card p-5">
          <h3 className="text-2xl font-semibold">CSV Upload</h3>
          <p className="mt-2 text-base text-slate-700 dark:text-slate-300">Drag and drop student CSV with attendance, marks, and behavior columns.</p>
          <p className="mt-3 rounded-lg bg-slate-100/80 px-4 py-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-300">
            Supported columns include: <strong>name</strong>, <strong>attendance_pct / attendance</strong>,
            <strong> marks / average_marks</strong>, <strong>behavior_score / behavior</strong>.
          </p>

          <div
            {...getRootProps()}
            className={`mt-5 flex h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-10 text-center ${
              isDragActive
                ? "border-cyan-300 bg-cyan-500/10"
                : "border-slate-300 bg-white/70 dark:border-white/20 dark:bg-white/5"
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-xl font-semibold text-slate-900 dark:text-white">
              {uploading ? "Uploading..." : "Drop CSV here or click to browse"}
            </p>
            <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
              {selectedFileName ? selectedFileName : "No file chosen"}
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-white/20 dark:bg-slate-900">
            <h4 className="text-base font-semibold text-slate-900 dark:text-white">File Details</h4>
            {!selectedFile ? (
              <p className="mt-2 text-slate-600 dark:text-slate-300">No CSV selected yet.</p>
            ) : (
              <div className="mt-2 grid gap-2 text-slate-700 dark:text-slate-200">
                <p><span className="font-semibold">File Name:</span> {selectedFile.name}</p>
                <p><span className="font-semibold">File Size:</span> {formatBytes(selectedFile.size)}</p>
                <p><span className="font-semibold">File Type:</span> {selectedFile.type || "text/csv"}</p>
                <p><span className="font-semibold">Last Modified:</span> {new Date(selectedFile.lastModified).toLocaleString()}</p>
                <p><span className="font-semibold">Uploaded By:</span> {user?.name || "Unknown"} ({(user?.role || "user").toUpperCase()})</p>
              </div>
            )}
          </div>
        </section>

        <section className="glass-card p-5">
          <h3 className="text-lg font-semibold">Upload Summary</h3>
          {!summary && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No uploads yet.</p>}
          {summary && (
            <div className="mt-3 space-y-2 text-sm">
              <p><span className="font-semibold text-slate-700 dark:text-slate-200">Rows processed:</span> {summary.rows_processed}</p>
              <p><span className="font-semibold text-slate-700 dark:text-slate-200">Added:</span> {summary.added}</p>
              <p><span className="font-semibold text-slate-700 dark:text-slate-200">Skipped:</span> {summary.skipped}</p>
              <p><span className="font-semibold text-slate-700 dark:text-slate-200">Message:</span> {summary.message}</p>
              {lastUploadMeta && (
                <>
                  <p><span className="font-semibold text-slate-700 dark:text-slate-200">Uploaded file:</span> {lastUploadMeta.fileName}</p>
                  <p><span className="font-semibold text-slate-700 dark:text-slate-200">File size:</span> {formatBytes(lastUploadMeta.fileSize)}</p>
                  <p><span className="font-semibold text-slate-700 dark:text-slate-200">Upload time:</span> {new Date(lastUploadMeta.uploadedAt).toLocaleString()}</p>
                </>
              )}
              {summary.skipped_rows?.length > 0 && (
                <div>
                  <p><span className="font-semibold text-slate-700 dark:text-slate-200">Skipped row numbers:</span></p>
                  <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 dark:border-white/20 dark:bg-slate-900 dark:text-slate-200">
                    {summary.skipped_rows.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="glass-card p-5 lg:col-span-2">
          <h3 className="text-lg font-semibold">Dataset Preview</h3>
          {previewError && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              {previewError}
            </p>
          )}

          {!selectedFile && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Select a CSV file to view dataset details and table preview.</p>
          )}

          {selectedFile && csvPreview.headers.length > 0 && (
            <>
              <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-3">
                <p><span className="font-semibold">Columns:</span> {csvPreview.totalColumns}</p>
                <p><span className="font-semibold">Rows:</span> {csvPreview.totalRows}</p>
                <p><span className="font-semibold">Showing:</span> {csvPreview.rows.length} preview rows</p>
              </div>

              <div className="mt-3 overflow-auto rounded-xl border border-slate-200 dark:border-white/20">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      {csvPreview.headers.map((header, index) => (
                        <th key={`${header}-${index}`} className="px-3 py-2 text-left font-semibold">
                          {header || `Column ${index + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.rows.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`} className="border-t border-slate-200 dark:border-white/10">
                        {row.map((cell, colIndex) => (
                          <td key={`cell-${rowIndex}-${colIndex}`} className="px-3 py-2 align-top">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
