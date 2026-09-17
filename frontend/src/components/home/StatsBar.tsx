const STATS = [
  { value: "20+", label: "Years combined pharmacist experience" },
  { value: "45,000+", label: "Custom formulations compounded" },
  { value: "10", label: "Provinces & territories served" },
  { value: "4.9/5", label: "Average patient satisfaction" },
];

export default function StatsBar() {
  return (
    <section className="border-y border-brand-100 bg-brand-700">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-10 text-center text-white sm:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <p className="font-display text-3xl font-bold sm:text-4xl">{stat.value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-brand-100 sm:text-sm">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
