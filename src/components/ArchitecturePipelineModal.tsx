import React, { useState } from 'react';
import {
  X,
  Database,
  Code2,
  Gauge,
  FileCode,
  ExternalLink,
  Copy,
  Check,
  Download,
} from 'lucide-react';

interface ArchitecturePipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const POSTGIS_PRODUCTION_SQL = `-- =========================================================================================
-- PRODUCTIE-PIPELINE: BITEMPORELE AGRARISCHE CONVERSIE-ENGINE (GROND ÉN GEBOUWEN)
-- Omgeving: PostgreSQL 15+, PostGIS 3.3+ (GEOS 3.11+ OverlayNG), CRS: EPSG:28992 (RD New)
-- =========================================================================================

CREATE SCHEMA IF NOT EXISTS agrarische_audit;

-- 1.1 Geharmoniseerde tabel voor Planologische Vlakken (IHR IMRO2008/2012, TAM-IMRO & DSO Ozon STOP/TPOD)
CREATE TABLE IF NOT EXISTS agrarische_audit.plan_vlakken (
  vlak_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  gemeente_code CHAR(4) NOT NULL,
  plan_regime TEXT NOT NULL CHECK (plan_regime IN ('IMRO2012 (Wro)', 'TAM-IMRO (Overgangsrecht)', 'STOP/TPOD (Ow)')),
  instrument_rangorde SMALLINT NOT NULL, -- 1=Inpassingsplan, 2=STOP/TAM, 3=Wijzigingsplan, 4=Bestemmingsplan
  plan_status TEXT NOT NULL CHECK (plan_status IN ('vastgesteld', 'in werking', 'onherroepelijk', 'geconsolideerd')),
  datum_inwerkingtreding DATE NOT NULL,
  datum_vervallen DATE,
  oorspronkelijke_bestemming TEXT NOT NULL,
  canonieke_categorie TEXT NOT NULL,
  regelkwalificatie_agrarisch TEXT,
  heeft_pons_tijdelijk_deel BOOLEAN NOT NULL DEFAULT FALSE,
  heeft_voorrangsbepaling_preambule BOOLEAN NOT NULL DEFAULT FALSE,
  geom geometry(MultiPolygon, 28992) NOT NULL,
  CONSTRAINT chk_tam_geen_ozon_pons CHECK (
    NOT (plan_regime = 'TAM-IMRO (Overgangsrecht)' AND heeft_pons_tijdelijk_deel = TRUE)
  )
);

-- DEEL 2: COMPUTATIONELE GEOMETRIE PIPELINE (DML) - STAP 1 T/M 7
-- Parameters: Peildatum t1 = '2012-01-01', Peildatum t2 = '2026-10-23' (Audit Peildatum), Gemeente = '1708'
CREATE TABLE agrarische_audit.gevalideerde_perceelconversies_2012_2026 AS
WITH
-- STAP 1: Selecteer alle rechtsgeldige vlakken op peildatum t1 en t2 en valideer precisie (0.01m)
-- Cruciaal: GEEN ST_Subdivide-filtering op oppervlakte!
raw_t1 AS (
  SELECT p.vlak_id, p.plan_id, p.plan_regime, p.instrument_rangorde, p.datum_inwerkingtreding,
         p.oorspronkelijke_bestemming, p.canonieke_categorie,
         ST_CollectionExtract(ST_MakeValid(ST_ReducePrecision(p.geom, 0.01)), 3) AS geom
  FROM agrarische_audit.plan_vlakken p
  WHERE p.gemeente_code = '1708'
    AND p.datum_inwerkingtreding <= DATE '2012-01-01'
    AND (p.datum_vervallen IS NULL OR p.datum_vervallen > DATE '2012-01-01')
    AND p.plan_status IN ('vastgesteld', 'in werking', 'onherroepelijk', 'geconsolideerd')
),
raw_t2 AS (
  SELECT p.vlak_id, p.plan_id, p.plan_regime, p.instrument_rangorde, p.datum_inwerkingtreding,
         p.oorspronkelijke_bestemming, p.canonieke_categorie, p.regelkwalificatie_agrarisch,
         p.heeft_pons_tijdelijk_deel, p.heeft_voorrangsbepaling_preambule,
         ST_CollectionExtract(ST_MakeValid(ST_ReducePrecision(p.geom, 0.01)), 3) AS geom
  FROM agrarische_audit.plan_vlakken p
  WHERE p.gemeente_code = '1708'
    -- STRIKTE TEMPORELE GRENS: Blokkeer toekomstige publicaties (zoals 2026-11-22)
    AND p.datum_inwerkingtreding <= LEAST(DATE '2026-10-23', CURRENT_DATE)
    AND (p.datum_vervallen IS NULL OR p.datum_vervallen > LEAST(DATE '2026-10-23', CURRENT_DATE))
    AND p.plan_status IN ('vastgesteld', 'in werking', 'onherroepelijk', 'geconsolideerd')
),
-- STAP 2: Isolatie van ST_Subdivide UITSLUITEND voor GiST-indexering met behoud van vlak_id (GEEN ST_Area >= 25.0!)
sub_t1 AS (
  SELECT r1.*, ST_Subdivide(r1.geom, 256) AS sub_geom FROM raw_t1 r1 WHERE NOT ST_IsEmpty(r1.geom)
),
sub_t2 AS (
  SELECT r2.*, ST_Subdivide(r2.geom, 256) AS sub_geom FROM raw_t2 r2 WHERE NOT ST_IsEmpty(r2.geom)
),
-- STAP 3: Temporele Z-Order Consolidatie (Planar Flattening) per sub-fragment op t1 en t2
flattened_sub_t1 AS (
  SELECT s1.vlak_id AS bron_vlak_id, s1.plan_id AS bron_plan_id, s1.oorspronkelijke_bestemming AS bron_bestemming,
         COALESCE(
           ST_Difference(s1.sub_geom, (
             SELECT ST_UnaryUnion(ST_Collect(newer.sub_geom)) FROM sub_t1 newer
             WHERE newer.vlak_id <> s1.vlak_id AND newer.sub_geom && s1.sub_geom AND ST_Intersects(newer.sub_geom, s1.sub_geom)
               AND (newer.datum_inwerkingtreding > s1.datum_inwerkingtreding
                    OR (newer.datum_inwerkingtreding = s1.datum_inwerkingtreding AND newer.instrument_rangorde < s1.instrument_rangorde))
           )), s1.sub_geom
         ) AS sub_geom_active
  FROM sub_t1 s1
  WHERE s1.canonieke_categorie = 'Agrarisch'
),
flattened_sub_t2 AS (
  SELECT s2.vlak_id AS doel_vlak_id, s2.plan_id AS doel_plan_id, s2.plan_regime,
         s2.datum_inwerkingtreding AS transitie_datum, s2.oorspronkelijke_bestemming AS doel_bestemming,
         s2.canonieke_categorie AS doel_categorie, s2.heeft_pons_tijdelijk_deel, s2.heeft_voorrangsbepaling_preambule,
         COALESCE(
           ST_Difference(s2.sub_geom, (
             SELECT ST_UnaryUnion(ST_Collect(newer2.sub_geom)) FROM sub_t2 newer2
             WHERE newer2.vlak_id <> s2.vlak_id AND newer2.sub_geom && s2.sub_geom AND ST_Intersects(newer2.sub_geom, s2.sub_geom)
               AND (newer2.datum_inwerkingtreding > s2.datum_inwerkingtreding
                    OR (newer2.datum_inwerkingtreding = s2.datum_inwerkingtreding AND newer2.instrument_rangorde < s2.instrument_rangorde))
               AND (newer2.plan_regime = 'IMRO2012 (Wro)'
                    OR (newer2.plan_regime = 'TAM-IMRO (Overgangsrecht)' AND newer2.heeft_voorrangsbepaling_preambule = TRUE)
                    OR (newer2.plan_regime = 'STOP/TPOD (Ow)' AND newer2.heeft_pons_tijdelijk_deel = TRUE))
           )), s2.sub_geom
         ) AS sub_geom_active
  FROM sub_t2 s2
  WHERE s2.canonieke_categorie IN ('Wonen', 'Bedrijvigheid', 'Natuur', 'Energie', 'Recreatie', 'Infrastructuur')
    AND (s2.regelkwalificatie_agrarisch IS NULL OR s2.regelkwalificatie_agrarisch = 'verboden')
),
-- STAP 4: Exacte Polygoon-Intersectie tussen t1 en t2 (NOOIT ST_Envelope!)
raw_sub_intersections AS (
  SELECT f1.bron_vlak_id, f1.bron_plan_id, f1.bron_bestemming,
         f2.doel_vlak_id, f2.doel_plan_id, f2.plan_regime, f2.transitie_datum,
         EXTRACT(YEAR FROM f2.transitie_datum)::SMALLINT AS transitie_jaar,
         f2.doel_bestemming, f2.doel_categorie, f2.heeft_pons_tijdelijk_deel, f2.heeft_voorrangsbepaling_preambule,
         ST_CollectionExtract(ST_Intersection(ST_ReducePrecision(f1.sub_geom_active, 0.01), ST_ReducePrecision(f2.sub_geom_active, 0.01)), 3) AS intersect_sub_geom
  FROM flattened_sub_t1 f1
  JOIN flattened_sub_t2 f2 ON f1.sub_geom_active && f2.sub_geom_active AND ST_Intersects(f1.sub_geom_active, f2.sub_geom_active)
  WHERE NOT ST_IsEmpty(f1.sub_geom_active) AND NOT ST_IsEmpty(f2.sub_geom_active)
),
-- STAP 5: Topologische Reconstructie via ST_UnaryUnion per unieke transitie-eenheid en ST_Dump
consolidated_polygons AS (
  SELECT bron_vlak_id, bron_plan_id, bron_bestemming, doel_vlak_id, doel_plan_id, plan_regime,
         transitie_datum, transitie_jaar, doel_bestemming, doel_categorie,
         heeft_pons_tijdelijk_deel, heeft_voorrangsbepaling_preambule,
         (ST_Dump(ST_UnaryUnion(ST_Collect(intersect_sub_geom)))).geom::geometry(Polygon, 28992) AS geom_consolidated
  FROM raw_sub_intersections
  WHERE NOT ST_IsEmpty(intersect_sub_geom)
  GROUP BY bron_vlak_id, bron_plan_id, bron_bestemming, doel_vlak_id, doel_plan_id, plan_regime,
           transitie_datum, transitie_jaar, doel_bestemming, doel_categorie,
           heeft_pons_tijdelijk_deel, heeft_voorrangsbepaling_preambule
),
-- STAP 6: Wiskundig Valide Sliver-Filtering op de Geconsolideerde Polygonen (Polsby-Popper + Reock MBC + MIC)
metrics_and_sliver_filter AS (
  SELECT ROW_NUMBER() OVER (ORDER BY transitie_datum, doel_vlak_id, ST_Area(geom_consolidated) DESC) AS conversie_vlak_id,
         c.*,
         ST_Area(c.geom_consolidated) AS vlak_opp_m2,
         (4.0 * pi() * ST_Area(c.geom_consolidated)) / NULLIF(POWER(ST_Perimeter(c.geom_consolidated), 2), 0) AS polsby_popper_score,
         ST_Area(c.geom_consolidated) / NULLIF(ST_Area(ST_MinimumBoundingCircle(c.geom_consolidated)), 0) AS mbc_reock_ratio,
         2.0 * (ST_MaximumInscribedCircle(c.geom_consolidated)).radius AS inwendige_breedte_m
  FROM consolidated_polygons c
  WHERE ST_Area(c.geom_consolidated) >= 25.0
    AND NOT ST_IsEmpty(ST_Buffer(c.geom_consolidated, -1.25))
    AND (
      ST_Area(c.geom_consolidated) >= 500.0
      OR (((4.0 * pi() * ST_Area(c.geom_consolidated)) / NULLIF(POWER(ST_Perimeter(c.geom_consolidated), 2), 0)) >= 0.08
          AND (ST_Area(c.geom_consolidated) / NULLIF(ST_Area(ST_MinimumBoundingCircle(c.geom_consolidated)), 0)) >= 0.10)
      OR (c.doel_categorie = 'Infrastructuur' AND NOT ST_IsEmpty(ST_Buffer(c.geom_consolidated, -2.50)))
    )
)
-- STAP 7A: Koppeling aan BRK Kadastrale Percelen (DKK v5) met Core-Extractie (-0.5m) en Exacte Intersectie
SELECT
  ROW_NUMBER() OVER (ORDER BY m.transitie_datum DESC, p.perceel_id) AS conversie_id,
  p.perceel_id, p.kadastrale_gemeente_code, p.sectie, p.perceelnummer, p.kwaliteitslabel_dkk,
  m.bron_plan_id, m.bron_bestemming, m.doel_plan_id, m.doel_bestemming, m.doel_categorie,
  m.plan_regime, 'KLASSE_I_DE_IURE'::TEXT AS conversie_klasse, m.transitie_datum, m.transitie_jaar,
  m.heeft_pons_tijdelijk_deel, m.heeft_voorrangsbepaling_preambule,
  ROUND(ST_Area(p.geom)::NUMERIC, 1) AS perceel_totaal_m2,
  ROUND(ST_Area(ST_Intersection(p.geom, m.geom_consolidated))::NUMERIC, 1) AS geconverteerd_perceel_m2,
  ROUND(((ST_Area(ST_Intersection(p.geom, m.geom_consolidated)) / NULLIF(ST_Area(p.geom), 0)) * 100.0)::NUMERIC, 1) AS overlap_percentage,
  CASE WHEN (ST_Area(ST_Intersection(p.geom, m.geom_consolidated)) / NULLIF(ST_Area(p.geom), 0)) >= 0.85
       THEN 'Volledige conversie' ELSE 'Partiële conversie' END AS mutatie_type,
  ROUND(((4.0 * pi() * ST_Area(ST_Intersection(p.geom, m.geom_consolidated))) /
         NULLIF(POWER(ST_Perimeter(ST_Intersection(p.geom, m.geom_consolidated)), 2), 0))::NUMERIC, 3) AS polsby_popper_score,
  ROUND(m.mbc_reock_ratio::NUMERIC, 3) AS mbc_reock_ratio,
  ROUND((2.0 * (ST_MaximumInscribedCircle(ST_Intersection(p.geom, m.geom_consolidated))).radius)::NUMERIC, 1) AS inwendige_breedte_m,
  ST_Multi(ST_CollectionExtract(ST_Intersection(p.geom, m.geom_consolidated), 3))::geometry(MultiPolygon, 28992) AS geom
FROM metrics_and_sliver_filter m
JOIN agrarische_audit.brk_percelen p ON p.geom && m.geom_consolidated
  AND ST_Intersects(
    CASE WHEN NOT ST_IsEmpty(ST_Buffer(p.geom, -0.5)) THEN ST_Buffer(p.geom, -0.5) ELSE ST_PointOnSurface(p.geom) END,
    m.geom_consolidated
  )
WHERE p.geldig_tot IS NULL
  AND ST_Area(ST_Intersection(p.geom, m.geom_consolidated)) >= 25.0
  AND (ST_Area(ST_Intersection(p.geom, m.geom_consolidated)) / NULLIF(ST_Area(p.geom), 0)) >= 0.05;`;

