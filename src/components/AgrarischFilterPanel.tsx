import React, { useMemo, useState } from 'react';
import {
  AgrarischeConversie,
  AgrarischeGebouwConversie,
  ALL_DOEL_CATEGORIEEN,
  ALL_GEBOUW_INDICATOREN,
  ALL_PLAN_REGIMES,
  CONVERSIE_KLASSE_META,
  ConversieFilterState,
  ConversieKlasse,
  DOEL_CATEGORIEEN,
  DoelCategorie,
  GebouwIndicator,
  INITIAL_CONVERSIE_FILTERS,
  MutatieType,
  PlanRegime,
} from '../types/agrarisch';
import { STEENWIJKERLAND_KERNEN } from '../data/steenwijkerland';
import {
  Search,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  FileCode2,
  BarChart3,
  ChevronRight,
  ShieldCheck,
  Building2,
  CheckSquare,
  Square,
  Frame,
} from 'lucide-react';

interface AgrarischFilterPanelProps {
  allConversies: AgrarischeConversie[];
  filteredConversies: AgrarischeConversie[];
  filteredGebouwen: AgrarischeGebouwConversie[];
  filters: ConversieFilterState;
  onChangeFilters: React.Dispatch<React.SetStateAction<ConversieFilterState>>;
  selectedConversie: AgrarischeConversie | null;
  onSelectConversie: (conv: AgrarischeConversie) => void;
  selectedGebouw: AgrarischeGebouwConversie | null;
  onSelectGebouw: (gebouw: AgrarischeGebouwConversie) => void;
  onFlyToLocation: (lat: number, lng: number, zoom?: number) => void;
  showSlivers: boolean;
  onToggleSlivers: () => void;
  sliverCount: number;
  showFullPerceelOutline: boolean;
  onToggleFullPerceelOutline: () => void;
  onOpenDashboard: () => void;
  onOpenArchitectureModal: () => void;
  onOpenAuditModal: () => void;
}

const KLASSE_OPTIONS: { id: 'all' | ConversieKlasse; label: string }[] = [
  { id: 'all', label: 'Alle 4 klassen (Klasse I t/m IV)' },
  {
    id: 'KLASSE_I_DE_IURE',
    label: 'Klasse I — De Iure (Planologisch IMRO / TAM / STOP)',
  },
  {
    id: 'KLASSE_II_IN_EXPLOITATIE',
    label: 'Klasse II — In Exploitatie (BOPA art. 4.17 Ow)',
  },
  {
    id: 'KLASSE_III_ERF_INBREIDING',
    label: 'Klasse III — Erf-Inbreiding & Plattelandswoning (BW-1..4)',
  },
  {
    id: 'KLASSE_IV_DE_FACTO_BAG_BGT',
    label: 'Klasse IV — De Facto Fysiek (BAG / 3D BAG / BGT)',
  },
];

