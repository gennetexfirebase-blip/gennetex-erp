export default function PageHeader({ label, title, description }) {
  return (
    <div className="border-b border-graphite-800 bg-gradient-to-b from-graphite-900/80 to-transparent px-4 py-16 sm:px-6 md:px-12 md:py-20">
      <div className="mx-auto max-w-6xl">
        {label ? (
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-graphite-500">{label}</p>
        ) : null}
        <h1 className="max-w-3xl text-3xl font-normal tracking-tightest text-graphite-50 md:text-5xl">{title}</h1>
        {description ? <p className="mt-4 max-w-2xl text-lg text-graphite-400">{description}</p> : null}
      </div>
    </div>
  );
}
