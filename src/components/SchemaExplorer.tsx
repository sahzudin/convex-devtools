import { useMemo, useState } from 'react';
import type { SchemaInfo, TableInfo } from '../stores/schema-store';

interface SchemaExplorerProps {
  schema: SchemaInfo | null;
  selectedTable: string | null;
  onSelectTable: (table: string | null) => void;
}

export function SchemaExplorer({
  schema,
  selectedTable,
  onSelectTable,
}: SchemaExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTables = useMemo(() => {
    if (!schema) return [];
    if (!searchQuery.trim()) return schema.tables;

    const query = searchQuery.toLowerCase();
    return schema.tables.filter((table) => {
      if (table.name.toLowerCase().includes(query)) return true;
      return table.fields.some((field) =>
        field.name.toLowerCase().includes(query)
      );
    });
  }, [schema, searchQuery]);

  const renderTable = (table: TableInfo) => {
    const isSelected = table.name === selectedTable;
    return (
      <button
        key={table.name}
        onClick={() => onSelectTable(table.name)}
        className={`w-full flex items-start justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
          isSelected
            ? 'bg-convex-accent/20 text-white'
            : 'hover:bg-convex-border text-gray-300'
        }`}
      >
        <div className='flex items-start gap-2 min-w-0'>
          <svg
            className='w-4 h-4 text-green-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 6h16M4 10h16M4 14h16M4 18h16'
            />
          </svg>
          <span
            className={`leading-5 break-all whitespace-normal ${
              isSelected ? 'text-white' : 'text-gray-300'
            }`}
          >
            {table.name}
          </span>
        </div>
        <span className='text-xs text-gray-500 flex-shrink-0 pt-0.5'>
          {table.fields.length} fields
        </span>
      </button>
    );
  };

  const selectedTableInfo = schema?.tables.find(
    (t) => t.name === selectedTable
  );

  return (
    <div className='flex flex-col h-full'>
      {/* Search */}
      <div className='px-3 h-14 border-b border-convex-border flex items-center'>
        <div className='relative w-full'>
          <svg
            className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
            />
          </svg>
          <input
            type='text'
            placeholder='Search tables or fields...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full bg-convex-darker border border-convex-border rounded-lg pl-10 pr-3 py-1.5 text-sm focus:outline-none focus:border-convex-accent'
          />
        </div>
      </div>

      {/* Tables */}
      <div className='flex-1 overflow-auto py-2'>
        {!schema ? (
          <div className='flex items-center justify-center h-32 text-gray-500 text-sm'>
            Loading schema...
          </div>
        ) : filteredTables.length === 0 ? (
          <div className='flex items-center justify-center h-32 text-gray-500 text-sm'>
            No tables found
          </div>
        ) : (
          filteredTables.map((table) => renderTable(table))
        )}
      </div>

      {/* Selected Table Fields */}
      {selectedTableInfo && (
        <div className='border-t border-convex-border' />
      )}
    </div>
  );
}
