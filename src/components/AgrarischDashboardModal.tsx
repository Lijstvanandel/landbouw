import React, { useMemo } from 'react';
import {
  AgrarischeConversie,
  AgrarischeGebouwConversie,
  ALL_DOEL_CATEGORIEEN,
  ALL_GEBOUW_INDICATOREN,
  DOEL_CATEGORIEEN,
  DoelCategorie,
  GebouwIndicator,
} from '../types/agrarisch';
import { X, BarChart3, Download, Building2 } from 'lucide-react';

interface AgrarischDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversies: AgrarischeConversie[];
  gebouwen?: AgrarischeGebouwConversie[];
  selectedYear: number;
  onExportCSV: () => void;
}

export const AgrarischDashboardModal: React.FC<
  AgrarischDashboardModalProps
> = ({
  isOpen,
  onClose,
  conversies,
  gebouwen = [],
  selectedYear,
  onExportCSV,
}) => {
  const stats = useMemo(() => {
    const totalCount = conversies.length;
    const totalAreaM2 = conversies.reduce(
      (s, c) => s + c.geconverteerd_perceel_m2,
      0
    );
    const totalPerceelM2 = conversies.reduce(
      (s, c) => s + c.perceel_totaal_m2,
      0
    );

    const byCategory: Record<
      DoelCategorie,
      { count: number; areaM2: number }
    > = {
      Wonen: { count: 0, areaM2: 0 },
      Bedrijvigheid: { count: 0, areaM2: 0 },
      Natuur: { count: 0, areaM2: 0 },
      Energie: { count: 0, areaM2: 0 },
      Recreatie: { count: 0, areaM2: 0 },
      Infrastructuur: { count: 0, areaM2: 0 },
    };

    const byYear: Record<
      number,
      { count: number; areaM2: number; wro: number; ow: number }
    > = {};
    for (let y = 2012; y <= 2026; y++) {
      byYear[y] = { count: 0, areaM2: 0, wro: 0, ow: 0 };
    }

    const byKern: Record<string, { count: number; areaM2: number }> = {};

    let volledigCount = 0;
    let partieelCount = 0;
    let bopaCount = 0;
    let sliversEliminatedTotal = 0;

    for (const c of conversies) {
      byCategory[c.doel_categorie].count += 1;
      byCategory[c.doel_categorie].areaM2 += c.geconverteerd_perceel_m2;

      if (byYear[c.transitie_jaar]) {
        byYear[c.transitie_jaar].count += 1;
        byYear[c.transitie_jaar].areaM2 += c.geconverteerd_perceel_m2;
        if (c.transitie_jaar >= 2024) {
          byYear[c.transitie_jaar].ow += 1;
        } else {
          byYear[c.transitie_jaar].wro += 1;
        }
      }

      if (!byKern[c.kern]) {
        byKern[c.kern] = { count: 0, areaM2: 0 };
      }
      byKern[c.kern].count += 1;
      byKern[c.kern].areaM2 += c.geconverteerd_perceel_m2;

      if (c.mutatie_type === 'Volledige conversie') volledigCount++;
      else partieelCount++;

      if (c.is_bopa) bopaCount++;
      sliversEliminatedTotal += c.sliver_geelimineerd_count;
    }

    const topKernen = Object.entries(byKern)
      .map(([kern, val]) => ({ kern, ...val }))
      .sort((a, b) => b.areaM2 - a.areaM2)
      .slice(0, 10);

    const totalGebouwFootprintM2 = gebouwen.reduce(
      (s, g) => s + g.footprint_m2,
      0
    );
    const totalGebouwGboM2 = gebouwen.reduce(
      (s, g) => s + g.gebruiksoppervlak_gbo_m2,
      0
    );
    const totalGebouwVolumeM3 = gebouwen.reduce(
      (s, g) => s + g.gebouw_volume_m3,
      0
    );

    const byIndicator: Record<
      GebouwIndicator,
      { count: number; footprintM2: number; gboM2: number; volumeM3: number }
    > = {
      '1. Sloop van Agrarische Opstallen': {
        count: 0,
        footprintM2: 0,
        gboM2: 0,
        volumeM3: 0,
      },
      '2. Interne Herbestemming van Stallen/Schuren': {
        count: 0,
        footprintM2: 0,
        gboM2: 0,
        volumeM3: 0,
      },
      '3. Woning-Ontkoppeling (BW-1 t/m BW-4)': {
        count: 0,
        footprintM2: 0,
        gboM2: 0,
        volumeM3: 0,
      },
      '4. Vervangende Nieuwbouw / Rood-voor-Rood (Bouwjaar > t1)': {
        count: 0,
        footprintM2: 0,
        gboM2: 0,
        volumeM3: 0,
      },
    };

    for (const g of gebouwen) {
      if (byIndicator[g.gebouw_indicator]) {
        byIndicator[g.gebouw_indicator].count += 1;
        byIndicator[g.gebouw_indicator].footprintM2 += g.footprint_m2;
        byIndicator[g.gebouw_indicator].gboM2 += g.gebruiksoppervlak_gbo_m2;
        byIndicator[g.gebouw_indicator].volumeM3 += g.gebouw_volume_m3;
      }
    }

    return {
      totalCount,
      totalAreaHa: (totalAreaM2 / 10000).toFixed(2),
      totalPerceelHa: (totalPerceelM2 / 10000).toFixed(2),
      byCategory,
      byYear,
      topKernen,
      volledigCount,
      partieelCount,
      bopaCount,
      sliversEliminatedTotal,
      totalGebouwCount: gebouwen.length,
      totalGebouwFootprintM2: Math.round(totalGebouwFootprintM2),
      totalGebouwGboM2: Math.round(totalGebouwGboM2),
      totalGebouwVolumeM3: Math.round(totalGebouwVolumeM3),
      byIndicator,
    };
  }, [conversies, gebouwen]);

  if (!isOpen) return null;

  const maxYearCount = Math.max(
    1,
    ...Object.values(stats.byYear).map((y) => y.count)
  );

  return (
    <div className="fixed inset-0 z-[860] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto tabular-nums">
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[6px] max-w-5xl w-full shadow-2xl overflow-hidden text-[var(--text-main)] my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-[var(--accent-gold)]" />
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold">
                Kwantitatieve Analyse Agrarische Conversies (2012–{selectedYear})
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Gemeente Steenwijkerland (GM1708) · Pijler 1 (Cultuurgrond BRK) &amp; Pijler 2 (BAG 2.0 / 3D BAG / BGT Opstallen)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExportCSV}
              className="px-3 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporteer Selectie (CSV)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-[4px] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* 4 Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3.5">
              <div className="text-[11px] text-[var(--text-muted)]">
                Pijler 1 · BRK Percelen
              </div>
              <div className="font-mono text-xl font-bold text-[var(--text-main)] mt-1">
                {stats.totalCount}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                {stats.volledigCount} volledig · {stats.partieelCount} partieel (erf/strook)
              </div>
            </div>

            <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3.5">
              <div className="text-[11px] text-[var(--text-muted)]">
                Geconverteerde Cultuurgrond
              </div>
              <div className="font-mono text-xl font-bold text-[var(--accent-gold-bright)] mt-1">
                {stats.totalAreaHa} ha
              </div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                Van {stats.totalPerceelHa} ha totale kavelomvang
              </div>
            </div>

            <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3.5">
              <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pijler 2 · Agrarische Opstallen</span>
              </div>
              <div className="font-mono text-xl font-bold text-emerald-400 mt-1">
                {stats.totalGebouwCount} panden
              </div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5 font-mono">
                {stats.totalGebouwGboM2.toLocaleString('nl-NL')} m² GBO ·{' '}
                {stats.totalGebouwVolumeM3.toLocaleString('nl-NL')} m³ (3D BAG)
              </div>
            </div>

            <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3.5">
              <div className="text-[11px] text-[var(--text-muted)]">
                BOPA Klasse II (art. 4.17 Ow)
              </div>
              <div className="font-mono text-xl font-bold text-[#FA903E] mt-1">
                {stats.bopaCount}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                KOOP/DROP SRU 2.0 · {stats.sliversEliminatedTotal} slivers verworpen
              </div>
            </div>
          </div>

          {/* 4 Gebouwtransformatie-Indicatoren Overzicht (Hoofdstuk 6.3) */}
          <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-2.5">
            <div className="font-display font-bold text-sm text-[var(--text-main)]">
              Pijler 2 · Vier Kwantitatieve Gebouwtransformatie-Indicatoren (Hoofdstuk 6.3)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {ALL_GEBOUW_INDICATOREN.map((ind) => {
                const row = stats.byIndicator[ind];
                return (
                  <div
                    key={ind}
                    className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] p-3 space-y-1"
                  >
                    <div className="text-[11px] font-semibold text-[var(--text-main)] leading-snug">
                      {ind}
                    </div>
                    <div className="font-mono text-base font-bold text-emerald-400">
                      {row.count} panden
                    </div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)]">
                      Footprint: {Math.round(row.footprintM2).toLocaleString('nl-NL')} m² · GBO:{' '}
                      {Math.round(row.gboM2).toLocaleString('nl-NL')} m²
                    </div>
                    <div className="font-mono text-[10px] text-sky-400">
                      3D BAG Vol: {Math.round(row.volumeM3).toLocaleString('nl-NL')} m³
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2-Column Split: Canonieke Doelcategorieën + Top Kernen */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Doelcategorieën */}
            <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-3">
              <div className="font-display font-bold text-sm text-[var(--text-main)]">
                Verdeling naar Canonieke Doelcategorie (Agrarisch → K)
              </div>

              <div className="space-y-2.5">
                {ALL_DOEL_CATEGORIEEN.map((cat) => {
                  const meta = DOEL_CATEGORIEEN[cat];
                  const item = stats.byCategory[cat];
                  const ha = (item.areaM2 / 10000).toFixed(2);
                  const pct =
                    stats.totalCount > 0
                      ? Math.round((item.count / stats.totalCount) * 100)
                      : 0;

                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className="w-3 h-3 rounded-[2px] inline-block"
                            style={{ backgroundColor: meta.fillHex }}
                          />
                          <span>{meta.label}</span>
                        </span>
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">
                          <strong className="text-[var(--text-main)]">
                            {ha} ha
                          </strong>{' '}
                          · {item.count} percelen ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(4, pct)}%`,
                            backgroundColor: meta.fillHex,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Kernen in Steenwijkerland */}
            <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-3">
              <div className="font-display font-bold text-sm text-[var(--text-main)]">
                Geconverteerd Agrarisch Oppervlak per Kern (Top 10)
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                      <th className="py-1.5 font-semibold">Kern / Buitengebied</th>
                      <th className="py-1.5 font-semibold text-right">Percelen</th>
                      <th className="py-1.5 font-semibold text-right">Oppervlak (m²)</th>
                      <th className="py-1.5 font-semibold text-right">Hectare (ha)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] font-mono text-[11px]">
                    {stats.topKernen.map((k) => (
                      <tr key={k.kern} className="hover:bg-[var(--bg-card-hover)]">
                        <td className="py-1.5 font-sans font-medium text-[var(--text-main)]">
                          {k.kern}
                        </td>
                        <td className="py-1.5 text-right">{k.count}</td>
                        <td className="py-1.5 text-right text-[var(--text-muted)]">
                          {Math.round(k.areaM2).toLocaleString('nl-NL')} m²
                        </td>
                        <td className="py-1.5 text-right font-bold text-[var(--accent-gold-bright)]">
                          {(k.areaM2 / 10000).toFixed(2)} ha
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Longitudinal Timeline Bar Chart (2012 - 2026) */}
          <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-display font-bold text-sm text-[var(--text-main)]">
                  Longitudinale Tijdreeks Bestemmingsplanconversies (2012–2026)
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Systeemgrens 1 januari 2024: Transitie van Wro (IMRO2012 · SVBP2012) naar Omgevingswet (TAM-IMRO, STOP/TPOD &amp; BOPA art. 4.17)
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-[2px] bg-emerald-500 inline-block" />
                  <span>Wro / IMRO2012 (2012–2023)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-[2px] bg-[var(--accent-gold)] inline-block" />
                  <span>Omgevingswet / STOP-TPOD / TAM / BOPA (2024–2026)</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-15 gap-1.5 items-end h-36 pt-4">
              {Object.entries(stats.byYear).map(([yearStr, data]) => {
                const yr = Number(yearStr);
                const heightPct = Math.round((data.count / maxYearCount) * 100);
                const isOw = yr >= 2024;
                const isActive = yr <= selectedYear;

                return (
                  <div
                    key={yr}
                    className={`flex flex-col items-center gap-1 h-full justify-end ${
                      isActive ? 'opacity-100' : 'opacity-30'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">
                      {data.count}
                    </span>
                    <div className="w-full bg-[var(--bg-card)] rounded-t-[3px] flex items-end h-24 overflow-hidden">
                      <div
                        className={`w-full rounded-t-[3px] transition-all ${
                          isOw ? 'bg-[var(--accent-gold)]' : 'bg-emerald-500'
                        }`}
                        style={{ height: `${Math.max(6, heightPct)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-[var(--text-dim)]">
                      &apos;{String(yr).slice(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
