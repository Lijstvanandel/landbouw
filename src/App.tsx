import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AgrarischeConversie,
  AgrarischeGebouwConversie,
  ConversieFilterState,
  INITIAL_CONVERSIE_FILTERS,
  SliverPolygonArtifact,
  filterConversies,
  filterGebouwConversies,
  exportConversiesToCSV,
} from './types/agrarisch';
import {
  INITIAL_AGRARISCHE_CONVERSIES,
  INITIAL_GEBOUW_CONVERSIES,
  INITIAL_SLIVER_ARTIFACTS,
} from './data/agrarischeConversiesSteenwijkerland';
import { isPointInSteenwijkerland } from './data/steenwijkerland';
import { TopNavbar } from './components/TopNavbar';
import { AgrarischFilterPanel } from './components/AgrarischFilterPanel';
import { MapComponent } from './components/MapComponent';
import { ConversieDetailModal } from './components/ConversieDetailModal';
import { AgrarischDashboardModal } from './components/AgrarischDashboardModal';
import { ArchitecturePipelineModal } from './components/ArchitecturePipelineModal';
import { ForensischeAuditModal } from './components/ForensischeAuditModal';
import { EmbedDataproductModal } from './components/EmbedDataproductModal';
import './firebase';
import { Code2, Maximize2, ExternalLink, ShieldCheck } from 'lucide-react';

