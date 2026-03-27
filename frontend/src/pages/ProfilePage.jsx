import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../components/layout/AppShell";
import { authApi } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export default function ProfilePage() {
  const { user, loading, updateProfile, forgotPassword, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    dob: "",
    address: "",
    department: "",
    bio: "",
  });
  const [forgotForm, setForgotForm] = useState({ email: "", newPassword: "", confirmPassword: "" });
  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const mapUserToForm = (profileUser) => {
    const personal = profileUser?.personal_data || {};
    return {
      name: profileUser?.name || "",
      email: profileUser?.email || "",
      password: "",
      phone: personal.phone || "",
      dob: personal.dob || "",
      address: personal.address || "",
      department: personal.department || "",
      bio: personal.bio || "",
    };
  };

  useEffect(() => {
    setForm(mapUserToForm(user));
    setForgotForm((prev) => ({ ...prev, email: user?.email || "" }));
  }, [user]);

  const loadProfileAndDocs = async () => {
    const freshUser = (await refreshProfile()) || user;
    if (freshUser) {
      setForm(mapUserToForm(freshUser));
      setForgotForm((prev) => ({ ...prev, email: freshUser.email || "" }));
    }

    try {
      const res = await authApi.listDocuments();
      setDocuments(res.data?.documents || []);
    } catch {
      setDocuments([]);
    }
  };

  useEffect(() => {
    loadProfileAndDocs();
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      email: form.email,
      password: form.password,
      personal_data: {
        phone: form.phone,
        dob: form.dob,
        address: form.address,
        department: form.department,
        bio: form.bio,
      },
    };

    const ok = await updateProfile(payload);
    if (ok) {
      setForm((prev) => ({ ...prev, password: "" }));
    }
  };

  const onForgotPassword = async (event) => {
    event.preventDefault();
    if (!forgotForm.newPassword) {
      toast.error("New password is required");
      return;
    }
    if (forgotForm.newPassword !== forgotForm.confirmPassword) {
      toast.error("Password confirmation does not match");
      return;
    }

    const ok = await forgotPassword({ email: forgotForm.email, new_password: forgotForm.newPassword });
    if (ok) {
      setForgotForm((prev) => ({ ...prev, newPassword: "", confirmPassword: "" }));
    }
  };

  const uploadDocument = async () => {
    if (!selectedFile) {
      toast.error("Choose a file first");
      return;
    }

    try {
      setUploadingDoc(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      await authApi.uploadDocument(formData);
      toast.success("Document uploaded");
      setSelectedFile(null);
      const refreshed = await authApi.listDocuments();
      setDocuments(refreshed.data?.documents || []);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Upload failed");
    } finally {
      setUploadingDoc(false);
    }
  };

  const removeDocument = async (docId) => {
    try {
      await authApi.deleteDocument(docId);
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      toast.success("Document deleted");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Delete failed");
    }
  };

  const documentCountText = useMemo(() => `${documents.length} file${documents.length === 1 ? "" : "s"}`, [documents.length]);

  return (
    <AppShell notifications={[]}>
      <section className="glass-card p-6">
        <h2 className="page-title">Edit Profile</h2>
        <p className="page-description mt-1">Admin, teacher, and student can manage profile and personal documents.</p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 font-semibold ${activeTab === "profile" ? "bg-slate-900 text-white dark:bg-white dark:text-black" : "ghost-btn"}`}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 font-semibold ${activeTab === "documents" ? "bg-slate-900 text-white dark:bg-white dark:text-black" : "ghost-btn"}`}
            onClick={() => setActiveTab("documents")}
          >
            Documents
          </button>
        </div>

        {activeTab === "profile" ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <form className="grid gap-4" onSubmit={onSubmit}>
              <label className="grid gap-2">
                <span className="text-base font-semibold">Full Name</span>
                <input className="input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
              </label>

              <label className="grid gap-2">
                <span className="text-base font-semibold">Email</span>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-base font-semibold">Phone</span>
                  <input className="input" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-base font-semibold">Date of Birth</span>
                  <input type="date" className="input" value={form.dob} onChange={(e) => setForm((prev) => ({ ...prev, dob: e.target.value }))} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-base font-semibold">Role</span>
                  <input className="input" value={String(user?.role || "").toUpperCase()} disabled />
                </label>
                <label className="grid gap-2">
                  <span className="text-base font-semibold">Department</span>
                  <input
                    className="input"
                    value={form.department}
                    onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                  />
                </label>
              </div>

              {user?.role === "student" && user?.student_id != null && (
                <label className="grid gap-2">
                  <span className="text-base font-semibold">Student ID</span>
                  <input className="input" value={user.student_id} disabled />
                </label>
              )}

              <label className="grid gap-2">
                <span className="text-base font-semibold">Address</span>
                <input className="input" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
              </label>

              <label className="grid gap-2">
                <span className="text-base font-semibold">Bio</span>
                <textarea
                  className="input min-h-[120px]"
                  value={form.bio}
                  onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-base font-semibold">New Password (optional)</span>
                <input
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave blank to keep current password"
                />
              </label>

              <div>
                <button type="submit" className="primary-btn" disabled={loading}>
                  {loading ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>

            <form className="glass p-4" onSubmit={onForgotPassword}>
              <h3 className="section-title">Forgot Password</h3>
              <p className="section-description mt-1">Reset password using your account email.</p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-base font-semibold">Account Email</span>
                  <input
                    type="email"
                    className="input"
                    value={forgotForm.email}
                    onChange={(e) => setForgotForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-base font-semibold">New Password</span>
                  <input
                    type="password"
                    className="input"
                    value={forgotForm.newPassword}
                    onChange={(e) => setForgotForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-base font-semibold">Confirm Password</span>
                  <input
                    type="password"
                    className="input"
                    value={forgotForm.confirmPassword}
                    onChange={(e) => setForgotForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                </label>
                <button type="submit" className="primary-btn" disabled={loading}>
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <div className="glass p-4">
              <h3 className="section-title">Documents</h3>
              <p className="section-description mt-1">Upload personal data documents (PDF, image, doc, txt).</p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  className="input max-w-sm"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
                />
                <button type="button" className="primary-btn" disabled={uploadingDoc} onClick={uploadDocument}>
                  {uploadingDoc ? "Uploading..." : "Upload Document"}
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-300">{documentCountText}</span>
              </div>
            </div>

            <div className="glass p-4">
              <h3 className="section-title">Uploaded Files</h3>
              {documents.length === 0 ? (
                <p className="section-description mt-2">No documents uploaded yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/80 p-3 dark:border-white/20">
                      <div>
                        <p className="font-semibold">{doc.name}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {(Number(doc.size || 0) / 1024).toFixed(1)} KB • {doc.uploaded_at || "Uploaded"}
                        </p>
                      </div>
                      <button type="button" className="ghost-btn" onClick={() => removeDocument(doc.id)}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
