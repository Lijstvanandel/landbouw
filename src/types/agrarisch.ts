export type DoelCategorie =
  | 'Wonen'
  | 'Bedrijvigheid'
  | 'Natuur'
  | 'Energie'
  | 'Recreatie'
  | 'Infrastructuur';

export type MutatieType = 'Volledige conversie' | 'Partiële conversie';

export type PlanRegime =
  | 'IMRO2012 (Wro)'
  | 'TAM-IMRO (Overgangsrecht)'
  | 'STOP/TPOD (Ow)'
  | 'BOPA (Omgevingsvergunning)';

export type ConversieKlasse =
  | 'KLASSE_I_DE_IURE'
  | 'KLASSE_II_IN_EXPLOITATIE'
  | 'KLASSE_III_ERF_INBREIDING'
  | 'KLASSE_IV_DE_FACTO_BAG_BGT';

export type DkkKwaliteitslabel = 'B' | 'C' | 'D' | 'E';

/**
 * De 4 Gebouw-Transformatie-Indicatoren uit Onderzoeksrapport B (Hoofdstuk 2, pag. 21-23)
 */
export type GebouwIndicator =
  | '1. Sloop van Agrarische Opstallen'
  | '2. Interne Herbestemming van Stallen/Schuren'
  | '3. Woning-Ontkoppeling (BW-1 t/m BW-4)'
  | '4. Vervangende Nieuwbouw / Rood-voor-Rood (Bouwjaar > t1)';

export const ALL_GEBOUW_INDICATOREN: GebouwIndicator[] = [
  '1. Sloop van Agrarische Opstallen',
  '2. Interne Herbestemming van Stallen/Schuren',
  '3. Woning-Ontkoppeling (BW-1 t/m BW-4)',
  '4. Vervangende Nieuwbouw / Rood-voor-Rood (Bouwjaar > t1)',
];

export type GebouwConversieType =
  | 'Sloop agrarische opstal'
  | 'Omzetting bedrijfswoning naar Plattelandswoning (Klasse III)'
  | 'Omzetting bedrijfswoning naar Burgerwoning / VAB (Klasse I/III)'
  | 'Functiewijziging stal/opstal naar woonfunctie (Klasse IV)'
  | 'Functiewijziging stal/opstal naar logiesfunctie (Klasse IV)'
  | 'Functiewijziging stal/opstal naar bijeenkomstfunctie (Klasse IV)'
  | 'Functie-inbreiding agrarische opstal (Klasse III)'
  | 'Vervangende nieuwbouw op voormalig agrarisch erf / Rood-voor-Rood (Klasse I/III)';

export type OntkoppelingsRegelBW =
  | 'N.v.t. (Bedrijfsopstal / Kavel)'
  | 'Regel BW-1: Specifieke aanduiding op pandfootprint (>=50%)'
  | 'Regel BW-2: Chirurgische uitkoppeling uit agrarisch bouwvlak'
  | 'Regel BW-3: BOPA-vergunning (KOOP/DROP) op VBO/Huisnummer'
  | 'Regel BW-4: Functionele erf-beëindiging door 100% stalsloop (>=250 m²)';

/**
 * Gevalideerde Perceelsconversie (Grond / BRK DKK v5) conform Onderzoeksrapport A, B, C & D,
 * inclusief historisch Agrarisch Bouwvlak op t1 (Bouwvlak_t1) en pre-splitsingsreconstructie.
 */
