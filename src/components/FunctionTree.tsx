import { useState } from 'react';
import { SchemaInfo, ModuleInfo, FunctionInfo } from '../stores/schema-store';

interface FunctionTreeProps {
  schema: SchemaInfo | null;
  selectedFunction: FunctionInfo | null;
  onSelectFunction: (func: FunctionInfo | null) => void;
}

export function FunctionTree({
  schema,
  selectedFunction,
  onSelectFunction,
}: FunctionTreeProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState('');

  const toggleModule = (path: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const filterModules = (modules: ModuleInfo[]): ModuleInfo[] => {
    if (!searchQuery) return modules;

    const query = searchQuery.toLowerCase();

    return modules
      .map((module) => {
        const filteredFunctions = module.functions.filter(
          (f) =>
            f.name.toLowerCase().includes(query) ||
            f.path.toLowerCase().includes(query)
        );
        const filteredChildren = filterModules(module.children);

        if (filteredFunctions.length > 0 || filteredChildren.length > 0) {
          return {
            ...module,
            functions: filteredFunctions,
            children: filteredChildren,
          };
        }
        return null;
      })
      .filter((m): m is ModuleInfo => m !== null);
  };

  const renderModule = (module: ModuleInfo, depth: number = 0) => {
    const isExpanded =
      expandedModules.has(module.path) || searchQuery.length > 0;
    const hasChildren =
      module.functions.length > 0 || module.children.length > 0;

    return (
      <div key={module.path}>
        <button
          onClick={() => toggleModule(module.path)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-convex-border text-left text-sm transition-colors`}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          {hasChildren && (
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 5l7 7-7 7'
              />
            </svg>
          )}
          <svg
            className='w-4 h-4 text-yellow-500'
            fill='currentColor'
            viewBox='0 0 24 24'
          >
            <path d='M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z' />
          </svg>
          <span className='text-gray-300'>{module.name}</span>
        </button>

        {isExpanded && (
          <>
            {module.functions.map((func) => renderFunction(func, depth + 1))}
            {module.children.map((child) => renderModule(child, depth + 1))}
          </>
        )}
      </div>
    );
  };

  const renderFunction = (func: FunctionInfo, depth: number) => {
    const isSelected = selectedFunction?.path === func.path;
    const typeColors = {
      query: 'text-blue-400',
      mutation: 'text-orange-400',
      action: 'text-purple-400',
    };
    const typeBgColors = {
      query: 'bg-blue-900/30',
      mutation: 'bg-orange-900/30',
      action: 'bg-purple-900/30',
    };

    return (
      <button
        key={func.path}
        onClick={() => onSelectFunction(func)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
          isSelected
            ? 'bg-convex-accent/20 text-white'
            : 'hover:bg-convex-border text-gray-400'
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <span
          className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${typeColors[func.type]} ${typeBgColors[func.type]}`}
        >
          {func.type.charAt(0).toUpperCase()}
        </span>
        <span className={isSelected ? 'text-white' : 'text-gray-300'}>
          {func.name}
        </span>
      </button>
    );
  };

  const filteredModules = schema ? filterModules(schema.modules) : [];

  return (
    <div className='flex flex-col h-full'>
      {/* Search */}
      <div className='p-3 border-b border-convex-border'>
        <div className='relative'>
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
            placeholder='Search functions...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full bg-convex-darker border border-convex-border rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:border-convex-accent'
          />
        </div>
      </div>

      {/* Tree */}
      <div className='flex-1 overflow-auto py-2'>
        {!schema ? (
          <div className='flex items-center justify-center h-32 text-gray-500 text-sm'>
            Loading schema...
          </div>
        ) : filteredModules.length === 0 ? (
          <div className='flex items-center justify-center h-32 text-gray-500 text-sm'>
            No functions found
          </div>
        ) : (
          filteredModules.map((module) => renderModule(module))
        )}
      </div>

      {/* Legend */}
      <div className='p-3 border-t border-convex-border'>
        <div className='flex items-center gap-4 text-xs text-gray-500'>
          <span className='flex items-center gap-1'>
            <span className='text-blue-400 bg-blue-900/30 px-1 rounded'>Q</span>
            Query
          </span>
          <span className='flex items-center gap-1'>
            <span className='text-orange-400 bg-orange-900/30 px-1 rounded'>
              M
            </span>
            Mutation
          </span>
          <span className='flex items-center gap-1'>
            <span className='text-purple-400 bg-purple-900/30 px-1 rounded'>
              A
            </span>
            Action
          </span>
        </div>
      </div>
    </div>
  );
}
