import React, { useState } from 'react';
import {
  AgrarischeConversie,
  AgrarischeGebouwConversie,
  CONVERSIE_KLASSE_META,
  DOEL_CATEGORIEEN,
  ONTKOPPELINGS_REGELS_BW,
} from '../types/agrarisch';
import {
  X,
  MapPin,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Database,
  RefreshCw,
  Building2,
  Layers,
  GitBranch,
  FileText,
} from 'lucide-react';

interface ConversieDetailModalProps {
  conversie: AgrarischeConversie | null;
  gebouwen: AgrarischeGebouwConversie[];
  selectedGebouw?: AgrarischeGebouwConversie | null;
  onSelectGebouw?: (gebouw: AgrarischeGebouwConversie) => void;
  onClose: () => void;
  onFlyTo: (lat: number, lng: number, zoom?: number) => void;
}

interface LiveBrkParcel {
  identificatie_lokaal_id: string;
  kadastrale_gemeente_code: string;
  kadastrale_gemeente_naam: string;
  sectie: string;
  perceelnummer: string;
  kadastrale_grootte_m2: number;
  berekend_oppervlak_m2: number;
  omtrek_m: number;
  polsby_popper: number;
  mbc_reock_ratio?: number;
  inwendige_breedte_m?: number;
  aantal_hoekpunten?: number;
}

interface LiveBgtPand {
  bgt_lokaal_id: string;
  bag_pnd_identificatie: string;
  status: string;
  footprint_m2: number;
  aantal_hoekpunten: number;
}

interface LiveKoopRecord {
  identifier: string;
  title: string;
  date: string;
  type: string;
  creator: string;
}