export interface AgrarischeConversie {
  conversie_id: number;
  perceel_id: string; // bijv. NL.IMKAD.KadastraalObject.1708...
  brk_perceel_id: string;
  virtueel_moederperceel_id?: string; // ST_ClusterDBSCAN pre-splitsingskavel reconstructie (pag. 27)
  gekoppelde_dochterpercelen?: string[]; // Actuele dochterpercelen na verkaveling
  kadastrale_gemeente_code: string;
  kadastrale_gemeente_naam: string;
  sectie: string;
  perceelnummer: string;
  dkk_kwaliteitslabel: DkkKwaliteitslabel;
  kern: string;
  adres_locatie: string;
  bron_vlak_id: string;
  bron_plan_id: string;
  bron_bestemming: string; // Zuivere SVBP2012 hoofdgroep voor 2012-2023; nooit anachronistisch Ow-label!
  doel_vlak_id: string;
  doel_plan_id: string;
  doel_plan_naam: string;
  doel_categorie: DoelCategorie;
  doel_bestemming: string; // Voor BOPA: zakelijke beschrijving uit Gemeenteblad (DROP), géén synthetisch IMRO-label!
  plan_regime: PlanRegime;
  conversie_klasse: ConversieKlasse;
  plan_rangorde: number; // 1=Inpassingsplan, 2=STOP-Omgevingsplan/TAM, 3=Wijzigingsplan, 4=Bestemmingsplan, 5=Beheersverordening
  is_tam_plan: boolean;
  is_stop_tpod: boolean;
  is_bopa: boolean;
  heeft_pons_tijdelijk_deel: boolean; // UITSLUITEND true bij STOP/TPOD (Ow); ALTIJD false bij TAM-IMRO & BOPA!
  heeft_voorrangsbepaling_preambule: boolean; // TRUE bij TAM-IMRO (XHTML preambule in IHR)
  verwerkingsplicht_uiterlijk_op: string | null; // Voor BOPA ex art. 4.17 Ow (+5 jaar na publicatie)
  transitie_datum: string; // YYYY-MM-DD (Strikt <= '2026-10-23')
  transitie_jaar: number; // 2012..2026
  perceel_totaal_m2: number;
  geconverteerd_perceel_m2: number; // >= 25.0 m² (inclusief klein segment 25 - 2.500 m²)
  overlap_percentage: number; // >= 5.0% (inclusief segment 5.0% - 10.2%)
  mutatie_type: MutatieType;
  aantal_hoekpunten: number; // n >= 4 (inclusief veelhoekige kavels met PP > 0.785)
  geometrische_vorm_type: string;
  compactheid_score: number; // Exacte Polsby-Popper op ST_UnaryUnion polygoon (0.090 .. 0.945)
  mbc_reock_ratio: number; // Reock Minimum Bounding Circle ratio Area(G)/Area(MBC(G)) >= 0.10
  inwendige_breedte_m: number; // 2 * straal Maximum Inscribed Circle (>= 2.50m)
  sliver_geelimineerd_count: number;
  // Historisch Agrarisch Bouwvlak op peildatum t1 (Bouwvlak_t1 conform pag. 19-21 & 38-41)
  bouwvlak_t1_id: string;
  bouwvlak_coords: [number, number][];
  bouwvlak_opp_m2_t1: number;
  bouwvlak_opp_m2_t2: number;
  is_bouwvlak_vervallen_op_t2: boolean;
  pdok_brk_bron: boolean; // True wanneer direct verankerd op PDOK BRK OGC API v1 perceelgeometrie
  object_niveau: 'GROND';
  rd_x: number;
  rd_y: number;
  lat: number;
  lng: number;
  polygon_coords: [number, number][]; // Exacte topologische sub-perceelsnijding (P_i ∩ C_j)
  perceel_coords: [number, number][]; // Volledig kadastraal moederperceel (P_i)
  toelichting: string;
}

/**
 * Gevalideerde Gebouwconversie (BAG Panden, VBO's, 3D BAG LoD2.2 & BGT OverigBouwwerk)
 * conform Onderzoeksrapport B (Hoofdstuk 2, Indicatoren 1 t/m 4) & Onderzoeksrapport C (Stap 7B).
 */
