type Props = {
  headers: string[];
  rows: Record<string, any>[];
  max?: number;
};

export function PreviewTable({ headers, rows, max = 10 }: Props) {
  const shown = rows.slice(0, max);
  if (!shown.length) return null;
  return (
    <div className="rounded-lg border overflow-auto max-h-[400px]">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground w-10">#</th>
            {headers.map((h) => (
              <th key={h} className="px-2 py-2 text-left font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
              {headers.map((h) => (
                <td key={h} className="px-2 py-1.5 whitespace-nowrap max-w-[200px] truncate">
                  {String(r[h] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > max && (
        <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
          Mostrando {max} de {rows.length} linhas
        </div>
      )}
    </div>
  );
}