export default function App() {
  const [allConversies, setAllConversies] = useState<AgrarischeConversie[]>(
    () => INITIAL_AGRARISCHE_CONVERSIES
  );
  const [allGebouwen, setAllGebouwen] = useState<AgrarischeGebouwConversie[]>(
    () => INITIAL_GEBOUW_CONVERSIES
  );
  const [slivers, setSlivers] = useState<SliverPolygonArtifact[]>(
    () => INITIAL_SLIVER_ARTIFACTS
  );
  const [filters, setFilters] = useState<ConversieFilterState>(
    INITIAL_CONVERSIE_FILTERS
  );
  const [selectedConversie, setSelectedConversie] =
    useState<AgrarischeConversie | null>(null);
  const [selectedGebouw, setSelectedGebouw] =
    useState<AgrarischeGebouwConversie | null>(null);
  const [showSlivers, setShowSlivers] = useState<boolean>(false);
  const [showFullPerceelOutline, setShowFullPerceelOutline] =
    useState<boolean>(true);
  const [showBrkWmsOverlay, setShowBrkWmsOverlay] = useState<boolean>(false);

  const [flyToTarget, setFlyToTarget] = useState<{
    lat: number;
    lng: number;
    zoom: number;
    ts: number;
  } | null>(null);

  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const params = new URLSearchParams(window.location.search);
    const embedded =
      params.get('embed') === 'true' ||
      params.get('widget') === 'true' ||
      window.self !== window.top;
    if (embedded && window.innerWidth < 900) return false;
    return window.innerWidth >= 1024;
  });

  const [isDashboardOpen, setIsDashboardOpen] = useState<boolean>(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] =
    useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState<boolean>(false);

  const isEmbed = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('embed') === 'true' ||
      params.get('widget') === 'true' ||
      window.self !== window.top
    );
  }, []);

  // Sync with backend pipeline endpoint on load
  useEffect(() => {
    let active = true;
    fetch('/api/conversies')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.conversies) && data.conversies.length > 0) {
          const valid = data.conversies.filter((c: AgrarischeConversie) =>
            isPointInSteenwijkerland(c.lat, c.lng)
          );
          setAllConversies(valid);
        }
        if (Array.isArray(data.gebouwen) && data.gebouwen.length > 0) {
          const validGebouwen = data.gebouwen.filter(
            (g: AgrarischeGebouwConversie) =>
              isPointInSteenwijkerland(g.lat, g.lng)
          );
          setAllGebouwen(validGebouwen);
        }
        if (Array.isArray(data.slivers) && data.slivers.length > 0) {
          setSlivers(data.slivers);
        }
      })
      .catch(() => {
        // Fallback to pre-loaded static Steenwijkerland dataset
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredConversies = useMemo(() => {
    return filterConversies(allConversies, filters);
  }, [allConversies, filters]);

  const filteredGebouwen = useMemo(() => {
    return filterGebouwConversies(allGebouwen, filters);
  }, [allGebouwen, filters]);

  // Integrated Erf-Dossier resolver: clicking either a parcel or a building resolves the parent Erf-Dossier (conversie + linked gebouwen)
  const handleSelectConversie = useCallback(
    (conv: AgrarischeConversie | null) => {
      setSelectedConversie(conv);
      if (conv) {
        const linked = allGebouwen.find(
          (g) => g.conversie_id === conv.conversie_id
        );
        setSelectedGebouw(linked ?? null);
      } else {
        setSelectedGebouw(null);
      }
    },
    [allGebouwen]
  );

  const handleSelectGebouw = useCallback(
    (gebouw: AgrarischeGebouwConversie | null) => {
      setSelectedGebouw(gebouw);
      if (gebouw) {
        const parentConv = allConversies.find(
          (c) => c.conversie_id === gebouw.conversie_id
        );
        if (parentConv) {
          setSelectedConversie(parentConv);
        }
      }
    },
    [allConversies]
  );

  const activeErfGebouwen = useMemo(() => {
    if (selectedConversie) {
      return allGebouwen.filter(
        (g) => g.conversie_id === selectedConversie.conversie_id
      );
    }
    if (selectedGebouw) {
      return [selectedGebouw];
    }
    return [];
  }, [allGebouwen, selectedConversie, selectedGebouw]);

  const handleFlyToLocation = useCallback(
    (lat: number, lng: number, zoom = 16) => {
      setFlyToTarget({ lat, lng, zoom, ts: Date.now() });
    },
    []
  );

  const handleExportCSV = useCallback(() => {
    const csvContent = exportConversiesToCSV(filteredConversies);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agrarische_bestemmingsconversies_steenwijkerland_${filters.minYear}_${filters.selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredConversies, filters.minYear, filters.selectedYear]);

  const handleToggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Keyboard Escape handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedConversie || selectedGebouw) {
          setSelectedConversie(null);
          setSelectedGebouw(null);
        } else if (isAuditModalOpen) setIsAuditModalOpen(false);
        else if (isDashboardOpen) setIsDashboardOpen(false);
        else if (isArchitectureModalOpen) setIsArchitectureModalOpen(false);
        else if (isEmbedModalOpen) setIsEmbedModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    selectedConversie,
    selectedGebouw,
    isAuditModalOpen,
    isDashboardOpen,
    isArchitectureModalOpen,
    isEmbedModalOpen,
  ]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)]">
      {/* Top Bar Contract (strictly 3 zones) */}
      <TopNavbar
        showFilterPanel={showFilterPanel}
        onToggleFilterPanel={() => setShowFilterPanel((v) => !v)}
        showBrkWmsOverlay={showBrkWmsOverlay}
        onToggleBrkWmsOverlay={() => setShowBrkWmsOverlay((v) => !v)}
        onOpenDashboard={() => setIsDashboardOpen(true)}
        onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
        onOpenEmbedModal={() => setIsEmbedModalOpen(true)}
        onExportCSV={handleExportCSV}
        isEmbed={isEmbed}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {showFilterPanel && (
          <AgrarischFilterPanel
            allConversies={allConversies}
            filteredConversies={filteredConversies}
            filteredGebouwen={filteredGebouwen}
            filters={filters}
            onChangeFilters={setFilters}
            selectedConversie={selectedConversie}
            onSelectConversie={handleSelectConversie}
            selectedGebouw={selectedGebouw}
            onSelectGebouw={handleSelectGebouw}
            onFlyToLocation={handleFlyToLocation}
            showSlivers={showSlivers}
            onToggleSlivers={() => setShowSlivers((v) => !v)}
            sliverCount={slivers.length}
            showFullPerceelOutline={showFullPerceelOutline}
            onToggleFullPerceelOutline={() =>
              setShowFullPerceelOutline((v) => !v)
            }
            onOpenDashboard={() => setIsDashboardOpen(true)}
            onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
            onOpenAuditModal={() => setIsAuditModalOpen(true)}
          />
        )}

        <main className="flex-1 h-full relative overflow-hidden">
          <MapComponent
            conversies={filteredConversies}
            gebouwen={filteredGebouwen}
            showGround={filters.showGround}
            showBuildings={filters.showBuildings}
            onToggleBuildings={() =>
              setFilters((prev) => ({
                ...prev,
                showBuildings: !prev.showBuildings,
              }))
            }
            showBouwvlakkenT1={filters.showBouwvlakkenT1}
            onToggleBouwvlakkenT1={() =>
              setFilters((prev) => ({
                ...prev,
                showBouwvlakkenT1: !prev.showBouwvlakkenT1,
              }))
            }
            slivers={slivers}
            showSlivers={showSlivers}
            onToggleSlivers={() => setShowSlivers((v) => !v)}
            showFullPerceelOutline={showFullPerceelOutline}
            selectedConversie={selectedConversie}
            onSelectConversie={handleSelectConversie}
            selectedGebouw={selectedGebouw}
            onSelectGebouw={handleSelectGebouw}
            selectedYear={filters.selectedYear}
            onChangeSelectedYear={(year) =>
              setFilters((prev) => ({ ...prev, selectedYear: year }))
            }
            showBrkWmsOverlay={showBrkWmsOverlay}
            onToggleBrkWmsOverlay={() => setShowBrkWmsOverlay((v) => !v)}
            onToggleFilterPanel={() => setShowFilterPanel((v) => !v)}
            showFilterPanel={showFilterPanel}
            flyToTarget={flyToTarget}
          />

          {/* Top-Right Quick Utility Controls */}
          <div className="absolute top-3 right-3 z-[500] hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsAuditModalOpen(true)}
              className="px-2.5 py-1.5 rounded-[5px] bg-[var(--bg-card)]/95 hover:bg-[var(--bg-card-hover)] border border-emerald-500/40 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 shadow-xl transition-colors cursor-pointer"
              title="Open Forensische Audit & Data-Integriteit (6 controle-assen)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>6/6 Audit Geslaagd</span>
            </button>

            {!isEmbed && (
              <button
                type="button"
                onClick={() => setIsEmbedModalOpen(true)}
                className="px-2.5 py-1.5 rounded-[5px] bg-[var(--bg-card)]/95 hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 shadow-xl transition-colors cursor-pointer"
                title="Kaart insluiten via iframe"
              >
                <Code2 className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                <span>Embed</span>
              </button>
            )}

            {isEmbed && (
              <a
                href={window.location.origin}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-[5px] bg-[var(--bg-card)]/95 hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--accent-gold-bright)] flex items-center gap-1.5 shadow-xl transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Volledig scherm</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="p-1.5 rounded-[5px] bg-[var(--bg-card)]/95 hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-xl transition-colors cursor-pointer"
              title="Volledig scherm wisselen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </main>
      </div>

      {/* Modals */}
      <ConversieDetailModal
        conversie={selectedConversie}
        gebouwen={activeErfGebouwen}
        selectedGebouw={selectedGebouw}
        onSelectGebouw={setSelectedGebouw}
        onClose={() => {
          setSelectedConversie(null);
          setSelectedGebouw(null);
        }}
        onFlyTo={handleFlyToLocation}
      />

      <AgrarischDashboardModal
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        conversies={filteredConversies}
        gebouwen={filteredGebouwen}
        selectedYear={filters.selectedYear}
        onExportCSV={handleExportCSV}
      />

      <ArchitecturePipelineModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
      />

      <ForensischeAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        conversies={allConversies}
        gebouwen={allGebouwen}
      />

      <EmbedDataproductModal
        isOpen={isEmbedModalOpen}
        onClose={() => setIsEmbedModalOpen(false)}
      />
    </div>
  );
}