export interface AgrarischeGebouwConversie {
  gebouw_conversie_id: number;
  conversie_id: number; // Gekoppeld Erf / Kadastraal Perceel Dossier ID
  gebouw_id: string; // 16-cijferige BAG pandidentificatie (170810...) of BGT lokaalID (G1708...)
  bron_registratie: 'BAG_PAND' | 'BGT_OVERIG_BOUWWERK';
  bgt_fysiek_type: string | null; // 'open loods', 'overkapping', 'bassin', 'opslagtank', 'sleufsilo', of null
  bouwvlak_id_t1: string;
  bouwvlak_overlap_beta: number; // beta_pand = Area(Pand ∩ Bouwvlak_t1) / Area(Pand) >= 0.50 (pag. 20)
  bron_plan_id: string;
  gekoppeld_perceel_id: string;
  kadastrale_aanduiding: string;
  kern: string;
  adres: string;
  oorspronkelijk_bouwjaar: number; // > 2012 bij Indicator 4 (Vervangende Nieuwbouw / Rood-voor-Rood)
  status_t1: string; // 'Pand in gebruik', 'BGT Actief', of 'Niet aanwezig op t1 (Bouwjaar > t1)'
  status_t2: string; // 'Pand gesloopt', 'Sloopvergunning verleend', 'Pand in gebruik (gewijzigd)', 'BGT Vervallen', 'Pand in gebruik (nieuwbouw)'
  vbo_id: string | null;
  gebruiksdoel_t1: string;
  gebruiksdoel_t2: string;
  specifieke_aanduiding_t2: string | null;
  is_bouwvlak_vervallen_op_t2: boolean;
  ontkoppelings_regel: OntkoppelingsRegelBW;
  gebouw_indicator: GebouwIndicator;
  gebouw_conversie_type: GebouwConversieType;
  conversie_klasse: ConversieKlasse;
  doel_categorie: DoelCategorie;
  footprint_m2: number; // 2D pand/bouwwerk footprint (m²)
  gebruiksoppervlak_gbo_m2: number; // VBO gebruiksoppervlakte (m² GBO)
  gebouw_volume_m3: number; // 3D BAG LoD2.2 / AHN bouwvolume (m³)
  nokhoogte_m: number; // b3_dak_70p_m - b3_maaiveld_m
  transitie_datum: string; // <= '2026-10-23'
  transitie_jaar: number;
  object_niveau: 'GEBOUW';
  rd_x: number;
  rd_y: number;
  lat: number;
  lng: number;
  coords: [number, number][]; // 2D gebouw-footprint uit PDOK BAG/BGT
  toelichting: string;
}

export interface SliverPolygonArtifact {
  sliver_id: string;
  kadastraal_perceel: string;
  kern: string;
  oorzaak: string;
  oppervlakte_m2: number;
  polsby_popper: number;
  mbc_reock_ratio: number;
  inwendige_breedte_m: number;
  verworpen_stap:
    | 'Stap 6a: ST_Area(G) < 25,0 m²'
    | 'Stap 6b: Morfologische opening ST_IsEmpty(ST_Buffer(G, -1.25))'
    | 'Stap 6c: Polsby-Popper PP(G) < 0,08 of Reock MBC < 0,10';
  coords: [number, number][];
  lat: number;
  lng: number;
}

export interface DoelCategorieMeta {
  id: DoelCategorie;
  label: string;
  shortLabel: string;
  fillHex: string;
  borderHex: string;
  imroIndicators: string;
  stopTpodIndicators: string;
  description: string;
}

