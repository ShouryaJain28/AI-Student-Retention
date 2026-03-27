export default function VideoCard({ title, description, videoId, onOpen, compact = false, delayIndex = 0 }) {
  return (
    <article
      className={`glass-card fade-in-up overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl ${compact ? "w-[340px] min-w-[340px]" : ""}`}
      style={{ animationDelay: `${Math.min(delayIndex * 70, 420)}ms` }}
    >
      <div className="aspect-video w-full overflow-hidden rounded-t-xl border-b border-slate-200/70 bg-black/80 dark:border-slate-700/70">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <div className="p-5">
        <h4 className="line-clamp-2 text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h4>
        <p className="mt-2 line-clamp-3 text-base font-semibold text-slate-700 dark:text-slate-200">{description}</p>
        <button className="ghost-btn mt-4 text-base font-semibold" onClick={() => onOpen?.({ title, description, videoId })}>
          Watch in popup
        </button>
      </div>
    </article>
  );
}
