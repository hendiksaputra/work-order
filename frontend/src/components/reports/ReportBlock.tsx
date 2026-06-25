export function ReportBlock({ title, description, children }: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  );
}

export function ReportTable({ children }: { children: React.ReactNode }) {
  return <table className="w-full min-w-[640px] text-sm">{children}</table>;
}

export function ReportTh({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 ${className}`}>
      {children}
    </th>
  );
}

export function ReportTd({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-slate-100 px-3 py-2.5 ${className}`}>{children}</td>;
}

export function ReportEmpty({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-slate-400">
        {message}
      </td>
    </tr>
  );
}