export const DOEL_CATEGORIEEN: Record<DoelCategorie, DoelCategorieMeta> = {
  Wonen: {
    id: 'Wonen',
    label: 'Wonen (Woningbouw / VAB / Plattelandswoning / Rood-voor-Rood)',
    shortLabel: 'Wonen',
    fillHex: '#D93025',
    borderHex: '#ff6b61',
    imroIndicators:
      'Hoofdgroep wonen, woongebied; Functieaanduiding plattelandswoning, specifieke vorm van wonen - voormalig agrarisch bedrijf / rood voor rood',
    stopTpodIndicators:
      'Gebiedsaanwijzing Woongebied, Wonen in het buitengebied; Activiteit bewonen van een gebouw, bouwen van een woning',
    description:
      'Omzetting van agrarisch bouwvlak, bedrijfswoning of veldkavel naar reguliere woningbouw, rood-voor-rood sanering of plattelandswoning (Regel BW-1 t/m BW-4).',
  },
  Bedrijvigheid: {
    id: 'Bedrijvigheid',
    label: 'Bedrijvigheid (Niet-agrarisch / Statische Opslag)',
    shortLabel: 'Bedrijvigheid',
    fillHex: '#C58AF9',
    borderHex: '#dfc2fc',
    imroIndicators:
      'Hoofdgroep bedrijf, bedrijventerrein, kantoor, detailhandel, horeca; Functieaanduiding niet-agrarisch bedrijf, statische opslag',
    stopTpodIndicators:
      'Gebiedsaanwijzing Bedrijventerrein, Werklandschap; Activiteit milieubelastende activiteit (niet-agrarisch), detailhandel, horeca',
    description:
      'Functiewijziging van vrijkomende agrarische bebouwing (VAB) en stallen naar niet-agrarische bedrijvigheid, ambacht, kantoor of statische opslag.',
  },
  Natuur: {
    id: 'Natuur',
    label: 'Natuur & Water (NNN / Stalsloop / Waterberging)',
    shortLabel: 'Natuur & Water',
    fillHex: '#81C995',
    borderHex: '#a8e4b8',
    imroIndicators:
      'Hoofdgroep natuur, bos, groen, water; Wijziging van agrarisch naar agrarisch met waarden - natuur met vervallen bouwvlak',
    stopTpodIndicators:
      'Gebiedsaanwijzing Natuurnetwerk Nederland (NNN), Natuurgebied, Waterbergingsgebied; Activiteit instandhouden natuurwaarden',
    description:
      'Herbestemming van landbouwgrond en sloop van opstallen ten behoeve van Natuurnetwerk Nederland (Weerribben-Wieden), ecologische verbindingszones en waterberging.',
  },
  Energie: {
    id: 'Energie',
    label: 'Energie (Zonneveld / Wind / Batterijopslag)',
    shortLabel: 'Energie',
    fillHex: '#FCC934',
    borderHex: '#fde28a',
    imroIndicators:
      'Hoofdgroep bedrijf - nutsvoorziening / zonnepark; Functieaanduiding specifieke vorm van energie - zonneveld, windturbine',
    stopTpodIndicators:
      'Gebiedsaanwijzing Energielandschap, Zonneveld; Activiteit opwekken van duurzame elektriciteit, exploiteren batterijopslag',
    description:
      'Transformatie van agrarische percelen naar grondgebonden zonnevelden, energie-opslagsystemen (EOS) of netinfrastructuur.',
  },
  Recreatie: {
    id: 'Recreatie',
    label: 'Recreatie (Verblijfsrecreatie / Logies / Campings)',
    shortLabel: 'Recreatie',
    fillHex: '#FA903E',
    borderHex: '#fcb57e',
    imroIndicators:
      'Hoofdgroep recreatie, sport; Functieaanduiding verblijfsrecreatie, dagrecreatie, kampeerterrein',
    stopTpodIndicators:
      'Gebiedsaanwijzing Recreatiegebied; Activiteit recreatieactiviteit, exploiteren van een verblijfsrecreatieterrein',
    description:
      'Omzetting van agrarische bedrijfskavels en boerderijen naar recreatieparken, logiesfuncties, jachthavens of kampeerterreinen.',
  },
  Infrastructuur: {
    id: 'Infrastructuur',
    label: 'Infrastructuur (Wegen / Watergangen / Spoor)',
    shortLabel: 'Infrastructuur',
    fillHex: '#1A73E8',
    borderHex: '#6ea8fe',
    imroIndicators:
      'Hoofdgroep verkeer, verkeer - railverkeer, verkeer - wegverkeer',
    stopTpodIndicators:
      'Gebiedsaanwijzing Hoofdinfrastructuur, Verkeersgebied; Activiteit aanleggen of wijzigen van een weg',
    description:
      'Verwerving en herbestemming van agrarische strook- en randpercelen voor gebiedsontsluitingswegen, rotondes, watergangen en fietspaden.',
  },
};

export const ALL_DOEL_CATEGORIEEN: DoelCategorie[] = [
  'Wonen',
  'Bedrijvigheid',
  'Natuur',
  'Energie',
  'Recreatie',
  'Infrastructuur',
];

