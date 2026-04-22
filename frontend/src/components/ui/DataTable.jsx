import Spinner from './Spinner';

function DataTable({ columns = [], data = [], loading = false, emptyMessage = 'No data found.' }) {
  if (loading) return <Spinner />;

  return (
    <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm overflow-hidden">
      {data.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-base">{emptyMessage}</div>
      ) : (
        <table className="w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={row.id ?? rowIdx} className="hover:bg-slate-50 transition-colors duration-100">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-base text-slate-900 border-t border-slate-100">
                    {col.render ? col.render(row, rowIdx) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default DataTable;