export const ConversieDetailModal: React.FC<ConversieDetailModalProps> = ({
  conversie,
  gebouwen,
  selectedGebouw = null,
  onSelectGebouw,
  onClose,
  onFlyTo,
}) => {
  const [isCheckingBrk, setIsCheckingBrk] = useState(false);
  const [liveBrkResult, setLiveBrkResult] = useState<{
    source: string;
    parcels: LiveBrkParcel[];
    bgt_panden?: LiveBgtPand[];
  } | null>(null);
  const [brkError, setBrkError] = useState<string | null>(null);

  const [isCheckingKoop, setIsCheckingKoop] = useState(false);
  const [liveKoopRecords, setLiveKoopRecords] = useState<LiveKoopRecord[] | null>(
    null
  );

  if (!conversie && gebouwen.length === 0 && !selectedGebouw) return null;

  const activeGebouw = selectedGebouw || gebouwen[0] || null;
  const catMeta = conversie
    ? DOEL_CATEGORIEEN[conversie.doel_categorie]
    : activeGebouw
    ? DOEL_CATEGORIEEN[activeGebouw.doel_categorie]
    : DOEL_CATEGORIEEN.Wonen;

  const klasseMeta = conversie
    ? CONVERSIE_KLASSE_META[conversie.conversie_klasse]
    : activeGebouw
    ? CONVERSIE_KLASSE_META[activeGebouw.conversie_klasse]
    : CONVERSIE_KLASSE_META.KLASSE_I_DE_IURE;

  const handleVerifyLiveBrk = async () => {
    const targetLat = conversie?.lat ?? activeGebouw?.lat;
    const targetLng = conversie?.lng ?? activeGebouw?.lng;
    if (!targetLat || !targetLng) return;

    setIsCheckingBrk(true);
    setBrkError(null);
    try {
      const res = await fetch('/api/brk/live-perceel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: targetLat, lng: targetLng }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBrkError(data.error || 'Kon PDOK BRK/BGT API niet raadplegen.');
      } else {
        setLiveBrkResult(data);
      }
    } catch (e: any) {
      setBrkError(e?.message || 'Netwerkfout bij PDOK BRK/BGT OGC API.');
    } finally {
      setIsCheckingBrk(false);
    }
  };

  const handleVerifyLiveKoop = async () => {
    setIsCheckingKoop(true);
    try {
      const res = await fetch('/api/koop/live-bopa');
      const data = await res.json();
      if (res.ok && Array.isArray(data.records)) {
        setLiveKoopRecords(data.records);
      }
    } catch {
      // ignore
    } finally {
      setIsCheckingKoop(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[850] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto tabular-nums">
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[6px] max-w-4xl w-full shadow-2xl overflow-hidden text-[var(--text-main)] my-auto max-h-[92vh] flex flex-col">
        {/* Top Header: Integraal Erf-Dossier */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] font-mono">
              <span className="text-[var(--accent-gold-bright)] font-semibold">
                INTEGRAAL ERF-DOSSIER (GROND + BOUWVLAK t₁ + OPSTALLEN)
              </span>
              {conversie && (
                <>
                  <span>·</span>
                  <span>
                    Perceel {conversie.kadastrale_gemeente_code}{' '}
                    {conversie.sectie} {conversie.perceelnummer}
                  </span>
                  <span>·</span>
                  <span>BRK ID {conversie.brk_perceel_id}</span>
                  <span>·</span>
                  <span
                    className="font-semibold"
                    style={{ color: klasseMeta.badgeColor }}
                  >
                    {klasseMeta.shortLabel}
                  </span>
                </>
              )}
            </div>
            <h2 className="font-display text-lg font-bold text-[var(--text-main)] flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-[3px] shrink-0 border border-black/40"
                style={{ backgroundColor: catMeta.fillHex }}
              />
              <span>
                {conversie
                  ? `${conversie.adres_locatie} (${conversie.kern})`
                  : `${activeGebouw?.adres} (${activeGebouw?.kern})`}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const lat = conversie?.lat ?? activeGebouw?.lat ?? 52.785;
                const lng = conversie?.lng ?? activeGebouw?.lng ?? 6.12;
                onFlyTo(lat, lng, 17);
                onClose();
              }}
              className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--accent-gold-bright)] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Zoom op Erf-Ensemble</span>
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

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* DEEL 1: Planologische & Kadastrale Kaveltransitie (Pijler 1) */}
          {conversie && (
            <>
              <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    <span>
                      Pijler 1 · Planologische Kaveltransitie ({klasseMeta.label})
                    </span>
                  </span>
                  <span className="font-mono">
                    Inwerkingtreding: {conversie.transitie_datum} (
                    {conversie.plan_regime})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                  {/* Fase A */}
                  <div className="md:col-span-5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[5px] p-3 space-y-1">
                    <div className="text-[11px] text-[var(--text-dim)] font-mono">
                      Fase A · Bronstatus S(x, t₁) = AGRARISCH
                    </div>
                    <div className="text-sm font-bold text-emerald-400">
                      {conversie.bron_bestemming}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                      Bronplan: {conversie.bron_plan_id}
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)]">
                      Zuivere SVBP2012 bronbestemming op t₁
                    </div>
                  </div>

                  <div className="md:col-span-1 flex justify-center">
                    <ArrowRight className="w-5 h-5 text-[var(--accent-gold)]" />
                  </div>

                  {/* Fase B */}
                  <div className="md:col-span-5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[5px] p-3 space-y-1">
                    <div className="text-[11px] text-[var(--text-dim)] font-mono">
                      Fase B · Doeltransitie S(x, t₂) ={' '}
                      {conversie.doel_categorie.toUpperCase()}
                    </div>
                    <div
                      className="text-sm font-bold"
                      style={{ color: catMeta.fillHex }}
                    >
                      {conversie.doel_categorie} — {conversie.doel_bestemming}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                      Doelbesluit: {conversie.doel_plan_id}
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)] truncate">
                      {conversie.doel_plan_naam} (Z-order rangorde{' '}
                      {conversie.plan_rangorde})
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-muted)] leading-relaxed pt-1 border-t border-[var(--border-subtle)]">
                  {conversie.toelichting}
                </p>
              </div>

              {/* Juridisch Regime Specifieke Verificatie */}
              <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3.5 flex items-start gap-3">
                {conversie.is_bopa ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-[var(--accent-gold)] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-[var(--accent-gold-bright)]">
                        Klasse II (In Exploitatie): BOPA-Omgevingsvergunning met
                        5-jarige Verwerkingsplicht (art. 4.17 Ow)
                      </div>
                      <p className="text-[var(--text-muted)] leading-relaxed">
                        Geoogst via KOOP/DROP SRU 2.0 ({conversie.doel_plan_id}
                        ). De BOPA vormt een publiekrechtelijke toestemming om
                        af te wijken van het omgevingsplan zonder directe
                        geometrische Pons (`heeft_pons_tijdelijk_deel = false`).
                        Wettelijke uiterste datum voor planverwerking ex art.
                        4.17 lid 1 Ow:{' '}
                        <span className="font-mono font-bold text-[var(--text-main)]">
                          {conversie.verwerkingsplicht_uiterlijk_op}
                        </span>
                        .
                      </p>
                    </div>
                  </>
                ) : conversie.plan_regime === 'TAM-IMRO (Overgangsrecht)' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-sky-300">
                        Klasse I (De Iure): TAM-IMRO Voorrangsbepaling Preambule
                        Geverifieerd
                      </div>
                      <p className="text-[var(--text-muted)] leading-relaxed">
                        Dit TAM-IMRO besluit is gepubliceerd via de
                        IMRO2012-keten en genereert technisch géén STOP-conforme
                        `Pons` (`heeft_pons_tijdelijk_deel = false`), maar zet
                        het voorgaande bestemmingsplan rechtsgeldig buiten
                        werking via een expliciete juridische voorrangsbepaling
                        in de preambule (`heeft_voorrangsbepaling_preambule =
                        true`).
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-emerald-300">
                        Klasse I (De Iure): Formele Planologische Doorhaling
                        Geverifieerd
                      </div>
                      <p className="text-[var(--text-muted)] leading-relaxed">
                        De voorgaande agrarische bestemming en bijbehorende
                        agrarische kernactiviteiten zijn ter plaatse van het
                        conversievlak formeel vervallen verklaard (
                        {conversie.heeft_pons_tijdelijk_deel
                          ? 'inclusief expliciete STOP/TPOD Pons op het tijdelijk deel van het omgevingsplan'
                          : 'via vlakdekkende planoverschrijving onder de Wro / IMRO2012'}
                        ).
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Kadastrale Koppeling (Drietraps-algoritme + Pre-Splitsing Moederperceel) & Exacte Multi-Vertex Topologie */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-2.5">
                  <div className="font-semibold text-[var(--text-main)] flex items-center justify-between">
                    <span>Drietraps Kadastrale Koppeling (PDOK BRK v5)</span>
                    <span className="font-mono text-[10px] text-emerald-400">
                      Echte BRK Geometrie
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">
                        Totale perceeloppervlakte Area(Pᵢ):
                      </span>
                      <span className="font-mono font-semibold">
                        {conversie.perceel_totaal_m2.toLocaleString('nl-NL')} m²
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">
                        Geconverteerd oppervlak Aᵢⱼ = Area(Pᵢ ∩ Cⱼ):
                      </span>
                      <span className="font-mono font-semibold text-[var(--accent-gold-bright)]">
                        {conversie.geconverteerd_perceel_m2.toLocaleString(
                          'nl-NL'
                        )}{' '}
                        m²
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">
                        Relatieve overlappingsgraad αᵢⱼ:
                      </span>
                      <span className="font-mono font-semibold">
                        {conversie.overlap_percentage}% (drempel ≥ 5,0%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">
                        Classificatie perceelsimpact:
                      </span>
                      <span className="font-mono font-semibold text-emerald-400">
                        {conversie.mutatie_type}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-[var(--border-subtle)] space-y-1">
                      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <GitBranch className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                        <span>
                          Pre-Splitsing Moederperceel (Par. 6.4):{' '}
                          <strong className="font-mono text-[var(--text-main)]">
                            {conversie.virtueel_moederperceel_id}
                          </strong>
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-[var(--text-dim)]">
                        Gekoppelde dochterpercelen:{' '}
                        {(conversie.gekoppelde_dochterpercelen ?? []).join(' + ')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exacte Multi-Vertex Geometrische & Topologische Metriek */}
                <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-2.5">
                  <div className="font-semibold text-[var(--text-main)]">
                    Exacte Multi-Vertex Topologie (Pᵢ ∩ Cⱼ Snede)
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">
                        Polygoonvorm &amp; hoekpunten:
                      </span>
                      <span className="font-mono text-emerald-400">
                        {conversie.aantal_hoekpunten} vertices ·{' '}
                        {conversie.geometrische_vorm_type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">
                        Polsby-Popper score PP(G) = 4πA/P²:
                      </span>
                      <span className="font-mono font-semibold text-[var(--accent-gold-bright)]">
                        {conversie.compactheid_score} (drempel ≥ 0,08)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">
                        Reock Minimum Bounding Circle R_MBC:
                      </span>
                      <span className="font-mono font-semibold">
                        {conversie.mbc_reock_ratio} (drempel ≥ 0,10)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">
                        Max. Ingeschreven Cirkel (2r_MIC):
                      </span>
                      <span className="font-mono text-emerald-400">
                        {conversie.inwendige_breedte_m} m (≥ 2,50 m)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">
                        Rijksdriehoekscoördinaat (EPSG:28992):
                      </span>
                      <span className="font-mono">
                        X {conversie.rd_x} · Y {conversie.rd_y}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* DEEL 2: Historisch Agrarisch Bouwvlak (t1) & Gekoppelde Opstallen op dit Erf (Pijler 2) */}
          <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
              <div className="space-y-0.5">
                <div className="font-semibold text-[var(--text-main)] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    Pijler 2 · Historisch Bouwvlak (t₁) &amp; Agrarische
                    Opstaltransformaties (Hoofdstuk 6)
                  </span>
                </div>
                {conversie && (
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">
                    Bouwvlak ID: {conversie.bouwvlak_t1_id} · Oppervlakte t₁:{' '}
                    {conversie.bouwvlak_opp_m2_t1.toLocaleString('nl-NL')} m² →
                    t₂: {conversie.bouwvlak_opp_m2_t2.toLocaleString('nl-NL')}{' '}
                    m² (
                    {conversie.is_bouwvlak_vervallen_op_t2
                      ? 'Bouwvlak vervallen op t₂'
                      : 'Gedeeltelijk gehandhaafd'}
                    )
                  </div>
                )}
              </div>

              <span className="font-mono text-[11px] text-emerald-400 font-semibold">
                {gebouwen.length} gekoppelde opstal(len) op dit erf (β_pand ≥
                0,50)
              </span>
            </div>

            {gebouwen.length === 0 ? (
              <div className="text-[11px] text-[var(--text-muted)]">
                Geen gekoppelde opstalmutatie geregistreerd op dit perceel.
              </div>
            ) : (
              <div className="space-y-3">
                {gebouwen.map((g) => {
                  const gCat = DOEL_CATEGORIEEN[g.doel_categorie];
                  const gKlasse = CONVERSIE_KLASSE_META[g.conversie_klasse];
                  const bwMeta = ONTKOPPELINGS_REGELS_BW[g.ontkoppelings_regel];
                  const isRoodVoorRood =
                    g.gebouw_indicator ===
                    '4. Vervangende Nieuwbouw / Rood-voor-Rood (Bouwjaar > t1)';

                  return (
                    <div
                      key={`${g.gebouw_conversie_id}-${g.gebouw_id}`}
                      onClick={() => onSelectGebouw && onSelectGebouw(g)}
                      className={`bg-[var(--bg-card)] border rounded-[5px] p-3.5 space-y-2.5 transition-colors ${
                        activeGebouw?.gebouw_conversie_id ===
                        g.gebouw_conversie_id
                          ? 'border-emerald-400'
                          : 'border-[var(--border-subtle)]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="font-bold text-emerald-400">
                            {g.bron_registratie}
                          </span>
                          <span>·</span>
                          <span className="text-[var(--text-main)] font-semibold">
                            ID {g.gebouw_id}
                          </span>
                          <span>·</span>
                          <span className="text-[var(--accent-gold-bright)]">
                            {g.gebouw_indicator}
                          </span>
                        </div>
                        <span
                          className="font-mono text-[11px] font-semibold"
                          style={{ color: gKlasse.badgeColor }}
                        >
                          {gKlasse.shortLabel} · Mutatie {g.transitie_datum}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-11 gap-2.5 items-center">
                        <div className="md:col-span-5 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[4px] p-2.5 space-y-0.5">
                          <div className="text-[10px] text-[var(--text-dim)] font-mono">
                            Opstalstatus op peildatum t₁
                          </div>
                          <div className="text-xs font-bold text-emerald-400">
                            {g.gebruiksdoel_t1}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">
                            Bouwjaar: {g.oorspronkelijk_bouwjaar} · Status:{' '}
                            {g.status_t1} · β_pand ={' '}
                            {Math.round(g.bouwvlak_overlap_beta * 100)}%
                          </div>
                        </div>

                        <div className="md:col-span-1 flex justify-center">
                          <ArrowRight className="w-4 h-4 text-[var(--accent-gold)]" />
                        </div>

                        <div className="md:col-span-5 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[4px] p-2.5 space-y-0.5">
                          <div className="text-[10px] text-[var(--text-dim)] font-mono">
                            Huidige Status / Herbestemming (t₂)
                          </div>
                          <div
                            className="text-xs font-bold"
                            style={{ color: gCat.fillHex }}
                          >
                            {g.gebouw_conversie_type} → {g.gebruiksdoel_t2}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">
                            Status: {g.status_t2} ({g.doel_categorie})
                            {isRoodVoorRood ? ' · Nieuwbouw > 2012' : ''}
                          </div>
                        </div>
                      </div>

                      {/* 3D BAG LoD2.2 & Beslisboom BW-1..4 */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                        <div className="bg-[var(--bg-main)] px-2.5 py-1.5 rounded-[4px] border border-[var(--border-subtle)]">
                          <div className="text-[10px] text-[var(--text-muted)]">
                            2D Pand Footprint
                          </div>
                          <div className="font-bold text-[var(--text-main)]">
                            {g.footprint_m2.toLocaleString('nl-NL')} m²
                          </div>
                        </div>
                        <div className="bg-[var(--bg-main)] px-2.5 py-1.5 rounded-[4px] border border-[var(--border-subtle)]">
                          <div className="text-[10px] text-[var(--text-muted)]">
                            VBO GBO Oppervlak
                          </div>
                          <div className="font-bold text-[var(--accent-gold-bright)]">
                            {g.gebruiksoppervlak_gbo_m2.toLocaleString('nl-NL')}{' '}
                            m²
                          </div>
                        </div>
                        <div className="bg-[var(--bg-main)] px-2.5 py-1.5 rounded-[4px] border border-[var(--border-subtle)]">
                          <div className="text-[10px] text-[var(--text-muted)]">
                            3D BAG LoD2.2 Volume
                          </div>
                          <div className="font-bold text-emerald-400">
                            {g.gebouw_volume_m3.toLocaleString('nl-NL')} m³
                          </div>
                        </div>
                        <div className="bg-[var(--bg-main)] px-2.5 py-1.5 rounded-[4px] border border-[var(--border-subtle)]">
                          <div className="text-[10px] text-[var(--text-muted)]">
                            Nokhoogte (h_dak_70p)
                          </div>
                          <div className="font-bold text-sky-300">
                            {g.nokhoogte_m} m
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)] flex flex-col gap-1">
                        <div>
                          <strong className="text-[var(--accent-gold-bright)] font-mono">
                            {bwMeta.code} ({bwMeta.titel}):
                          </strong>{' '}
                          {bwMeta.beschrijving}
                        </div>
                        <div className="text-[var(--text-dim)]">
                          {g.toelichting}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DEEL 3: Live PDOK BRK/BAG/BGT OGC API v1 & KOOP SRU 2.0 Verificatie */}
          <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                  <span>
                    Live PDOK BRK/BGT OGC API v1 &amp; KOOP SRU 2.0 Verificatie
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Bevraagt rechtstreeks PDOK Kadaster BRK + BGT/BAG Panden en
                  KOOP Gemeenteblad (repository.overheid.nl/sru)
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleVerifyLiveBrk}
                  disabled={isCheckingBrk}
                  className="px-3 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isCheckingBrk ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {isCheckingBrk
                      ? 'PDOK BRK/BGT bevragen...'
                      : 'Verifieer Live PDOK BRK & BGT'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleVerifyLiveKoop}
                  disabled={isCheckingKoop}
                  className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <FileText
                    className={`w-3.5 h-3.5 text-[#FA903E] ${
                      isCheckingKoop ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {isCheckingKoop
                      ? 'KOOP SRU 2.0 laden...'
                      : 'KOOP SRU 2.0 Gemeenteblad'}
                  </span>
                </button>
              </div>
            </div>

            {brkError && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-[4px] p-2.5">
                {brkError}
              </div>
            )}

            {liveBrkResult && (
              <div className="space-y-2.5 pt-1">
                <div className="text-[11px] text-emerald-400 font-mono">
                  ✓ {liveBrkResult.parcels.length} kadastrale percelen &amp;{' '}
                  {liveBrkResult.bgt_panden?.length ?? 0} BGT/BAG panden
                  ontvangen van PDOK OGC API v1:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {liveBrkResult.parcels.slice(0, 4).map((p, idx) => (
                    <div
                      key={`${p.identificatie_lokaal_id}-${idx}`}
                      className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] p-2.5 font-mono text-[11px] space-y-0.5"
                    >
                      <div className="font-bold text-[var(--text-main)]">
                        {p.kadastrale_gemeente_code} {p.sectie}{' '}
                        {p.perceelnummer} ({p.kadastrale_gemeente_naam})
                      </div>
                      <div className="text-[var(--text-muted)]">
                        BRK ID: {p.identificatie_lokaal_id} ·{' '}
                        {p.aantal_hoekpunten ?? '-'} hoekpunten
                      </div>
                      <div className="text-[var(--text-muted)]">
                        Grootte:{' '}
                        {p.kadastrale_grootte_m2.toLocaleString('nl-NL')} m² ·
                        PP(G): {p.polsby_popper}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {liveKoopRecords && (
              <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                <div className="text-[11px] text-[#FA903E] font-mono">
                  ✓ {liveKoopRecords.length} officiële Gemeenteblad-publicaties
                  ontvangen van KOOP SRU 2.0 (Steenwijkerland):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {liveKoopRecords.slice(0, 4).map((rec, i) => (
                    <div
                      key={`${rec.identifier}-${i}`}
                      className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] p-2.5 text-[11px] space-y-0.5"
                    >
                      <div className="font-mono font-bold text-[#FA903E]">
                        {rec.identifier} ({rec.date})
                      </div>
                      <div className="text-[var(--text-main)] line-clamp-2">
                        {rec.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
