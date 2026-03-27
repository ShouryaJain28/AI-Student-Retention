import { useEffect } from "react";

export default function VideoModal({ video, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!video) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-card fade-in-up w-full max-w-4xl p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{video.title}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{video.description}</p>
          </div>
          <button className="ghost-btn" onClick={onClose}>Close</button>
        </div>

        <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-200/70 bg-black dark:border-slate-700/70">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
