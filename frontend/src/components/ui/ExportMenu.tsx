/**
 * ExportMenu — Reusable dropdown for exporting data locally.
 *
 * Provides CSV, JSON, and Markdown export options.
 * All exports happen entirely client-side — no server calls.
 * Files download directly to the user's machine.
 */

import { useState, useRef, useEffect } from 'react';
import { exportToCSV, exportToJSON, exportToMarkdown, downloadFile } from '../../lib/betBuddy';

interface ExportMenuProps {
  /** The data to export, as an array of flat objects */
  data: Record<string, unknown>[];
  /** Base filename without extension */
  filename: string;
  /** Optional label for the button */
  label?: string;
}

export default function ExportMenu({ data, filename, label = 'Export' }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleExport = (format: 'csv' | 'json' | 'md') => {
    if (data.length === 0) {
      setOpen(false);
      return;
    }

    const ts = new Date().toISOString().slice(0, 10);
    let content: string;
    let ext: string;
    let mime: string;

    switch (format) {
      case 'csv':
        content = exportToCSV(data);
        ext = 'csv';
        mime = 'text/csv';
        break;
      case 'json':
        content = exportToJSON(data);
        ext = 'json';
        mime = 'application/json';
        break;
      case 'md':
        content = exportToMarkdown(data);
        ext = 'md';
        mime = 'text/markdown';
        break;
      default:
        // Exhaustive guard — TypeScript will catch unhandled formats at compile time.
        throw new Error(`Unsupported export format: ${format as string}`);
    }

    downloadFile(content, `${filename}-${ts}.${ext}`, mime);
    setOpen(false);
  };

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        disabled={data.length === 0}
        className="glass-sm px-4 py-2 text-xs font-medium text-text-secondary
                   hover:text-white hover:bg-white/[0.06] border border-border-glass
                   transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed
                   flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {label}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl bg-[#1a1a2e] border border-border-glass
                        shadow-xl shadow-black/40 z-50 overflow-hidden">
          <button
            onClick={() => handleExport('csv')}
            className="w-full px-4 py-2.5 text-left text-xs text-text-secondary
                       hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-3"
          >
            <span className="text-win font-mono text-[10px] font-bold w-8">.csv</span>
            <span>Spreadsheet</span>
          </button>
          <button
            onClick={() => handleExport('json')}
            className="w-full px-4 py-2.5 text-left text-xs text-text-secondary
                       hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-3"
          >
            <span className="text-blue-400 font-mono text-[10px] font-bold w-8">.json</span>
            <span>Raw Data</span>
          </button>
          <button
            onClick={() => handleExport('md')}
            className="w-full px-4 py-2.5 text-left text-xs text-text-secondary
                       hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-3"
          >
            <span className="text-purple-400 font-mono text-[10px] font-bold w-8">.md</span>
            <span>Markdown</span>
          </button>
        </div>
      )}
    </div>
  );
}
