export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={`kpi-${index}`} className="surface-card h-20 rounded-2xl sm:h-24" />
        ))}
      </div>
      <div className="surface-card h-52 rounded-2xl sm:h-64" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={`row-${index}`} className="h-10 rounded-xl bg-white/80" />
      ))}
    </div>
  );
}

export function TableRowSkeleton({ cols = 6, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={`skel-${row}`} className="border-t border-purple-jam/8">
          {Array.from({ length: cols }, (_, col) => (
            <td key={`skel-${row}-${col}`} className="px-5 py-3">
              <span className="block h-3 animate-pulse rounded bg-canvas" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
