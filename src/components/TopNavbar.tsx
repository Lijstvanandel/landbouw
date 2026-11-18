import React from 'react';
import { Download } from 'lucide-react';

interface TopNavbarProps {
  showFilterPanel: boolean;
  onToggleFilterPanel: () => void;
  showBrkWmsOverlay: boolean;
  onToggleBrkWmsOverlay: () => void;
  onOpenDashboard: () => void;
  onOpenArchitectureModal: () => void;
  onOpenAuditModal: () => void;
  onOpenEmbedModal: () => void;
  onExportCSV: () => void;
  isEmbed?: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  showFilterPanel,
  onToggleFilterPanel,
  showBrkWmsOverlay,
  onToggleBrkWmsOverlay,
  onOpenDashboard,
  onOpenArchitectureModal,
  onOpenAuditModal,
  onOpenEmbedModal,
  onExportCSV,
  isEmbed = false,
}) => {
  return (
    <header className="h-14 bg-[var(--bg-card)] border-b border-[var(--border-subtle)] px-4 md:px-6 flex items-center justify-between gap-8 z-30 shrink-0 select-none">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
        }}
        className="font-display text-base md:text-lg font-bold tracking-tight text-[var(--text-main)] whitespace-nowrap shrink-0"
      >
        Agrarische Bestemmingsconversies Steenwijkerland
      </a>

      {/* Zone 2: 5 concise single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-muted)]">
        <button
          type="button"
          onClick={onToggleFilterPanel}
          className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 ${
            showFilterPanel
              ? 'text-[var(--text-main)] border-[var(--accent-gold)]'
              : 'border-transparent'
          }`}
        >
          Filterpaneel
        </button>

        <button
          type="button"
          onClick={onOpenAuditModal}
          className="hover:text-[var(--text-main)] text-emerald-300/90 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 border-transparent hover:border-emerald-400"
        >
          Forensische Audit (6-Assen)
        </button>

        <button
          type="button"
          onClick={onOpenDashboard}
          className="hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 border-transparent hover:border-[var(--border-focus)]"
        >
          Conversie-Analyse
        </button>

        <button
          type="button"
          onClick={onOpenArchitectureModal}
          className="hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 border-transparent hover:border-[var(--border-focus)]"
        >
          PostGIS &amp; PMTiles
        </button>

        {!isEmbed ? (
          <button
            type="button"
            onClick={onOpenEmbedModal}
            className="hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 border-transparent hover:border-[var(--border-focus)]"
          >
            Insluiten
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleBrkWmsOverlay}
            className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 ${
              showBrkWmsOverlay
                ? 'text-[var(--text-main)] border-[var(--accent-gold)]'
                : 'border-transparent'
            }`}
          >
            BRK Grenzen (DKK v5)
          </button>
        )}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onExportCSV}
          className="px-4 py-2 text-xs font-semibold text-[#060e0a] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] rounded-[5px] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download CSV</span>
        </button>
      </div>
    </header>
  );
};