export const AgrarischFilterPanel: React.FC<AgrarischFilterPanelProps> = ({
  allConversies,
  filteredConversies,
  filteredGebouwen,
  filters,
  onChangeFilters,
  selectedConversie,
  onSelectConversie,
  selectedGebouw,
  onSelectGebouw,
  onFlyToLocation,
  showSlivers,
  onToggleSlivers,
  sliverCount,
  showFullPerceelOutline,
  onToggleFullPerceelOutline,
  onOpenDashboard,
  onOpenArchitectureModal,
  onOpenAuditModal,
}) => {
  const [listMode, setListMode] = useState<'GROND' | 'GEBOUW'>('GROND');

  // Compute category stats (count & total converted hectares) within current year/kern filter
  const categoryStats = useMemo(() => {
    const map: Record<DoelCategorie, { count: number; areaM2: number }> = {
      Wonen: { count: 0, areaM2: 0 },
      Bedrijvigheid: { count: 0, areaM2: 0 },
      Natuur: { count: 0, areaM2: 0 },
      Energie: { count: 0, areaM2: 0 },
      Recreatie: { count: 0, areaM2: 0 },
      Infrastructuur: { count: 0, areaM2: 0 },
    };

    for (const c of allConversies) {
      if (
        c.transitie_jaar >= filters.minYear &&
        c.transitie_jaar <= filters.selectedYear &&
        c.overlap_percentage >= filters.minOverlapPct &&
        (!filters.kern || c.kern === filters.kern)
      ) {
        map[c.doel_categorie].count += 1;
        map[c.doel_categorie].areaM2 += c.geconverteerd_perceel_m2;
      }
    }
    return map;
  }, [
    allConversies,
    filters.minYear,
    filters.selectedYear,
    filters.minOverlapPct,
    filters.kern,
  ]);

  const totalConvertedHa = useMemo(() => {
    const sumM2 = filteredConversies.reduce(
      (acc, c) => acc + c.geconverteerd_perceel_m2,
      0
    );
    return (sumM2 / 10000).toFixed(2);
  }, [filteredConversies]);

  const totalBuildingGboM2 = useMemo(() => {
    return filteredGebouwen.reduce(
      (acc, g) => acc + g.gebruiksoppervlak_gbo_m2,
      0
    );
  }, [filteredGebouwen]);

  const toggleCategory = (cat: DoelCategorie) => {
    onChangeFilters((prev) => {
      const exists = prev.categories.includes(cat);
      if (exists && prev.categories.length === 1) {
        return prev;
      }
      return {
        ...prev,
        categories: exists
          ? prev.categories.filter((c) => c !== cat)
          : [...prev.categories, cat],
      };
    });
  };

  const selectOnlyCategory = (cat: DoelCategorie) => {
    onChangeFilters((prev) => {
      if (prev.categories.length === 1 && prev.categories[0] === cat) {
        return { ...prev, categories: [...ALL_DOEL_CATEGORIEEN] };
      }
      return { ...prev, categories: [cat] };
    });
  };

  const toggleRegime = (regime: PlanRegime) => {
    onChangeFilters((prev) => {
      const exists = prev.regimes.includes(regime);
      if (exists && prev.regimes.length === 1) {
        return prev;
      }
      return {
        ...prev,
        regimes: exists
          ? prev.regimes.filter((r) => r !== regime)
          : [...prev.regimes, regime],
      };
    });
  };

  const handleReset = () => {
    onChangeFilters(INITIAL_CONVERSIE_FILTERS);
  };

  return (
    <aside className="w-full lg:w-[400px] xl:w-[420px] h-full bg-[var(--bg-card)] border-r border-[var(--border-subtle)] flex flex-col z-20 shrink-0 select-none overflow-hidden tabular-nums">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-sm font-bold text-[var(--text-main)]">
              Agrarische Conversies (Grond, Bouwvlak &amp; Opstallen)
            </h1>
            <p className="text-[11px] text-[var(--text-muted)]">
              PDOK BRK/BAG/BGT · IMRO2012 · STOP/TPOD · KOOP BOPA
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            title="Alle filters herstellen"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        {/* Top KPI Grid */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-2.5">
            <div className="text-[11px] text-[var(--text-muted)]">
              Pijler 1 · Grond
            </div>
            <div className="font-mono text-base font-bold text-[var(--text-main)] mt-0.5">
              {filteredConversies.length}
              <span className="text-[11px] font-normal text-[var(--text-dim)] ml-1">
                kavels
              </span>
            </div>
          </div>

          <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-2.5">
            <div className="text-[11px] text-[var(--text-muted)]">
              Cultuurgrond
            </div>
            <div className="font-mono text-base font-bold text-[var(--accent-gold-bright)] mt-0.5">
              {totalConvertedHa}
              <span className="text-[11px] font-normal text-[var(--text-dim)] ml-1">
                ha
              </span>
            </div>
          </div>

          <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-2.5">
            <div className="text-[11px] text-[var(--text-muted)]">
              Pijler 2 · Opstallen
            </div>
            <div className="font-mono text-base font-bold text-emerald-400 mt-0.5">
              {filteredGebouwen.length}
              <span className="text-[11px] font-normal text-[var(--text-dim)] ml-1">
                panden
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Filter Controls & Parcel/Building List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-dim)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) =>
              onChangeFilters((prev) => ({
                ...prev,
                searchQuery: e.target.value,
              }))
            }
            placeholder="Zoek perceel (STW00 E), BAG pand (170810), kern, adres of GMB..."
            className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] rounded-[5px] pl-8 pr-3 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-dim)] outline-none transition-colors"
          />
        </div>

        {/* Tweepijler-Architectuur + Bouwvlak_t1 Laagschakelaars */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                onChangeFilters((prev) => ({
                  ...prev,
                  showGround: !prev.showGround,
                }))
              }
              className={`px-3 py-2 rounded-[5px] border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                filters.showGround
                  ? 'bg-[var(--bg-elevated)] border-[var(--border-focus)] text-[var(--text-main)]'
                  : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-dim)]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                <span>Pijler 1: Grond</span>
              </span>
              <span className="font-mono text-[11px]">
                {filters.showGround ? 'Aan' : 'Uit'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeFilters((prev) => ({
                  ...prev,
                  showBuildings: !prev.showBuildings,
                }))
              }
              className={`px-3 py-2 rounded-[5px] border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                filters.showBuildings
                  ? 'bg-[var(--bg-elevated)] border-[var(--border-focus)] text-[var(--text-main)]'
                  : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-dim)]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pijler 2: Opstallen</span>
              </span>
              <span className="font-mono text-[11px]">
                {filters.showBuildings ? 'Aan' : 'Uit'}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              onChangeFilters((prev) => ({
                ...prev,
                showBouwvlakkenT1: !prev.showBouwvlakkenT1,
              }))
            }
            className={`w-full px-3 py-2 rounded-[5px] border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
              filters.showBouwvlakkenT1
                ? 'bg-[var(--bg-elevated)] border-[var(--accent-gold)] text-[var(--accent-gold-bright)]'
                : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-dim)]'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Frame className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>Historisch Agrarisch Bouwvlak (Bouwvlak_t1 contour)</span>
            </span>
            <span className="font-mono text-[11px]">
              {filters.showBouwvlakkenT1 ? 'Aan' : 'Uit'}
            </span>
          </button>
        </div>

        {/* Section 1: Tijdschuif (Peildatum t1 -> t2, begrensd op 2026-10-23) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-main)]">
              1. Temporele Tijdschuif (t₁ → t₂ ≤ 23-10-2026)
            </span>
            <span className="font-mono text-xs font-bold text-[var(--accent-gold-bright)]">
              {filters.minYear} t/m {filters.selectedYear}
            </span>
          </div>

          <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Bronpeildatum t₁: 01-01-{filters.minYear}</span>
              <span>
                Doelpeildatum t₂:{' '}
                {filters.selectedYear === 2026
                  ? '23-10-2026'
                  : `31-12-${filters.selectedYear}`}
              </span>
            </div>

            <input
              type="range"
              min={2012}
              max={2026}
              step={1}
              value={filters.selectedYear}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  selectedYear: Number(e.target.value),
                }))
              }
              className="w-full accent-[var(--accent-gold)] cursor-pointer h-1.5 bg-[var(--bg-elevated)] rounded-lg"
            />

            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)]">
              <span>2012 (IMRO2012)</span>
              <span>2018</span>
              <span>2024 (Ow / STOP)</span>
              <span>23-10-2026</span>
            </div>
          </div>
        </div>

        {/* Section 2: Canonieke Doelcategorieën (Agrarisch -> K) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-main)]">
              2. Canonieke Doelcategorie (S(x, t₂) = K)
            </span>
            <button
              type="button"
              onClick={() =>
                onChangeFilters((prev) => ({
                  ...prev,
                  categories: [...ALL_DOEL_CATEGORIEEN],
                }))
              }
              className="text-[11px] text-[var(--accent-gold-bright)] hover:underline cursor-pointer"
            >
              Selecteer alle
            </button>
          </div>

          <div className="space-y-1.5">
            {ALL_DOEL_CATEGORIEEN.map((catKey) => {
              const meta = DOEL_CATEGORIEEN[catKey];
              const active = filters.categories.includes(catKey);
              const stat = categoryStats[catKey];
              const ha = (stat.areaM2 / 10000).toFixed(2);

              return (
                <div
                  key={catKey}
                  className={`flex items-center justify-between gap-2 p-2 rounded-[5px] border transition-colors ${
                    active
                      ? 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-main)]'
                      : 'bg-[var(--bg-main)]/40 border-transparent text-[var(--text-dim)] opacity-60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(catKey)}
                    className="flex items-center gap-2.5 flex-1 text-left cursor-pointer min-w-0"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-[3px] shrink-0 border border-black/40"
                      style={{ backgroundColor: meta.fillHex }}
                    />
                    <div className="truncate">
                      <div className="text-xs font-medium truncate">
                        {meta.label}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                    <span className="text-[var(--text-muted)]">{ha} ha</span>
                    <span className="text-[var(--text-dim)]">·</span>
                    <button
                      type="button"
                      onClick={() => selectOnlyCategory(catKey)}
                      className="text-[var(--text-main)] font-semibold hover:text-[var(--accent-gold-bright)] cursor-pointer"
                      title="Filter alleen op deze categorie"
                    >
                      {stat.count}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Juridische Regime-Scheiding, 4 Conversieklassen & 4 Gebouw-Indicatoren */}
        <div className="space-y-2.5 pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-main)]">
              3. Juridisch Regime, Statusklasse &amp; Gebouw-Indicator
            </span>
          </div>

          {/* 4 PlanRegime Checkboxes */}
          <div className="grid grid-cols-1 gap-1.5 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-2.5 text-xs">
            {ALL_PLAN_REGIMES.map((regime) => {
              const checked = filters.regimes.includes(regime);
              const isBopa = regime === 'BOPA (Omgevingsvergunning)';
              return (
                <button
                  key={regime}
                  type="button"
                  onClick={() => toggleRegime(regime)}
                  className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-[4px] hover:bg-[var(--bg-card-hover)] text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    {checked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[var(--accent-gold)] shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-[var(--text-dim)] shrink-0" />
                    )}
                    <span
                      className={
                        checked
                          ? 'text-[var(--text-main)] font-medium'
                          : 'text-[var(--text-dim)]'
                      }
                    >
                      {regime}
                    </span>
                  </span>
                  {isBopa && (
                    <span className="text-[10px] font-mono text-[#FA903E]">
                      Oranje contour
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Juridische Statusklasse (Klasse I t/m IV)
              </label>
              <select
                value={filters.conversieKlasse}
                onChange={(e) =>
                  onChangeFilters((prev) => ({
                    ...prev,
                    conversieKlasse: e.target.value as 'all' | ConversieKlasse,
                  }))
                }
                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none cursor-pointer"
              >
                {KLASSE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Pijler 2 · Gebouwtransformatie-Indicator (Hoofdstuk 6)
              </label>
              <select
                value={filters.gebouwIndicator}
                onChange={(e) =>
                  onChangeFilters((prev) => ({
                    ...prev,
                    gebouwIndicator: e.target.value as 'all' | GebouwIndicator,
                  }))
                }
                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none cursor-pointer"
              >
                <option value="all">
                  Alle 4 Gebouw-Indicatoren (Sloop / Herbestemming / BW /
                  Rood-voor-Rood)
                </option>
                {ALL_GEBOUW_INDICATOREN.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Kern / Deelgebied
              </label>
              <select
                value={filters.kern}
                onChange={(e) => {
                  const val = e.target.value;
                  onChangeFilters((prev) => ({ ...prev, kern: val }));
                  if (val) {
                    const found = STEENWIJKERLAND_KERNEN.find(
                      (k) => k.name === val
                    );
                    if (found) {
                      onFlyToLocation(found.lat, found.lng, found.zoom);
                    }
                  }
                }}
                className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none cursor-pointer"
              >
                <option value="">Hele Steenwijkerland ({STEENWIJKERLAND_KERNEN.length} kernen)</option>
                {STEENWIJKERLAND_KERNEN.map((k) => (
                  <option key={k.name} value={k.name}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Kadastrale Koppeling (DKK v5) & Multi-Vertex Topologische Filters */}
        <div className="space-y-2.5 pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>4. Kadastrale Impact &amp; Topologische Filters</span>
            </span>
          </div>

          {/* Mutatietype Segmented Control */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] text-[11px]">
            {(
              [
                { id: 'all', label: 'Alle kavels' },
                { id: 'Volledige conversie', label: 'Volledig (≥85%)' },
                { id: 'Partiële conversie', label: 'Partieel (5–85%)' },
              ] as { id: 'all' | MutatieType; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onChangeFilters((prev) => ({
                    ...prev,
                    mutatieType: opt.id,
                  }))
                }
                className={`py-1.5 px-2 rounded-[4px] font-medium transition-colors cursor-pointer truncate ${
                  filters.mutatieType === opt.id
                    ? 'bg-[var(--bg-elevated)] text-[var(--accent-gold-bright)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Overlap Percentage & Polsby-Popper Sliders */}
          <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-muted)]">
                Min. perceeloverlap αᵢⱼ = Area(Pᵢ ∩ Cⱼ) / Area(Pᵢ)
              </span>
              <span className="font-mono font-bold text-[var(--text-main)]">
                ≥ {filters.minOverlapPct}%
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={85}
              step={5}
              value={filters.minOverlapPct}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  minOverlapPct: Number(e.target.value),
                }))
              }
              className="w-full accent-[var(--accent-gold)] cursor-pointer h-1.5 bg-[var(--bg-elevated)] rounded-lg"
            />

            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-[var(--text-muted)]">
                Polsby-Popper Compactheidsindex PP(G) (echte BRK-snede)
              </span>
              <span className="font-mono font-bold text-[var(--text-main)]">
                ≥ {filters.minPolsbyPopper.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.08}
              max={0.88}
              step={0.02}
              value={filters.minPolsbyPopper}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  minPolsbyPopper: Number(e.target.value),
                }))
              }
              className="w-full accent-[var(--accent-gold)] cursor-pointer h-1.5 bg-[var(--bg-elevated)] rounded-lg"
            />
          </div>

          {/* Geometrische Overlay Toggles */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={onToggleFullPerceelOutline}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-[5px] border text-xs transition-colors cursor-pointer ${
                showFullPerceelOutline
                  ? 'bg-[var(--bg-elevated)] border-[var(--border-focus)] text-[var(--text-main)]'
                  : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Toon resterende agrarische veldkavel (Moederperceel)</span>
              </span>
              <span className="font-mono text-[11px]">
                {showFullPerceelOutline ? 'Aan' : 'Uit'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleSlivers}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-[5px] border text-xs transition-colors cursor-pointer ${
                showSlivers
                  ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200'
                  : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Toon geëlimineerde GBKN/BGT Slivers ({sliverCount})</span>
              </span>
              <span className="font-mono text-[11px]">
                {showSlivers ? 'Zichtbaar' : 'Gefilterd'}
              </span>
            </button>
          </div>

          {/* Action Buttons to open Deep-Dive Modals */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              type="button"
              onClick={onOpenAuditModal}
              className="px-2.5 py-2 rounded-[5px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[11px] font-semibold text-emerald-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Open Forensische Audit & Data-Integriteit (6 controle-assen)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>6-Assen Audit</span>
            </button>

            <button
              type="button"
              onClick={onOpenDashboard}
              className="px-2.5 py-2 rounded-[5px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-main)] flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-gold)] shrink-0" />
              <span>Statistieken</span>
            </button>

            <button
              type="button"
              onClick={onOpenArchitectureModal}
              className="px-2.5 py-2 rounded-[5px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-main)] flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>PostGIS &amp; PDF</span>
            </button>
          </div>
        </div>

        {/* Section 5: Geconverteerde Kadastrale Percelen & Opstallen Lijst */}
        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
          <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] text-xs">
            <button
              type="button"
              onClick={() => setListMode('GROND')}
              className={`py-1.5 px-2 rounded-[4px] font-semibold transition-colors cursor-pointer ${
                listMode === 'GROND'
                  ? 'bg-[var(--bg-elevated)] text-[var(--accent-gold-bright)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Erven &amp; Kavels ({filteredConversies.length})
            </button>
            <button
              type="button"
              onClick={() => setListMode('GEBOUW')}
              className={`py-1.5 px-2 rounded-[4px] font-semibold transition-colors cursor-pointer ${
                listMode === 'GEBOUW'
                  ? 'bg-[var(--bg-elevated)] text-emerald-300'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Opstallen ({filteredGebouwen.length})
            </button>
          </div>

          {listMode === 'GROND' ? (
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {filteredConversies.slice(0, 80).map((item) => {
                const catMeta = DOEL_CATEGORIEEN[item.doel_categorie];
                const klasseMeta = CONVERSIE_KLASSE_META[item.conversie_klasse];
                const isSelected =
                  selectedConversie?.conversie_id === item.conversie_id;

                return (
                  <button
                    key={item.conversie_id}
                    type="button"
                    onClick={() => {
                      onSelectConversie(item);
                      onFlyToLocation(item.lat, item.lng, 16);
                    }}
                    className={`w-full text-left p-2.5 rounded-[5px] border transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-[var(--bg-elevated)] border-[var(--accent-gold)]'
                        : 'bg-[var(--bg-main)] border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-main)]">
                        <span
                          className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                          style={{ backgroundColor: catMeta.fillHex }}
                        />
                        <span className="font-mono">
                          {item.kadastrale_gemeente_code} {item.sectie}{' '}
                          {item.perceelnummer}
                        </span>
                        <span className="text-[var(--text-dim)]">·</span>
                        <span
                          className="font-mono text-[10px]"
                          style={{ color: klasseMeta.badgeColor }}
                        >
                          {klasseMeta.shortLabel}
                        </span>
                        <span className="text-[var(--text-dim)]">·</span>
                        <span className="truncate text-[var(--text-muted)] font-normal">
                          {item.kern}
                        </span>
                      </div>

                      <div className="text-[11px] text-[var(--text-muted)] truncate">
                        {item.bron_bestemming} →{' '}
                        <strong className="text-[var(--text-main)]">
                          {item.doel_categorie}
                        </strong>{' '}
                        ({item.plan_regime})
                      </div>

                      <div className="text-[10px] text-[var(--text-dim)] font-mono">
                        {item.transitie_datum} ·{' '}
                        {item.geconverteerd_perceel_m2.toLocaleString('nl-NL')}{' '}
                        m² ({item.overlap_percentage}%) · PP={item.compactheid_score}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-[var(--text-dim)] shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              <div className="text-[11px] text-[var(--text-muted)] px-1">
                Totaal geconverteerd GBO: {totalBuildingGboM2.toLocaleString('nl-NL')} m²
              </div>
              {filteredGebouwen.map((g) => {
                const catMeta = DOEL_CATEGORIEEN[g.doel_categorie];
                const isSelected =
                  selectedGebouw?.gebouw_conversie_id === g.gebouw_conversie_id;
                return (
                  <button
                    key={`${g.gebouw_conversie_id}-${g.gebouw_id}`}
                    type="button"
                    onClick={() => {
                      onSelectGebouw(g);
                      onFlyToLocation(g.lat, g.lng, 17);
                    }}
                    className={`w-full text-left p-2.5 rounded-[5px] border transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-[var(--bg-elevated)] border-emerald-400'
                        : 'bg-[var(--bg-main)] border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-main)]">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{g.adres}</span>
                        <span className="text-[var(--text-dim)]">·</span>
                        <span className="text-[var(--text-muted)] font-normal">
                          {g.kern}
                        </span>
                      </div>

                      <div className="text-[11px] text-[var(--text-muted)] truncate">
                        {g.gebruiksdoel_t1} →{' '}
                        <strong style={{ color: catMeta.fillHex }}>
                          {g.gebouw_conversie_type}
                        </strong>
                      </div>

                      <div className="text-[10px] text-[var(--text-dim)] font-mono">
                        {g.gebouw_indicator.split('(')[0].trim()} · Bouwjaar{' '}
                        {g.oorspronkelijk_bouwjaar} · {g.footprint_m2} m²
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-[var(--text-dim)] shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