const KOOP_DROP_PYTHON_HARVESTER = `# PYTHON EXTRACTIESCRIPT: KOOP/DROP SRU 2.0 BOPA-HARVESTER & RUIMTELIJKE VERANKERING
import requests
import xml.etree.ElementTree as ET
from datetime import date

SRU_ENDPOINT = "https://repository.overheid.nl/sru"
NAMESPACES = {
  "sru": "http://docs.oasis-open.org/ns/search-ws/sruResponse",
  "dcterms": "http://purl.org/dc/terms/",
  "overheidop": "http://standaarden.overheid.nl/op/imop/",
  "gml": "http://www.opengis.net/gml/3.2"
}

def harvest_bopa_vergunningen(gemeente_naam: str, start_date: str, peildatum: str) -> list[dict]:
  """
  Oogst verleende BOPA-omgevingsvergunningen uit het Gemeenteblad via SRU 2.0.
  Dwingt strikt af dat datum bekendmaking/inwerkingtreding <= peildatum (2026-10-23)
  en sluit aanvragen en ontwerpbesluiten uit.
  """
  cql_query = (
    f'dt.type="gemeenteblad" AND dt.creator="{gemeente_naam}" '
    f'AND overheidop.acv="omgevingsvergunning" '
    f'AND (cql.serverChoice all "buitenplanse omgevingsplanactiviteit" OR cql.serverChoice all "BOPA") '
    f'AND dt.available >= "{start_date}" AND dt.available <= "{peildatum}"'
  )
  params = {"operation": "searchRetrieve", "version": "2.0", "query": cql_query, "maximumRecords": 250, "recordSchema": "gzd"}
  response = requests.get(SRU_ENDPOINT, params=params, timeout=30)
  response.raise_for_status()
  root = ET.fromstring(response.content)

  bopa_records = []
  for record in root.findall(".//sru:record", NAMESPACES):
    identifier_el = record.find(".//dcterms:identifier", NAMESPACES)
    title_el = record.find(".//dcterms:title", NAMESPACES)
    available_el = record.find(".//dcterms:available", NAMESPACES)
    if identifier_el is None or title_el is None or available_el is None:
      continue
    gmb_id = identifier_el.text.strip()
    titel = title_el.text.strip()
    publicatie_datum = available_el.text.strip()[:10]
    if any(t in titel.lower() for t in ["aanvraag", "ontwerp", "geweigerd", "intrekking", "verlenging beslistermijn"]):
      continue
    if publicatie_datum > str(date.today()):
      continue
    bopa_records.append({
      "gmb_id": gmb_id,
      "transitie_datum": publicatie_datum,
      "zakelijke_beschrijving": titel,
      "plan_regime": "BOPA (Omgevingsvergunning)",
      "conversie_klasse": "KLASSE_II_IN_EXPLOITATIE",
      "heeft_pons_tijdelijk_deel": False,
      "verwerkingsplicht_uiterlijk_op": f"{int(publicatie_datum[:4]) + 5}{publicatie_datum[4:]}"
    })
  return bopa_records`;