export const ALL_PLAN_REGIMES: PlanRegime[] = [
  'IMRO2012 (Wro)',
  'TAM-IMRO (Overgangsrecht)',
  'STOP/TPOD (Ow)',
  'BOPA (Omgevingsvergunning)',
];

export const CONVERSIE_KLASSE_META: Record<
  ConversieKlasse,
  { shortLabel: string; label: string; badgeColor: string; description: string }
> = {
  KLASSE_I_DE_IURE: {
    shortLabel: 'Klasse I (De Iure)',
    label: 'Klasse I — Formele Planologische Conversie (De Iure)',
    badgeColor: '#34d399',
    description:
      'Onherroepelijk bestemmingsplan (IMRO2012), TAM-IMRO met voorrangsbepaling of STOP/TPOD omgevingsplanwijziging met Pons.',
  },
  KLASSE_II_IN_EXPLOITATIE: {
    shortLabel: 'Klasse II (BOPA)',
    label: 'Klasse II — Vergunde Buitenplanse Afwijking (BOPA art. 4.17 Ow)',
    badgeColor: '#FA903E',
    description:
      'Verleende BOPA uit het Gemeenteblad (KOOP/DROP SRU 2.0) met wettelijke 5-jarige verwerkingsplicht in het omgevingsplan.',
  },
  KLASSE_III_ERF_INBREIDING: {
    shortLabel: 'Klasse III (Erf/BW)',
    label: 'Klasse III — Functionele Erf-Inbreiding & Bedrijfswoning-Ontkoppeling',
    badgeColor: '#38bdf8',
    description:
      'Chirurgische uitkoppeling of aanduiding plattelandswoning / VAB op een bestaand agrarisch bouwperceel (Regel BW-1 t/m BW-4).',
  },
  KLASSE_IV_DE_FACTO_BAG_BGT: {
    shortLabel: 'Klasse IV (BAG/BGT)',
    label: 'Klasse IV — Fysieke & Functionele Opstalmutatie (BAG / 3D BAG / BGT)',
    badgeColor: '#c084fc',
    description:
      'Gerealiseerde stalsloop, BGT-erfverwijdering of VBO-gebruiksdoelwijziging zonder gelijktijdige wijziging van het bestemmingsvlak.',
  },
};

export const ONTKOPPELINGS_REGELS_BW: Record<
  OntkoppelingsRegelBW,
  { code: string; titel: string; beschrijving: string }
> = {
  'N.v.t. (Bedrijfsopstal / Kavel)': {
    code: 'N.v.t.',
    titel: 'Reguliere Bedrijfsopstal / Cultuurgrond',
    beschrijving:
      'Betreft een agrarische bedrijfsopstal (stal, loods, sleufsilo) of onbebouwde kavel zonder bedrijfswoning-ontkoppeling.',
  },
  'Regel BW-1: Specifieke aanduiding op pandfootprint (>=50%)': {
    code: 'Regel BW-1',
    titel: 'Specifieke Aanduiding op Pandfootprint (≥ 50%)',
    beschrijving:
      'Op t₂ overlapt een functieaanduiding plattelandswoning, voormalige bedrijfswoning of wonen voor ≥ 50% met de BAG-pandfootprint van de bedrijfswoning.',
  },
  'Regel BW-2: Chirurgische uitkoppeling uit agrarisch bouwvlak': {
    code: 'Regel BW-2',
    titel: 'Chirurgische Uitkoppeling uit Agrarisch Bouwvlak',
    beschrijving:
      'De BAG-pandfootprint lag op t₁ binnen het agrarisch bouwvlak, maar is op t₂ uitgeknipt naar een separaat bestemmingsvlak Wonen terwijl de omliggende kavel agrarisch bleef.',
  },
  'Regel BW-3: BOPA-vergunning (KOOP/DROP) op VBO/Huisnummer': {
    code: 'Regel BW-3',
    titel: 'BOPA-Omgevingsvergunning op VBO / Huisnummer',
    beschrijving:
      'Verleende BOPA uit het Gemeenteblad voor burgerbewoning of plattelandswoning op het specifieke BAG-verblijfsobject (art. 4.17 Ow).',
  },
  'Regel BW-4: Functionele erf-beëindiging door 100% stalsloop (>=250 m²)': {
    code: 'Regel BW-4',
    titel: 'Functionele Erf-Beëindiging door 100% Stalsloop (≥ 250 m²)',
    beschrijving:
      'Alle bijbehorende agrarische bedrijfsopstallen (≥ 250 m²) op het bouwvlak zijn gesloopt (BAG Pand gesloopt / BGT Vervallen), waarmee de resterende woning de facto als burgerwoning resteert.',
  },
};

