import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../components/layout/AppShell";
import { chatApi } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [group, setGroup] = useState("student");
  const [text, setText] = useState("");
  const [important, setImportant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const canSendImportant = ["teacher", "admin"].includes(String(user?.role || "").toLowerCase());

  const loadChat = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await chatApi.listMessages();
      const nextMessages = Array.isArray(res?.data?.messages) ? res.data.messages : [];
      const nextNotifications = Array.isArray(res?.data?.important_notifications) ? res.data.important_notifications : [];
      setMessages(nextMessages);
      setNotifications(nextNotifications);

      if (nextNotifications.length > 0 && String(user?.role || "").toLowerCase() === "student") {
        toast.error(`You have ${nextNotifications.length} important teacher update(s).`);
        try {
          await chatApi.markImportantSeen();
        } catch {
          // keep chat usable even if marking seen fails
        }
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to load chat");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChat();
  }, []);

  const filteredMessages = useMemo(() => {
    const selected = String(group || "student").toLowerCase();
    return messages.filter((item) => String(item.group || "").toLowerCase() === selected);
  }, [messages, group]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;

    if (String(user?.role || "").toLowerCase() === "student" && group === "teacher") {
      toast.error("Students can post only in Student Group.");
      return;
    }

    setSending(true);
    try {
      const res = await chatApi.sendMessage({
        group,
        text: text.trim(),
        important: canSendImportant ? important : false,
      });
      const createdMessage = res?.data?.message;
      if (createdMessage) {
        setMessages((prev) => [...prev, createdMessage]);
      }
      setText("");
      setImportant(false);
      toast.success("Message sent");
      await loadChat({ silent: true });
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell notifications={notifications}>
      <section className="glass-card p-5">
        <h3 className="section-title">Group Chat</h3>
        <p className="mt-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
          Use Student Group and Teacher Group for collaboration. Teachers can mark messages as important to notify all students.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={`ghost-btn ${group === "student" ? "bg-slate-200 dark:bg-slate-700" : ""}`}
            onClick={() => setGroup("student")}
          >
            Student Group
          </button>
          <button
            type="button"
            className={`ghost-btn ${group === "teacher" ? "bg-slate-200 dark:bg-slate-700" : ""}`}
            onClick={() => setGroup("teacher")}
          >
            Teacher Group
          </button>
        </div>

        <div className="mt-4 h-[26rem] overflow-auto rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-white/20 dark:bg-slate-900">
          {loading ? (
            <p className="text-base text-slate-600 dark:text-slate-300">Loading messages...</p>
          ) : filteredMessages.length === 0 ? (
            <p className="text-base text-slate-600 dark:text-slate-300">No messages yet in this group.</p>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((message) => {
                const tone = message.important
                  ? "border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10"
                  : "border-slate-200 bg-white dark:border-white/15 dark:bg-slate-800/50";

                return (
                  <article key={message.id} className={`rounded-xl border p-3 ${tone}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {message.sender_name} <span className="text-sm uppercase text-slate-600 dark:text-slate-300">({message.sender_role})</span>
                      </p>
                      <div className="flex items-center gap-2">
                        {message.important && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold uppercase text-red-700 dark:bg-red-500/20 dark:text-red-200">
                            Important
                          </span>
                        )}
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                      Email: {message.sender_email || "N/A"} | User ID: {message.sender_user_id ?? "N/A"} | Student ID: {message.sender_student_id ?? "N/A"}
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-800 dark:text-slate-100">{message.text}</p>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <form className="mt-4 space-y-3" onSubmit={sendMessage}>
          <label className="text-base font-semibold text-slate-800 dark:text-slate-100" htmlFor="chat-message">
            Send message to {group === "student" ? "Student Group" : "Teacher Group"}
          </label>
          <textarea
            id="chat-message"
            className="input min-h-[7rem]"
            placeholder="Type your message"
            value={text}
            onChange={(event) => setText(event.target.value)}
            required
          />

          {canSendImportant && (
            <label className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
              <input
                type="checkbox"
                checked={important}
                onChange={(event) => setImportant(event.target.checked)}
              />
              Mark as important and notify all students
            </label>
          )}

          <div className="pt-1">
            <button type="submit" className="primary-btn min-w-[9rem]" disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
