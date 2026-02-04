import { useState } from 'react';

interface DataTableProps {
  rows: Record<string, unknown>[];
  columns: string[];
  renderCell?: (value: unknown, column: string) => React.ReactNode;
}

export const JsonCell = ({ value }: { value: unknown }) => {
  const [open, setOpen] = useState(false);
  let serialized = '';
  let pretty = '';
  try {
    serialized = JSON.stringify(value);
    pretty = JSON.stringify(value, null, 2);
  } catch {
    serialized = String(value);
    pretty = serialized;
  }

  return (
    <span
      className='relative inline-flex max-w-[240px]'
      tabIndex={0}
      onBlur={() => setOpen(false)}
    >
      <button
        type='button'
        onClick={() => setOpen((prev) => !prev)}
        className='json-pill inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono truncate max-w-[240px]'
        title='Click to expand'
      >
        <span className='json-pill-icon inline-flex items-center justify-center w-4 h-4 rounded text-[10px] leading-none'>+</span>
        {serialized}
      </button>
      {open && (
        <div className='json-popover absolute z-20 mt-1 left-0 max-w-[320px] rounded-lg p-2 text-xs shadow-lg'>
          <pre className='whitespace-pre-wrap break-words'>{pretty}</pre>
        </div>
      )}
    </span>
  );
};

const defaultRenderCell = (value: unknown) => {
  if (value === null || value === undefined) {
    return <span className='text-gray-500'>—</span>;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return <span>{value}</span>;
  }
  if (typeof value === 'boolean') {
    return <span>{value ? 'true' : 'false'}</span>;
  }

  return <JsonCell value={value} />;
};

export function DataTable({
  rows,
  columns,
  renderCell = defaultRenderCell,
}: DataTableProps) {
  if (rows.length === 0) {
    return (
      <div className='flex items-center justify-center h-40 text-gray-500 text-sm'>
        No results found
      </div>
    );
  }

  return (
    <div className='data-table overflow-auto border border-convex-border rounded-lg'>
      <table className='min-w-full text-sm'>
        <thead className='sticky top-0 bg-convex-darker'>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className='text-left px-3 py-2 font-semibold text-gray-300 border-b border-convex-border whitespace-nowrap'
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const rowId = row['_id'];
            const key =
              rowId !== undefined && rowId !== null
                ? String(rowId)
                : String(rowIndex);
            return (
            <tr
              key={key}
              className='border-b border-convex-border hover:bg-convex-darker/60'
            >
              {columns.map((column) => (
                <td
                  key={`${rowIndex}-${column}`}
                  className='px-3 py-2 align-top whitespace-nowrap text-gray-200'
                >
                  {renderCell(row[column], column)}
                </td>
              ))}
            </tr>
          );
          })}
        </tbody>
      </table>
    </div>
  );
}