export const AUDIT_PEILDATUM_ISO = '2026-10-23';

export interface ConversieFilterState {
  minYear: number; // default 2012 (t1)
  selectedYear: number; // timeline slider t2 (default 2026, capped at 2026-10-23)
  categories: DoelCategorie[];
  regimes: PlanRegime[];
  conversieKlasse: 'all' | ConversieKlasse;
  mutatieType: 'all' | MutatieType;
  gebouwIndicator: 'all' | GebouwIndicator;
  showGround: boolean; // Laag 1: Kadastrale Percelen / Cultuurgrond (BRK)
  showBuildings: boolean; // Laag 2: Agrarische Opstallen / Gebouwen (BAG & BGT)
  showBouwvlakkenT1: boolean; // Laag 3: Historisch Agrarisch Bouwvlak op t1 (Bouwvlak_t1)
  minOverlapPct: number; // default 5.0 (%)
  minPolsbyPopper: number; // default 0.08
  kern: string;
  searchQuery: string;
}

export const INITIAL_CONVERSIE_FILTERS: ConversieFilterState = {
  minYear: 2012,
  selectedYear: 2026,
  categories: [...ALL_DOEL_CATEGORIEEN],
  regimes: [...ALL_PLAN_REGIMES],
  conversieKlasse: 'all',
  mutatieType: 'all',
  gebouwIndicator: 'all',
  showGround: true,
  showBuildings: true,
  showBouwvlakkenT1: true,
  minOverlapPct: 5,
  minPolsbyPopper: 0.08,
  kern: '',
  searchQuery: '',
};

