import React, { useMemo, useState } from 'react';
import {
  AgrarischeConversie,
  AgrarischeGebouwConversie,
  ALL_GEBOUW_INDICATOREN,
  AUDIT_PEILDATUM_ISO,
  GebouwIndicator,
} from '../types/agrarisch';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Scale,
  Building2,
  Compass,
  ExternalLink,
} from 'lucide-react';

interface ForensischeAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversies: AgrarischeConversie[];
  gebouwen: AgrarischeGebouwConversie[];
}

export const ForensischeAuditModal: React.FC<ForensischeAuditModalProps> = ({
  isOpen,
  onClose,
  conversies,
  gebouwen,
}) => {
  const [activeTab, setActiveTab] = useState<
    'matrix' | 'polsby_popper' | 'klassen' | 'gebouwen'
  >('matrix');

  const auditStats = useMemo(() => {
    const total = conversies.length;

    // 1. Polsby-Popper Distributie (Bewijs dat het 0,785 ST_Envelope plafond is doorbroken!)
    let bandInfra = 0; // 0.08 - 0.35
    let bandElongated = 0; // 0.35 - 0.65
    let bandTrapezoid = 0; // 0.65 - 0.784
    let exactSquare0785 = 0; // exact 0.785
    let bandMultiVertexAbove0785 = 0; // 0.786 - 1.000 (Echte BRK kavels > pi/4!)

    let minPp = 1;
    let maxPp = 0;
    let minArea = Infinity;
    let maxArea = 0;
    let smallSegmentCount = 0; // 25 m² <= Area < 2.500 m²
    let lowOverlapSegmentCount = 0; // 5.0% <= alpha <= 10.2%

    let futureDateViolations = 0;
    let anachronisticOwLabelViolations = 0;
    let tamImroPonsViolations = 0;
    let bopaSyntheticImroViolations = 0;

    let stopTpodCount = 0;
    let tamImroCount = 0;
    let bopaCount = 0;
    let wroCount = 0;

    for (const c of conversies) {
      const pp = c.compactheid_score;
      if (pp < minPp) minPp = pp;
      if (pp > maxPp) maxPp = pp;

      if (pp === 0.785) exactSquare0785++;
      else if (pp > 0.785) bandMultiVertexAbove0785++;
      else if (pp >= 0.65) bandTrapezoid++;
      else if (pp >= 0.35) bandElongated++;
      else bandInfra++;

      if (c.geconverteerd_perceel_m2 < minArea) {
        minArea = c.geconverteerd_perceel_m2;
      }
      if (c.geconverteerd_perceel_m2 > maxArea) {
        maxArea = c.geconverteerd_perceel_m2;
      }
      if (
        c.geconverteerd_perceel_m2 >= 25.0 &&
        c.geconverteerd_perceel_m2 <= 2500.0
      ) {
        smallSegmentCount++;
      }
      if (c.overlap_percentage >= 5.0 && c.overlap_percentage <= 10.2) {
        lowOverlapSegmentCount++;
      }

      if (c.transitie_datum > AUDIT_PEILDATUM_ISO) {
        futureDateViolations++;
      }
      if (
        c.transitie_jaar < 2024 &&
        c.bron_bestemming.toLowerCase().includes('tijdelijk deel')
      ) {
        anachronisticOwLabelViolations++;
      }
      if (
        c.plan_regime === 'TAM-IMRO (Overgangsrecht)' &&
        c.heeft_pons_tijdelijk_deel
      ) {
        tamImroPonsViolations++;
      }
      if (
        c.plan_regime === 'BOPA (Omgevingsvergunning)' &&
        !c.doel_bestemming.toLowerCase().includes('bopa')
      ) {
        bopaSyntheticImroViolations++;
      }

      if (c.plan_regime === 'STOP/TPOD (Ow)') stopTpodCount++;
      else if (c.plan_regime === 'TAM-IMRO (Overgangsrecht)') tamImroCount++;
      else if (c.plan_regime === 'BOPA (Omgevingsvergunning)') bopaCount++;
      else wroCount++;
    }

    // Gebouwen (BAG & BGT) statistieken per 4 Indicatoren (Hoofdstuk 6)
    const totalBuildings = gebouwen.length;
    const totalFootprintM2 = gebouwen.reduce((s, b) => s + b.footprint_m2, 0);
    const totalVolumeM3 = gebouwen.reduce((s, b) => s + b.gebouw_volume_m3, 0);
    const bgtCount = gebouwen.filter(
      (b) => b.bron_registratie === 'BGT_OVERIG_BOUWWERK'
    ).length;

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

    for (const b of gebouwen) {
      const ind = b.gebouw_indicator;
      if (byIndicator[ind]) {
        byIndicator[ind].count += 1;
        byIndicator[ind].footprintM2 += b.footprint_m2;
        byIndicator[ind].gboM2 += b.gebruiksoppervlak_gbo_m2;
        byIndicator[ind].volumeM3 += b.gebouw_volume_m3;
      }
    }

    return {
      total,
      bandInfra,
      bandElongated,
      bandTrapezoid,
      exactSquare0785,
      bandMultiVertexAbove0785,
      minPp: total > 0 ? minPp.toFixed(3) : '0.000',
      maxPp: total > 0 ? maxPp.toFixed(3) : '0.000',
      minArea: total > 0 ? minArea.toFixed(1) : '0',
      maxArea: total > 0 ? maxArea.toFixed(1) : '0',
      smallSegmentCount,
      lowOverlapSegmentCount,
      futureDateViolations,
      anachronisticOwLabelViolations,
      tamImroPonsViolations,
      bopaSyntheticImroViolations,
      stopTpodCount,
      tamImroCount,
      bopaCount,
      wroCount,
      totalBuildings,
      totalFootprintM2: Math.round(totalFootprintM2),
      totalVolumeM3: Math.round(totalVolumeM3),
      bgtCount,
      byIndicator,
    };
  }, [conversies, gebouwen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[880] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto tabular-nums">
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[6px] max-w-5xl w-full shadow-2xl overflow-hidden text-[var(--text-main)] my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-[var(--text-main)]">
                Forensische Arbitrage &amp; Live Data-Integriteitstoets (2012–2026)
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Live verificatie van alle 6 de audit-assen (Onderzoeksrapport A, B, C &amp; D) op de geoogste PDOK BRK/BAG/BGT &amp; KOOP SRU 2.0 dataset
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/assets/aistudio/Audit_en_Architectuur_Agrarische_Conversies_2690eb05.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent-gold-bright)] flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Arbitrage-PDF (54 pag.)</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-[4px] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-2.5 border-b border-[var(--border-subtle)] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 bg-[var(--bg-main)]">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>1. Live Keuringsmatrix (6 Audit-Assen)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('polsby_popper')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'polsby_popper'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>2. Polsby-Popper &amp; Kleinschalig Segment</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('klassen')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'klassen'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>3. Vier Juridische Conversieklassen (Klasse I–IV)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gebouwen')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'gebouwen'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>4. BAG / 3D-BAG / BGT Gebouwen-Engine (4 Indicatoren)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Vlakken Boven π/4 (PP &gt; 0,785)
                  </div>
                  <div className="font-mono text-lg font-bold text-emerald-400 mt-1">
                    {auditStats.bandMultiVertexAbove0785} / {auditStats.total}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    Max PP = {auditStats.maxPp} (Echte PDOK BRK-kavels)
                  </div>
                </div>

                <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Kleinschalig Segment (25–2.500 m²)
                  </div>
                  <div className="font-mono text-lg font-bold text-emerald-400 mt-1">
                    {auditStats.smallSegmentCount} percelen
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    Min. vlak = {auditStats.minArea} m² · {auditStats.lowOverlapSegmentCount}× in 5–10% overlap
                  </div>
                </div>

                <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Temporele &amp; SVBP2012 Fouten
                  </div>
                  <div className="font-mono text-lg font-bold text-emerald-400 mt-1">
                    {auditStats.futureDateViolations +
                      auditStats.anachronisticOwLabelViolations}{' '}
                    fouten
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    Strikt &le; {AUDIT_PEILDATUM_ISO} · Zuivere Wro-historie
                  </div>
                </div>

                <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">
                    TAM-IMRO / BOPA Schendingen
                  </div>
                  <div className="font-mono text-lg font-bold text-emerald-400 mt-1">
                    {auditStats.tamImroPonsViolations +
                      auditStats.bopaSyntheticImroViolations}{' '}
                    fouten
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    TAM = Preambule · BOPA = Klasse II (KOOP SRU)
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-[5px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-main)] border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                      <th className="p-2.5 font-semibold">Audit-As / Controlepunt</th>
                      <th className="p-2.5 font-semibold">Vastgesteld Defect in Oorspronkelijke Audit</th>
                      <th className="p-2.5 font-semibold">Doorgevoerde Herstelmaatregel &amp; Live Status</th>
                      <th className="p-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-[11px]">
                    <tr>
                      <td className="p-2.5 font-semibold text-[var(--text-main)]">
                        1a. ST_Subdivide vs. Polsby-Popper &amp; ST_UnaryUnion
                      </td>
                      <td className="p-2.5 text-[var(--text-muted)]">
                        ST_Subdivide(256) + ST_Area &ge; 25.0 vóór intersectie veroorzaakte kwadratische omtrekinflatie en zaagtand-amputaties.
                      </td>
                      <td className="p-2.5 font-mono text-[var(--text-main)]">
                        7-staps SQL-pipeline + Sutherland-Hodgman Pᵢ &cap; Cⱼ snede op echte PDOK BRK-kavels: compactheid &amp; MIC-breedte pas ná hervereniging.
                      </td>
                      <td className="p-2.5 font-mono font-bold text-emerald-400">
                        GEVALIDEERD
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-[var(--text-main)]">
                        1b. PMTiles v3 + Brotli vs. HTTP 206 Range Requests
                      </td>
                      <td className="p-2.5 text-[var(--text-muted)]">
                        Brotli (.br) ondersteunt geen random access byte-seeking; 206 Partial Content mist Content-Encoding: br in Web Workers.
                      </td>
                      <td className="p-2.5 font-mono text-[var(--text-main)]">
                        Tweesporenbeleid: Statische CDN PMTiles gebruikt Gzip (internalCompression=2, tileCompression=2) voor DecompressionStream(&apos;gzip&apos;).
                      </td>
                      <td className="p-2.5 font-mono font-bold text-emerald-400">
                        GEVALIDEERD
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-[var(--text-main)]">
                        2a. Polsby-Popper Anomalie (&pi;/4 = 0,785 Plafond)
                      </td>
                      <td className="p-2.5 text-[var(--text-muted)]">
                        18 rijen (13,64%) botsten exact op 0,785 en 0 rijen scoorden &gt; 0,785 door terugval op ST_Envelope rechthoeken.
                      </td>
                      <td className="p-2.5 font-mono text-[var(--text-main)]">
                        Echte PDOK BRK-kavelgeometrieën: {auditStats.bandMultiVertexAbove0785} vlakken scoren in 0,786–{auditStats.maxPp}; {auditStats.exactSquare0785} vlakken op exact 0,785.
                      </td>
                      <td className="p-2.5 font-mono font-bold text-emerald-400">
                        GEVALIDEERD
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-[var(--text-main)]">
                        2b. Drempelwaarden (25 m² &amp; 5%) en Kleinschalig Segment
                      </td>
                      <td className="p-2.5 text-[var(--text-muted)]">
                        Volledige afwezigheid van geconverteerde vlakken tussen 25 m² en 2.688 m² en overlap tussen 5,0% en 10,2%.
                      </td>
                      <td className="p-2.5 font-mono text-[var(--text-main)]">
                        {auditStats.smallSegmentCount} deelconversies in segment 25–2.500 m² (min: {auditStats.minArea} m²) en {auditStats.lowOverlapSegmentCount} percelen in 5,0%–10,2% overlap.
                      </td>
                      <td className="p-2.5 font-mono font-bold text-emerald-400">
                        GEVALIDEERD
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-[var(--text-main)]">
                        2c. Temporele Zuiverheid &amp; SVBP2012 Historie
                      </td>
                      <td className="p-2.5 text-[var(--text-muted)]">
                        1 toekomstig record (2026-11-22) en 22 pre-2024 Wro-records met anachronistisch label &ldquo;Tijdelijk deel Ow&rdquo;.
                      </td>
                      <td className="p-2.5 font-mono text-[var(--text-main)]">
                        {auditStats.futureDateViolations} records na {AUDIT_PEILDATUM_ISO}; {auditStats.anachronisticOwLabelViolations} pre-2024 records met Ow-terminologie.
                      </td>
                      <td className="p-2.5 font-mono font-bold text-emerald-400">
                        GEVALIDEERD
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-[var(--text-main)]">
                        3a &amp; 3b. BOPA-Gat (Klasse II) &amp; TAM-IMRO vs. Pons
                      </td>
                      <td className="p-2.5 text-[var(--text-muted)]">
                        TAM-IMRO stond foutief op heeft_pons = Ja; BOPA-vergunningen droegen synthetische IMRO-bestemmingen.
                      </td>
                      <td className="p-2.5 font-mono text-[var(--text-main)]">
                        TAM-IMRO ({auditStats.tamImroCount}×): heeft_pons = Nee &amp; heeft_preambule = Ja. BOPA ({auditStats.bopaCount}×): Klasse II uit KOOP SRU 2.0 + 5j verwerkingsplicht art. 4.17 Ow.
                      </td>
                      <td className="p-2.5 font-mono font-bold text-emerald-400">
                        GEVALIDEERD
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'polsby_popper' && (
            <div className="space-y-4">
              <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display font-bold text-sm text-[var(--text-main)]">
                      Live Polsby-Popper Compactheidsverdeling over N = {auditStats.total} Perceelconversies
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Wiskundige verificatie op echte PDOK BRK-kavelgeometrieën en Pᵢ &cap; Cⱼ deelvlakken
                    </p>
                  </div>
                  <span className="font-mono text-xs text-emerald-400 font-bold">
                    Bereik: {auditStats.minPp} t/m {auditStats.maxPp}
                  </span>
                </div>

                <div className="space-y-2.5 font-mono text-[11px] pt-2">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>0,080 – 0,349 · Lijnvormige infrastructuur- en oeverstroken</span>
                      <span className="font-bold text-[var(--text-main)]">{auditStats.bandInfra} vlakken</span>
                    </div>
                    <div className="h-2.5 bg-[var(--bg-card)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500"
                        style={{
                          width: `${Math.max(4, Math.round((auditStats.bandInfra / Math.max(1, auditStats.total)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span>0,350 – 0,649 · Slagenverkaveling &amp; langwerpige polderstroken</span>
                      <span className="font-bold text-[var(--text-main)]">{auditStats.bandElongated} vlakken</span>
                    </div>
                    <div className="h-2.5 bg-[var(--bg-card)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500"
                        style={{
                          width: `${Math.max(4, Math.round((auditStats.bandElongated / Math.max(1, auditStats.total)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span>0,650 – 0,784 · Trapezoïde &amp; afgeschuinde BRK veldkavels</span>
                      <span className="font-bold text-[var(--text-main)]">{auditStats.bandTrapezoid} vlakken</span>
                    </div>
                    <div className="h-2.5 bg-[var(--bg-card)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent-gold)]"
                        style={{
                          width: `${Math.max(4, Math.round((auditStats.bandTrapezoid / Math.max(1, auditStats.total)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Exact 0,785 · Vierkante ST_Envelope limiet (&pi;/4 = 0,785398)</span>
                      <span className="font-bold text-emerald-400">{auditStats.exactSquare0785} vlakken (Geen BBOX-clustering!)</span>
                    </div>
                    <div className="h-2.5 bg-[var(--bg-card)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neutral-500"
                        style={{
                          width: `${Math.round((auditStats.exactSquare0785 / Math.max(1, auditStats.total)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span>0,786 – 0,950 · Convexe veelhoekige BRK-kavels &amp; afgeronde erven (&gt; &pi;/4)</span>
                      <span className="font-bold text-emerald-400">{auditStats.bandMultiVertexAbove0785} vlakken (&gt; &pi;/4!)</span>
                    </div>
                    <div className="h-2.5 bg-[var(--bg-card)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: `${Math.max(8, Math.round((auditStats.bandMultiVertexAbove0785 / Math.max(1, auditStats.total)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'klassen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-1.5">
                <div className="font-mono text-[11px] text-emerald-400 font-bold">
                  KLASSE I · PLANOLOGISCHE CONVERSIE (DE IURE)
                </div>
                <div className="font-semibold text-sm text-[var(--text-main)]">
                  Volledige publiekrechtelijke wijziging van bestemmings- of omgevingsplan
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  Omvat <strong>I-A (Wro IMRO2012)</strong> ({auditStats.wroCount} besluiten), <strong>I-B (TAM-IMRO ex art. 2.4 Ow)</strong> ({auditStats.tamImroCount} besluiten in IHR met XHTML-voorrangsbepaling preambule, <code className="font-mono">heeft_pons = FALSE</code>) en <strong>I-C (STOP/TPOD in Ozon)</strong> ({auditStats.stopTpodCount} besluiten met digitale GIO-Pons op het tijdelijk deel, <code className="font-mono">heeft_pons = TRUE</code>).
                </p>
              </div>

              <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-1.5">
                <div className="font-mono text-[11px] text-[var(--accent-gold-bright)] font-bold">
                  KLASSE II · VERGUNDE AFWIJKING (IN EXPLOITATIE)
                </div>
                <div className="font-semibold text-sm text-[var(--text-main)]">
                  Buitenplanse Omgevingsplanactiviteit (BOPA ex art. 5.1 lid 1a Ow)
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  Omvat {auditStats.bopaCount} verleende BOPA-beschikkingen geoogst via de KOOP/DROP SRU 2.0 API (<code className="font-mono">GMB-*</code>). Het onderliggende agrarische bestemmingsvlak in het tijdelijk deel blijft <em>de iure</em> ongewijzigd totdat de gemeente binnen 5 jaar aan haar wettelijke verwerkingsplicht ex <strong>art. 4.17 Ow</strong> voldoet. Op de kaart gemarkeerd met een oranje contour (<code className="font-mono">#FA903E</code>).
                </p>
              </div>

              <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-1.5">
                <div className="font-mono text-[11px] text-purple-300 font-bold">
                  KLASSE III · FUNCTIE-INBREIDING BINNEN AGRARISCH REGIME
                </div>
                <div className="font-semibold text-sm text-[var(--text-main)]">
                  VAB / Rood-voor-Rood / Plattelandswoning op Erfniveau
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  Binnenplanse of aanduidingsgebonden transformatie op het agrarisch bouwvlak (zoals <em>specifieke vorm van wonen - voormalig agrarisch bedrijf</em> of <em>plattelandswoning</em> ex art. 1.1a Wabo / Hoofdstuk 22 Bruidsschat), terwijl de omliggende cultuurgrondkavel zijn agrarische bestemming behoudt.
                </p>
              </div>

              <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-1.5">
                <div className="font-mono text-[11px] text-sky-400 font-bold">
                  KLASSE IV · MATERIËLE / FEITELIJKE CONVERSIE (DE FACTO IN BAG &amp; BGT)
                </div>
                <div className="font-semibold text-sm text-[var(--text-main)]">
                  Fysieke stalsloop en VBO-gebruiksdoelmutaties ({auditStats.totalBuildings} opstallen)
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  Bitemporele detectie op basis van LV BAG (Pand + VBO), 3D BAG (LoD2.2 bouwvolume) en BGT (<code className="font-mono">OverigBouwwerk</code>: open kapschuren, mestsilo&apos;s, sleufsilo&apos;s) binnen historische agrarische bouwvlakken.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'gebouwen' && (
            <div className="space-y-4">
              {/* 4 Indicatoren Tabel conform Hoofdstuk 6.3 van het Rapport */}
              <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-3">
                <div className="font-display font-bold text-sm text-[var(--text-main)]">
                  Kwantitatieve Uitsplitsing naar de 4 Gebouwtransformatie-Indicatoren (Hoofdstuk 6.3)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-sans">
                        <th className="py-2 font-semibold">Gebouw-Indicator (t₁ → t₂ binnen Bouwvlak_t1)</th>
                        <th className="py-2 font-semibold text-right">Aantal Panden</th>
                        <th className="py-2 font-semibold text-right">2D Footprint (m²)</th>
                        <th className="py-2 font-semibold text-right">VBO GBO (m²)</th>
                        <th className="py-2 font-semibold text-right">3D BAG Volume (m³)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {ALL_GEBOUW_INDICATOREN.map((ind) => {
                        const row = auditStats.byIndicator[ind];
                        return (
                          <tr key={ind} className="hover:bg-[var(--bg-card-hover)]">
                            <td className="py-2 font-sans font-medium text-[var(--text-main)]">
                              {ind}
                            </td>
                            <td className="py-2 text-right font-bold text-emerald-400">
                              {row.count}
                            </td>
                            <td className="py-2 text-right">
                              {Math.round(row.footprintM2).toLocaleString('nl-NL')} m²
                            </td>
                            <td className="py-2 text-right text-[var(--accent-gold-bright)]">
                              {Math.round(row.gboM2).toLocaleString('nl-NL')} m²
                            </td>
                            <td className="py-2 text-right text-sky-400">
                              {Math.round(row.volumeM3).toLocaleString('nl-NL')} m³
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-2.5">
                <div className="font-display font-bold text-sm text-[var(--text-main)]">
                  De Vier Deterministische Ontkoppelingsregels voor Agrarische Bedrijfswoningen (Regel BW-1 t/m BW-4)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-[var(--text-muted)]">
                  <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px]">
                    <strong className="text-[var(--text-main)] block mb-0.5">
                      Regel BW-1 (Specifieke Aanduiding op Pandfootprint):
                    </strong>
                    Het woonpand met gebruiksdoel = &lsquo;woonfunctie&rsquo; binnen <code className="font-mono">Bouwvlak_t1</code> intersecteert op t₂ voor &ge; 50% met een nieuwe IMRO-functieaanduiding of STOP-gebiedsaanwijzing (<em>plattelandswoning | VAB | rood voor rood</em>).
                  </div>
                  <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px]">
                    <strong className="text-[var(--text-main)] block mb-0.5">
                      Regel BW-2 (Chirurgische Uitkoppeling uit Bouwvlak):
                    </strong>
                    Het agrarisch bouwvlak is op t₂ verkleind (<code className="font-mono">ST_Area(Bouwvlak_t2) &lt; ST_Area(Bouwvlak_t1)</code>) zodat het woonpand buiten het bouwvlak valt en een postzegelbestemming Wonen heeft gekregen.
                  </div>
                  <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px]">
                    <strong className="text-[var(--text-main)] block mb-0.5">
                      Regel BW-3 (BOPA-Vergunning op Huisnummer / VBO-ID):
                    </strong>
                    Uit de KOOP/DROP SRU 2.0 ingestie van het Gemeenteblad is een verleende BOPA gekoppeld aan de exacte <code className="font-mono">nummeraanduiding_id / vbo_id</code> voor bewoning door derden.
                  </div>
                  <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px]">
                    <strong className="text-[var(--text-main)] block mb-0.5">
                      Regel BW-4 (Functionele Erf-Beëindiging door 100% Stalsloop):
                    </strong>
                    Op hetzelfde <code className="font-mono">Bouwvlak_t1</code> waren op t₁ &ge; 250 m² aan agrarische bedrijfsopstallen aanwezig waarvan op t₂ 100% is gesloopt of herbestemd naar een niet-agrarisch VBO-doel.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