const TIPPECANOE_DUAL_LAYER_CMD = `#!/usr/bin/env bash
set -euo pipefail

# Compileer beide lagen (Grond + BAG/BGT Gebouwen) in één enkel PMTiles v3 archief met interne GZIP-tegelcompressie
# (internalCompression = 2, tileCompression = 2; GEEN externe .br compressie om HTTP 206 Range Seeking intact te houden!)
tippecanoe -o /var/www/cdn/tiles/agrarische_conversies_2012_2026.pmtiles \\
  --force \\
  --read-parallel \\
  --minimum-zoom=7 \\
  --maximum-zoom=16 \\
  --simplification=4 \\
  --detect-shared-borders \\
  --coalesce-smallest-as-needed \\
  --extend-zooms-if-still-dropping \\
  --named-layer="conversie_percelen:/tmp/conversie_percelen.geojsonl" \\
  --named-layer="conversie_gebouwen:/tmp/conversie_gebouwen.geojsonl" \\
  --attribution="Kadaster / IHR / DSO-LV Ozon / KOOP / BAG / BGT"`;

export const ArchitecturePipelineModal: React.FC<
  ArchitecturePipelineModalProps
> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<
    'postgis' | 'pmtiles_protocol' | 'bopa_harvester'
  >('postgis');
  const [copiedSql, setCopiedSql] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(POSTGIS_PRODUCTION_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[880] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto tabular-nums">
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[6px] max-w-5xl w-full shadow-2xl overflow-hidden text-[var(--text-main)] my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-[var(--text-main)]">
              Onderzoeksrapport C &amp; D: Productierijpe PostGIS-Pipeline, KOOP/DROP Harvester &amp; PMTiles v3
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Zevenstaps Computationele Geometrie (EPSG:28992), Gebouwen-Engine (BAG/3D-BAG/BGT) &amp; WHATWG DecompressionStream Protocol
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/assets/aistudio/Audit_en_Architectuur_Agrarische_Conversies_2690eb05.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent-gold-bright)] flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Arbitrage &amp; Architectuur PDF (54 pag.)</span>
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

        {/* Navigation Tabs */}
        <div className="px-5 pt-2.5 border-b border-[var(--border-subtle)] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 bg-[var(--bg-main)]">
          <button
            type="button"
            onClick={() => setActiveTab('postgis')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'postgis'
                ? 'border-[var(--accent-gold)] text-[var(--accent-gold-bright)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>1. 7-Staps PostGIS SQL-Pipeline (Grond &amp; Gebouwen)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pmtiles_protocol')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'pmtiles_protocol'
                ? 'border-[var(--accent-gold)] text-[var(--accent-gold-bright)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>2. PMTiles v3 Gzip vs. Brotli Protocol &amp; Benchmarks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bopa_harvester')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'bopa_harvester'
                ? 'border-[var(--accent-gold)] text-[var(--accent-gold-bright)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>3. KOOP/DROP SRU 2.0 BOPA-Harvester &amp; Tippecanoe</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {activeTab === 'postgis' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-bold text-sm text-[var(--text-main)]">
                    Gecorrigeerde 7-Staps PostGIS 3.3+ (GEOS 3.11+ OverlayNG) Productie-Query
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Isoleert ST_Subdivide(256) zonder oppervlaktefilter, herenigt via ST_UnaryUnion, en berekent Polsby-Popper, Reock MBC en Maximum Inscribed Circle op het exacte deelperceel.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="/api/conversies/export.geojson"
                    download="agrarische_conversies_grond_en_gebouwen_steenwijkerland.geojson"
                    className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download Dual-Layer GeoJSON</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-3 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>SQL Gekopieerd</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopieer PostGIS SQL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <pre className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-4 font-mono text-[11px] text-[var(--text-main)] overflow-x-auto leading-relaxed max-h-[380px]">
                {POSTGIS_PRODUCTION_SQL}
              </pre>
            </div>
          )}

          {activeTab === 'pmtiles_protocol' && (
            <div className="space-y-5">
              {/* Protocollaire Grenzen Tabel van Pagina 9-10 */}
              <div className="space-y-2">
                <h3 className="font-display font-bold text-sm text-[var(--text-main)]">
                  Protocollaire Grenzen binnen de WHATWG/W3C DecompressionStream API &amp; Static Range Serving
                </h3>
                <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-[5px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-main)] border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                        <th className="p-2.5 font-semibold">Algoritme</th>
                        <th className="p-2.5 font-semibold">RFC</th>
                        <th className="p-2.5 font-semibold">HTTP 200 OK + Content-Encoding</th>
                        <th className="p-2.5 font-semibold">HTTP 206 Partial Content (Statisch CDN)</th>
                        <th className="p-2.5 font-semibold">WHATWG DecompressionStream</th>
                        <th className="p-2.5 font-semibold">Compatibiliteit Serverless PMTiles v3</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] text-[11px]">
                      <tr>
                        <td className="p-2.5 font-mono font-bold text-emerald-400">gzip</td>
                        <td className="p-2.5 font-mono">RFC 1952</td>
                        <td className="p-2.5">Universeel ondersteund</td>
                        <td className="p-2.5">Vereist JS/Worker decompressie van byte-slice</td>
                        <td className="p-2.5 text-emerald-400 font-semibold">Universeel in alle moderne browsers (new DecompressionStream(&quot;gzip&quot;))</td>
                        <td className="p-2.5 font-mono text-emerald-400 font-bold">Volledig ondersteund (Standaard: internalCompression=2, tileCompression=2)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono text-[var(--text-main)]">deflate</td>
                        <td className="p-2.5 font-mono">RFC 1950/1951</td>
                        <td className="p-2.5">Universeel ondersteund</td>
                        <td className="p-2.5">Vereist JS/Worker decompressie</td>
                        <td className="p-2.5">Universeel ondersteund</td>
                        <td className="p-2.5 text-[var(--text-muted)]">Niet gebruikt in PMTiles v3 enum</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono font-bold text-amber-400">brotli (br)</td>
                        <td className="p-2.5 font-mono">RFC 7932</td>
                        <td className="p-2.5">Universeel op 200 OK over HTTPS</td>
                        <td className="p-2.5 text-red-400 font-semibold">Faalt zonder proxy: Statisch CDN stuurt geen Content-Encoding: br op 206 range</td>
                        <td className="p-2.5 text-amber-300">Gefragmenteerd / Niet-universeel in Web Workers</td>
                        <td className="p-2.5 text-red-400">Alleen bruikbaar met tussenliggende tile-server (tileserver-rs / Martin op 200 OK)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono text-[var(--text-muted)]">zstd</td>
                        <td className="p-2.5 font-mono">RFC 8878</td>
                        <td className="p-2.5">Ondersteund in nieuwere browsers</td>
                        <td className="p-2.5 text-red-400">Faalt zonder proxy op 206 byte-range</td>
                        <td className="p-2.5 text-[var(--text-muted)]">Ontbreekt in standaard browser-API; vereist WASM</td>
                        <td className="p-2.5 text-[var(--text-muted)]">Alleen met custom WASM-decoder</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Benchmarks van Pagina 43 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">Archiefcompressie (1 GB GML → PMTiles)</div>
                  <div className="font-mono text-lg font-bold text-[var(--text-main)] mt-1">12&times; kleiner (85 MB)</div>
                </div>
                <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">Memory-Mapped Directory v3 Seek</div>
                  <div className="font-mono text-lg font-bold text-emerald-400 mt-1">185 ns cache-hit</div>
                </div>
                <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">PMTiles z14 Doorvoer vs. MBTiles</div>
                  <div className="font-mono text-lg font-bold text-sky-400 mt-1">1.496 vs. 239 req/s</div>
                </div>
                <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">In-Memory Brotli Cache (tileserver-rs)</div>
                  <div className="font-mono text-lg font-bold text-[var(--accent-gold-bright)] mt-1">1.478 vs. 107 req/s</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bopa_harvester' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="font-semibold text-xs text-[var(--text-main)]">
                  1. KOOP/DROP SRU 2.0 Python Harvester voor BOPA-Vergunningen (Klasse II In Exploitatie):
                </div>
                <pre className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3.5 font-mono text-[11px] text-[var(--text-main)] overflow-x-auto max-h-[240px]">
                  {KOOP_DROP_PYTHON_HARVESTER}
                </pre>
              </div>

              <div className="space-y-1.5">
                <div className="font-semibold text-xs text-[var(--text-main)]">
                  2. Dual-Layer Tippecanoe PMTiles v3 Compilatie (Grond + Gebouwen met interne Gzip):
                </div>
                <pre className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] p-3.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                  {TIPPECANOE_DUAL_LAYER_CMD}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