export function filterConversies(
  items: AgrarischeConversie[],
  filters: ConversieFilterState
): AgrarischeConversie[] {
  const q = filters.searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (item.transitie_datum > AUDIT_PEILDATUM_ISO) {
      return false;
    }
    if (
      item.transitie_jaar < filters.minYear ||
      item.transitie_jaar > filters.selectedYear
    ) {
      return false;
    }
    if (!filters.categories.includes(item.doel_categorie)) {
      return false;
    }
    if (!filters.regimes.includes(item.plan_regime)) {
      return false;
    }
    if (
      filters.conversieKlasse !== 'all' &&
      item.conversie_klasse !== filters.conversieKlasse
    ) {
      return false;
    }
    if (
      filters.mutatieType !== 'all' &&
      item.mutatie_type !== filters.mutatieType
    ) {
      return false;
    }
    if (item.overlap_percentage < filters.minOverlapPct) {
      return false;
    }
    if (item.geconverteerd_perceel_m2 < 25.0) {
      return false;
    }
    if (
      item.compactheid_score < filters.minPolsbyPopper &&
      item.geconverteerd_perceel_m2 < 500
    ) {
      return false;
    }
    if (filters.kern && item.kern !== filters.kern) {
      return false;
    }
    if (q) {
      const hay = `${item.kadastrale_gemeente_code} ${item.sectie} ${item.perceelnummer} ${item.perceel_id} ${item.virtueel_moederperceel_id || ''} ${item.bouwvlak_t1_id} ${item.kern} ${item.adres_locatie} ${item.bron_bestemming} ${item.doel_categorie} ${item.doel_bestemming} ${item.doel_plan_id} ${item.conversie_klasse}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function filterGebouwConversies(
  buildings: AgrarischeGebouwConversie[],
  filters: ConversieFilterState
): AgrarischeGebouwConversie[] {
  const q = filters.searchQuery.trim().toLowerCase();

  return buildings.filter((b) => {
    if (b.transitie_datum > AUDIT_PEILDATUM_ISO) return false;
    if (
      b.transitie_jaar < filters.minYear ||
      b.transitie_jaar > filters.selectedYear
    ) {
      return false;
    }
    if (!filters.categories.includes(b.doel_categorie)) {
      return false;
    }
    if (
      filters.conversieKlasse !== 'all' &&
      b.conversie_klasse !== filters.conversieKlasse
    ) {
      return false;
    }
    if (
      filters.gebouwIndicator !== 'all' &&
      b.gebouw_indicator !== filters.gebouwIndicator
    ) {
      return false;
    }
    if (filters.kern && b.kern !== filters.kern) {
      return false;
    }
    if (q) {
      const hay = `${b.gebouw_id} ${b.kadastrale_aanduiding} ${b.bouwvlak_id_t1} ${b.kern} ${b.adres} ${b.gebouw_conversie_type} ${b.gebouw_indicator} ${b.gebruiksdoel_t1} ${b.gebruiksdoel_t2} ${b.bgt_fysiek_type || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function exportConversiesToCSV(items: AgrarischeConversie[]): string {
  const headers = [
    'conversie_id',
    'perceel_id',
    'virtueel_moederperceel_id',
    'bouwvlak_t1_id',
    'kadastrale_gemeente_code',
    'sectie',
    'perceelnummer',
    'kwaliteitslabel_dkk',
    'kern',
    'adres_locatie',
    'bron_vlak_id',
    'bron_plan_id',
    'bron_bestemming',
    'doel_vlak_id',
    'doel_plan_id',
    'doel_categorie',
    'doel_bestemming',
    'plan_regime',
    'conversie_klasse',
    'transitie_datum',
    'transitie_jaar',
    'heeft_pons_tijdelijk_deel',
    'heeft_voorrangsbepaling_preambule',
    'verwerkingsplicht_uiterlijk_op',
    'perceel_totaal_m2',
    'geconverteerd_perceel_m2',
    'overlap_percentage',
    'mutatie_type',
    'aantal_hoekpunten',
    'polsby_popper_score',
    'mbc_reock_ratio',
    'inwendige_breedte_m',
    'bouwvlak_opp_m2_t1',
    'bouwvlak_opp_m2_t2',
    'is_bouwvlak_vervallen_op_t2',
    'object_niveau',
    'rd_x',
    'rd_y',
    'lat',
    'lng',
  ];

  const escapeCsv = (val: unknown): string => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = items.map((c) =>
    [
      c.conversie_id,
      c.perceel_id,
      c.virtueel_moederperceel_id || '',
      c.bouwvlak_t1_id,
      c.kadastrale_gemeente_code,
      c.sectie,
      c.perceelnummer,
      c.dkk_kwaliteitslabel,
      c.kern,
      c.adres_locatie,
      c.bron_vlak_id,
      c.bron_plan_id,
      c.bron_bestemming,
      c.doel_vlak_id,
      c.doel_plan_id,
      c.doel_categorie,
      c.doel_bestemming,
      c.plan_regime,
      c.conversie_klasse,
      c.transitie_datum,
      c.transitie_jaar,
      c.heeft_pons_tijdelijk_deel ? 'Ja' : 'Nee',
      c.heeft_voorrangsbepaling_preambule ? 'Ja' : 'Nee',
      c.verwerkingsplicht_uiterlijk_op || '',
      c.perceel_totaal_m2,
      c.geconverteerd_perceel_m2,
      c.overlap_percentage,
      c.mutatie_type,
      c.aantal_hoekpunten,
      c.compactheid_score,
      c.mbc_reock_ratio,
      c.inwendige_breedte_m,
      c.bouwvlak_opp_m2_t1,
      c.bouwvlak_opp_m2_t2,
      c.is_bouwvlak_vervallen_op_t2 ? 'Ja' : 'Nee',
      c.object_niveau,
      c.rd_x,
      c.rd_y,
      c.lat,
      c.lng,
    ]
      .map(escapeCsv)
      .join(';')
  );

  return [headers.join(';'), ...rows].join('\n');
}
