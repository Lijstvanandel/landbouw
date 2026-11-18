import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  AgrarischeConversie,
  AgrarischeGebouwConversie,
  ALL_DOEL_CATEGORIEEN,
  CONVERSIE_KLASSE_META,
  DOEL_CATEGORIEEN,
  SliverPolygonArtifact,
} from '../types/agrarisch';
import {
  STEENWIJKERLAND_POLYGON,
  STEENWIJKERLAND_KERNEN,
  isPointInSteenwijkerland,
} from '../data/steenwijkerland';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  SlidersHorizontal,
  Play,
  Pause,
  Crosshair,
  ShieldCheck,
  FileSearch,
  Building2,
  Frame,
} from 'lucide-react';

interface MapComponentProps {
  conversies: AgrarischeConversie[];
  gebouwen: AgrarischeGebouwConversie[];
  showGround: boolean;
  showBuildings: boolean;
  onToggleBuildings: () => void;
  showBouwvlakkenT1: boolean;
  onToggleBouwvlakkenT1: () => void;
  slivers: SliverPolygonArtifact[];
  showSlivers: boolean;
  onToggleSlivers: () => void;
  showFullPerceelOutline: boolean;
  selectedConversie: AgrarischeConversie | null;
  onSelectConversie: (conv: AgrarischeConversie | null) => void;
  selectedGebouw: AgrarischeGebouwConversie | null;
  onSelectGebouw: (gebouw: AgrarischeGebouwConversie | null) => void;
  selectedYear: number;
  onChangeSelectedYear: (year: number) => void;
  showBrkWmsOverlay: boolean;
  onToggleBrkWmsOverlay: () => void;
  onToggleFilterPanel: () => void;
  showFilterPanel: boolean;
  flyToTarget: { lat: number; lng: number; zoom: number; ts: number } | null;
}

type TileLayerKey = 'pdok_grijs' | 'pdok_luchtfoto' | 'osm' | 'satellite';

const TILE_LAYERS: Record<
  TileLayerKey,
  { name: string; url: string; attribution: string; maxZoom: number }
> = {
  pdok_grijs: {
    name: 'PDOK BRT Achtergrondkaart (Grijs)',
    url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png',
    attribution: 'Kaartgegevens &copy; Kadaster / PDOK · IMRO / DSO-LV Ozon',
    maxZoom: 19,
  },
  pdok_luchtfoto: {
    name: 'PDOK Luchtfoto Actueel (Ortho 8cm RGB)',
    url: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg',
    attribution: 'Luchtfoto &copy; Kadaster / PDOK Beeldmateriaal.nl',
    maxZoom: 19,
  },
  osm: {
    name: 'OpenStreetMap (Standaard)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  satellite: {
    name: 'Esri Wereld Satelliet',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxZoom: 18,
  },
};

export const MapComponent: React.FC<MapComponentProps> = ({
  conversies,
  gebouwen,
  showGround,
  showBuildings,
  onToggleBuildings,
  showBouwvlakkenT1,
  onToggleBouwvlakkenT1,
  slivers,
  showSlivers,
  onToggleSlivers,
  showFullPerceelOutline,
  selectedConversie,
  onSelectConversie,
  selectedGebouw,
  onSelectGebouw,
  selectedYear,
  onChangeSelectedYear,
  showBrkWmsOverlay,
  onToggleBrkWmsOverlay,
  onToggleFilterPanel,
  showFilterPanel,
  flyToTarget,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const brkWmsLayerRef = useRef<L.TileLayer.WMS | null>(null);

  const perceelOutlinesGroupRef = useRef<L.LayerGroup | null>(null);
  const conversionsGroupRef = useRef<L.LayerGroup | null>(null);
  const bouwvlakkenT1GroupRef = useRef<L.LayerGroup | null>(null);
  const buildingsGroupRef = useRef<L.LayerGroup | null>(null);
  const sliversGroupRef = useRef<L.LayerGroup | null>(null);
  const selectedHighlightGroupRef = useRef<L.LayerGroup | null>(null);
  const liveBrkInspectGroupRef = useRef<L.LayerGroup | null>(null);
  const municipalityOutlineRef = useRef<L.Polygon | null>(null);

  const [activeTileLayer, setActiveTileLayer] =
    useState<TileLayerKey>('pdok_grijs');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(12);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [isBrkPickerActive, setIsBrkPickerActive] = useState(false);
  const [isLoadingLiveBrk, setIsLoadingLiveBrk] = useState(false);

  const onSelectConversieRef = useRef(onSelectConversie);
  useEffect(() => {
    onSelectConversieRef.current = onSelectConversie;
  }, [onSelectConversie]);

  const onSelectGebouwRef = useRef(onSelectGebouw);
  useEffect(() => {
    onSelectGebouwRef.current = onSelectGebouw;
  }, [onSelectGebouw]);

  const isBrkPickerActiveRef = useRef(isBrkPickerActive);
  useEffect(() => {
    isBrkPickerActiveRef.current = isBrkPickerActive;
  }, [isBrkPickerActive]);

  // Timeline Auto-Play Animation (2012 -> 2026)
  useEffect(() => {
    if (!isPlayingTimeline) return;
    const timer = window.setInterval(() => {
      onChangeSelectedYear(selectedYear >= 2026 ? 2012 : selectedYear + 1);
    }, 650);
    return () => window.clearInterval(timer);
  }, [isPlayingTimeline, selectedYear, onChangeSelectedYear]);

  // Initialize Leaflet Map with Pitch-Black Exterior Mask outside Gemeente Steenwijkerland
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [52.785, 6.12],
      zoom: 12,
      minZoom: 9,
      maxZoom: 19,
      zoomControl: false,
      preferCanvas: true,
    });

    mapInstanceRef.current = map;

    // 1. Pane for PDOK BRK Kadastrale Kaart WMS v5
    const brkWmsPane = map.createPane('brkWmsPane');
    brkWmsPane.style.zIndex = '360';
    brkWmsPane.style.pointerEvents = 'none';

    // 2. Pane for outer cadastral parcel contours (Partiële conversies veldkavel)
    const perceelOutlinesPane = map.createPane('perceelOutlinesPane');
    perceelOutlinesPane.style.zIndex = '390';
    perceelOutlinesPane.style.pointerEvents = 'none';

    // 3. Pane for Geconverteerde Grondvlakken (conversie-grond-fill & outline)
    const conversionsPane = map.createPane('conversionsPane');
    conversionsPane.style.zIndex = '415';

    // 3b. Pane for Historisch Agrarisch Bouwvlak_t1 Contour
    const bouwvlakkenT1Pane = map.createPane('bouwvlakkenT1Pane');
    bouwvlakkenT1Pane.style.zIndex = '418';

    // 4. Pane for Geconverteerde Opstallen (conversie-gebouw-fill & outline, boven grondvlakken & bouwvlak_t1)
    const buildingsPane = map.createPane('buildingsPane');
    buildingsPane.style.zIndex = '422';

    // 5. Pane for Eliminated Sliver-Polygons (GBKN/BGT ruis)
    const sliversPane = map.createPane('sliversPane');
    sliversPane.style.zIndex = '428';

    // 6. Pane for Selected Erf-Dossier Ensemble Highlight
    const highlightPane = map.createPane('highlightPane');
    highlightPane.style.zIndex = '435';
    highlightPane.style.pointerEvents = 'none';

    // 7. Exterior Pitch-Black Mask Pane outside Gemeente Steenwijkerland (#060e0a)
    const maskPane = map.createPane('exteriorBlackMaskPane');
    maskPane.style.zIndex = '450';
    maskPane.style.pointerEvents = 'none';

    const maskSvgRenderer = L.svg({ pane: 'exteriorBlackMaskPane' });

    const tileConfig = TILE_LAYERS[activeTileLayer];
    const tileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);
    currentTileLayerRef.current = tileLayer;

    // Inverted world polygon with hole = STEENWIJKERLAND_POLYGON
    const outerWorldRing: [number, number][] = [
      [-90, -180],
      [-90, 180],
      [90, 180],
      [90, -180],
    ];

    L.polygon([outerWorldRing, STEENWIJKERLAND_POLYGON], {
      renderer: maskSvgRenderer,
      pane: 'exteriorBlackMaskPane',
      stroke: true,
      color: '#437257',
      weight: 2.2,
      opacity: 1,
      fillColor: '#060e0a',
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);

    const municipalityOutline = L.polygon(STEENWIJKERLAND_POLYGON, {
      stroke: false,
      fill: false,
      interactive: false,
    }).addTo(map);
    municipalityOutlineRef.current = municipalityOutline;

    perceelOutlinesGroupRef.current = L.layerGroup().addTo(map);
    conversionsGroupRef.current = L.layerGroup().addTo(map);
    bouwvlakkenT1GroupRef.current = L.layerGroup().addTo(map);
    buildingsGroupRef.current = L.layerGroup().addTo(map);
    sliversGroupRef.current = L.layerGroup().addTo(map);
    selectedHighlightGroupRef.current = L.layerGroup().addTo(map);
    liveBrkInspectGroupRef.current = L.layerGroup().addTo(map);

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    // Click handler for Live PDOK BRK + BGT/BAG Perceel Prikker
    map.on('click', async (e: L.LeafletMouseEvent) => {
      if (!isBrkPickerActiveRef.current) return;
      const { lat, lng } = e.latlng;
      if (!isPointInSteenwijkerland(lat, lng)) return;

      setIsLoadingLiveBrk(true);
      try {
        const res = await fetch('/api/brk/live-perceel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        });
        const data = await res.json();
        const inspectGroup = liveBrkInspectGroupRef.current;
        if (inspectGroup) {
          inspectGroup.clearLayers();
          if (res.ok && Array.isArray(data.parcels) && data.parcels.length > 0) {
            const p = data.parcels[0];
            if (Array.isArray(p.coords) && p.coords.length >= 3) {
              const poly = L.polygon(p.coords, {
                pane: 'highlightPane',
                color: '#38bdf8',
                weight: 2.5,
                fillColor: '#38bdf8',
                fillOpacity: 0.22,
                dashArray: '4, 4',
                interactive: false,
              });
              inspectGroup.addLayer(poly);
            }

            if (Array.isArray(data.bgt_panden)) {
              for (const bp of data.bgt_panden) {
                if (Array.isArray(bp.coords) && bp.coords.length >= 3) {
                  const bPoly = L.polygon(bp.coords, {
                    pane: 'highlightPane',
                    color: '#34d399',
                    weight: 2.2,
                    fillColor: '#10b981',
                    fillOpacity: 0.35,
                    interactive: false,
                  });
                  inspectGroup.addLayer(bPoly);
                }
              }
            }

            const pandCount = Array.isArray(data.bgt_panden)
              ? data.bgt_panden.length
              : 0;

            const popupHtml = `
              <div class="p-3 text-xs text-[#f5f6f4] space-y-1 font-sans tabular-nums">
                <div class="text-[10px] font-mono text-sky-400 font-bold">LIVE PDOK BRK + BGT/BAG OGC API v1</div>
                <div class="font-bold text-sm">${p.kadastrale_gemeente_code} ${p.sectie} ${p.perceelnummer}</div>
                <div class="text-[11px] text-[#9bb0a4]">Lokaal ID: <span class="font-mono text-[#f5f6f4]">${p.identificatie_lokaal_id}</span> · ${p.aantal_hoekpunten ?? '-'} vertices</div>
                <div class="text-[11px] text-[#9bb0a4]">Kadastrale grootte: <span class="font-mono text-[#fbbf24] font-semibold">${Number(p.kadastrale_grootte_m2).toLocaleString('nl-NL')} m²</span></div>
                <div class="text-[11px] text-[#9bb0a4]">Polsby-Popper PP(G): <span class="font-mono text-emerald-400 font-semibold">${p.polsby_popper}</span> · Reock R_MBC: ${p.mbc_reock_ratio ?? '-'}</div>
                <div class="text-[11px] text-emerald-300 font-mono">Gevonden BGT/BAG panden in bbox: ${pandCount}</div>
                <div class="text-[10px] text-[#60756a] font-mono">RD New (EPSG:28992): X ${p.rd_x} · Y ${p.rd_y}</div>
              </div>
            `;

            L.popup()
              .setLatLng([lat, lng])
              .setContent(popupHtml)
              .openOn(map);
          }
        }
      } catch {
        // ignore
      } finally {
        setIsLoadingLiveBrk(false);
      }
    });

    try {
      const bounds = municipalityOutline.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    } catch {
      // ignore
    }

    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    if (mapContainerRef.current) {
      ro.observe(mapContainerRef.current);
    }

    return () => {
      ro.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch Base Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const tileConfig = TILE_LAYERS[activeTileLayer];
    const newTileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);

    currentTileLayerRef.current = newTileLayer;
  }, [activeTileLayer]);

  // Toggle Live PDOK BRK Kadastrale Kaart WMS v5 Overlay
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (brkWmsLayerRef.current) {
      map.removeLayer(brkWmsLayerRef.current);
      brkWmsLayerRef.current = null;
    }

    if (showBrkWmsOverlay) {
      const wmsLayer = L.tileLayer.wms(
        'https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0',
        {
          layers: 'Perceel,KadastraleGrens,Nummeraanduidingreeks',
          format: 'image/png',
          transparent: true,
          pane: 'brkWmsPane',
          maxZoom: 19,
          minZoom: 14,
          opacity: 0.75,
        }
      );
      wmsLayer.addTo(map);
      brkWmsLayerRef.current = wmsLayer;
    }
  }, [showBrkWmsOverlay]);

  // Pijler 1: Render Geconverteerde Agrarische Grondvlakken & Kadastrale Perceelcontouren
  useEffect(() => {
    const convGroup = conversionsGroupRef.current;
    const perceelGroup = perceelOutlinesGroupRef.current;
    const bvGroup = bouwvlakkenT1GroupRef.current;
    if (!convGroup || !perceelGroup || !bvGroup) return;

    convGroup.clearLayers();
    perceelGroup.clearLayers();
    bvGroup.clearLayers();

    // Interpolate fill-opacity based on zoom (conform pagina 47 van de PDF: zoom 7 -> 0.85, zoom 15 -> 0.65)
    const fillOpacity =
      currentZoom <= 11 ? 0.85 : currentZoom >= 15 ? 0.65 : 0.75;
    const showOutline = currentZoom >= 12;

    for (const item of conversies) {
      const catMeta = DOEL_CATEGORIEEN[item.doel_categorie];
      const klasseMeta = CONVERSIE_KLASSE_META[item.conversie_klasse];
      const isBopa = item.plan_regime === 'BOPA (Omgevingsvergunning)';

      // 1. Indien Partiële conversie en showFullPerceelOutline actief: teken het volledige kadastrale moederperceel (veldkavel)
      if (
        showGround &&
        showFullPerceelOutline &&
        item.mutatie_type === 'Partiële conversie' &&
        currentZoom >= 12
      ) {
        const outerPoly = L.polygon(item.perceel_coords, {
          pane: 'perceelOutlinesPane',
          color: '#10b981',
          weight: 1.3,
          dashArray: '4, 4',
          fillColor: '#10b981',
          fillOpacity: 0.06,
          interactive: false,
        });
        perceelGroup.addLayer(outerPoly);
      }

      // 1b. Teken Historisch Agrarisch Bouwvlak_t1 Contour indien ingeschakeld
      if (
        showBouwvlakkenT1 &&
        Array.isArray(item.bouwvlak_coords) &&
        item.bouwvlak_coords.length >= 3 &&
        currentZoom >= 12
      ) {
        const bvPoly = L.polygon(item.bouwvlak_coords, {
          pane: 'bouwvlakkenT1Pane',
          color: '#fbbf24',
          weight: currentZoom >= 15 ? 2.0 : 1.4,
          dashArray: '6, 4',
          fillColor: '#fbbf24',
          fillOpacity: 0.07,
          interactive: true,
        });

        bvPoly.bindTooltip(
          `<div class="text-xs text-[#f5f6f4] tabular-nums">
            <div class="font-mono font-bold text-[#fbbf24]">HISTORISCH AGRARISCH BOUWVLAK (t₁)</div>
            <div class="font-semibold">${item.bouwvlak_t1_id} · ${item.kern}</div>
            <div class="text-[11px] text-[#9bb0a4]">Bouwvlak t₁: ${item.bouwvlak_opp_m2_t1.toLocaleString('nl-NL')} m² &rarr; t₂: ${item.bouwvlak_opp_m2_t2.toLocaleString('nl-NL')} m² (${
            item.is_bouwvlak_vervallen_op_t2 ? 'Vervallen op t₂' : 'Deels gehandhaafd'
          })</div>
          </div>`,
          { sticky: true, direction: 'top', offset: [0, -6] }
        );

        bvPoly.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectGebouwRef.current(null);
          onSelectConversieRef.current(item);
        });

        bvGroup.addLayer(bvPoly);
      }

      if (!showGround) continue;

      // 2. Teken het Geconverteerde Perceelvlak (conversie-grond-fill & conversie-grond-outline)
      const outlineColor = isBopa ? '#FA903E' : '#111111';
      const lineWeight = isBopa
        ? currentZoom >= 15
          ? 2.2
          : 1.5
        : currentZoom >= 15
        ? 1.5
        : 0.9;

      const poly = L.polygon(item.polygon_coords, {
        pane: 'conversionsPane',
        fillColor: catMeta.fillHex,
        fillOpacity,
        stroke: showOutline || isBopa,
        color: outlineColor,
        weight: lineWeight,
        opacity: 0.95,
        interactive: true,
      });

      const popupHtml = `
        <div class="p-3.5 text-xs text-[#f5f6f4] space-y-1.5 font-sans tabular-nums min-w-[275px]">
          <div class="flex items-center justify-between gap-2 border-b border-[#1b3829] pb-1.5">
            <span class="font-mono font-bold text-[#fbbf24]">${item.kadastrale_gemeente_code} ${item.sectie} ${item.perceelnummer}</span>
            <span class="text-[10px] font-mono" style="color:${klasseMeta.badgeColor}">${klasseMeta.shortLabel} · ${item.plan_regime}</span>
          </div>
          <div class="leading-relaxed">
            <strong>Kadastraal Perceel:</strong> ${item.kadastrale_gemeente_code} ${item.sectie} ${item.perceelnummer} (BRK ${item.brk_perceel_id})<br>
            <strong>Transitie:</strong> ${item.bron_bestemming} &rarr; <b style="color:${catMeta.fillHex}">${item.doel_categorie}</b> (${item.doel_bestemming})<br>
            <strong>Datum Inwerkingtreding:</strong> ${item.transitie_datum}<br>
            <strong>Geconverteerd Oppervlak (Pᵢ &cap; Cⱼ):</strong> ${item.geconverteerd_perceel_m2.toLocaleString('nl-NL')} m² (${item.overlap_percentage}% van ${item.perceel_totaal_m2.toLocaleString('nl-NL')} m²)<br>
            <strong>Bouwvlak t₁ &rarr; t₂:</strong> ${item.bouwvlak_opp_m2_t1.toLocaleString('nl-NL')} m² &rarr; ${item.bouwvlak_opp_m2_t2.toLocaleString('nl-NL')} m²<br>
            <strong>Multi-Vertex Topologie:</strong> ${item.aantal_hoekpunten} hoekpunten · PP(G): ${item.compactheid_score} · R_MBC: ${item.mbc_reock_ratio} · 2r_MIC: ${item.inwendige_breedte_m}m
            ${
              item.verwerkingsplicht_uiterlijk_op
                ? `<br><strong style="color:#FA903E">Verwerkingsplicht art. 4.17 Ow:</strong> uiterlijk ${item.verwerkingsplicht_uiterlijk_op}`
                : ''
            }
          </div>
        </div>
      `;

      poly.bindTooltip(
        `<div class="text-xs text-[#f5f6f4] tabular-nums">
          <div class="font-bold" style="color:${catMeta.fillHex}">${item.transitie_jaar} · Agrarisch &rarr; ${item.doel_categorie} (${klasseMeta.shortLabel})</div>
          <div class="font-semibold">${item.kadastrale_gemeente_code} ${item.sectie} ${item.perceelnummer} — ${item.kern}</div>
          <div class="text-[11px] text-[#9bb0a4]">${item.geconverteerd_perceel_m2.toLocaleString('nl-NL')} m² (${item.overlap_percentage}%) · PP(G)=${item.compactheid_score} · Klik voor Erf-Dossier</div>
        </div>`,
        { sticky: true, direction: 'top', offset: [0, -6] }
      );

      poly.bindPopup(popupHtml);

      poly.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectGebouwRef.current(null);
        onSelectConversieRef.current(item);
      });

      convGroup.addLayer(poly);

      // 3. Op lagere zoomniveaus (< 13) extra kavel-indicator zodat ook kleinere erf- en strookconversies direct zichtbaar en klikbaar zijn
      if (currentZoom < 13) {
        const centroidMarker = L.circleMarker([item.lat, item.lng], {
          pane: 'conversionsPane',
          radius: currentZoom <= 10 ? 4.5 : 5.5,
          fillColor: catMeta.fillHex,
          fillOpacity: 0.92,
          color: isBopa ? '#FA903E' : '#060e0a',
          weight: isBopa ? 1.8 : 1.2,
          interactive: true,
        });

        centroidMarker.bindTooltip(
          `<div class="text-xs text-[#f5f6f4] tabular-nums">
            <div class="font-bold" style="color:${catMeta.fillHex}">${item.transitie_jaar} · Agrarisch &rarr; ${item.doel_categorie}</div>
            <div class="font-semibold">${item.kadastrale_gemeente_code} ${item.sectie} ${item.perceelnummer} (${item.kern})</div>
            <div class="text-[11px] text-[#9bb0a4]">${item.geconverteerd_perceel_m2.toLocaleString('nl-NL')} m² (${item.overlap_percentage}%) · ${item.mutatie_type}</div>
          </div>`,
          { direction: 'top', offset: [0, -6] }
        );

        centroidMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectGebouwRef.current(null);
          onSelectConversieRef.current(item);
        });

        convGroup.addLayer(centroidMarker);
      }
    }
  }, [
    conversies,
    currentZoom,
    showFullPerceelOutline,
    showGround,
    showBouwvlakkenT1,
  ]);

  // Pijler 2: Render Geconverteerde Agrarische Opstallen (BAG Panden / 3D BAG LoD2.2 / BGT OverigBouwwerk)
  useEffect(() => {
    const bGroup = buildingsGroupRef.current;
    if (!bGroup) return;

    bGroup.clearLayers();
    if (!showBuildings) return;

    for (const g of gebouwen) {
      const catMeta = DOEL_CATEGORIEEN[g.doel_categorie];
      const isSloop = g.gebouw_conversie_type === 'Sloop agrarische opstal';
      const isRoodVoorRood =
        g.gebouw_indicator ===
        '4. Vervangende Nieuwbouw / Rood-voor-Rood (Bouwjaar > t1)';

      // Conform pagina 48 van de PDF: '#111111' voor Sloop, of doelcategorie kleur voor Herbestemming/Nieuwbouw
      const fillColor = isSloop ? '#111111' : catMeta.fillHex;
      const strokeColor = isRoodVoorRood ? '#22d3ee' : '#FFFFFF';

      const bPoly = L.polygon(g.coords, {
        pane: 'buildingsPane',
        fillColor,
        fillOpacity: 0.92,
        stroke: true,
        color: strokeColor,
        weight: currentZoom >= 15 ? 2.2 : 1.6,
        dashArray: isSloop ? '3, 2' : undefined,
        opacity: 1,
        interactive: true,
      });

      const popupHtml = `
        <div class="p-3.5 text-xs text-[#f5f6f4] space-y-1.5 font-sans tabular-nums min-w-[275px]">
          <div class="flex items-center justify-between gap-2 border-b border-[#1b3829] pb-1.5">
            <span class="font-mono font-bold text-emerald-400">${g.bron_registratie}</span>
            <span class="text-[10px] font-mono text-[#fbbf24]">${g.gebouw_id}</span>
          </div>
          <div class="leading-relaxed">
            <strong>Indicator:</strong> <span class="text-[#fbbf24]">${g.gebouw_indicator}</span><br>
            <strong>Locatie:</strong> ${g.adres} (${g.kern}) · Perceel ${g.kadastrale_aanduiding}<br>
            <strong>Opstaltransitie:</strong> ${g.gebruiksdoel_t1} (bouwjaar ${g.oorspronkelijk_bouwjaar}) &rarr; <b style="color:${catMeta.fillHex}">${g.gebouw_conversie_type}</b><br>
            <strong>Nieuwe Functie:</strong> ${g.gebruiksdoel_t2} (${g.transitie_datum})<br>
            <strong>Footprint / GBO:</strong> ${g.footprint_m2.toLocaleString('nl-NL')} m² footprint · ${g.gebruiksoppervlak_gbo_m2.toLocaleString('nl-NL')} m² GBO<br>
            <strong>3D BAG LoD2.2 Volume:</strong> ${g.gebouw_volume_m3.toLocaleString('nl-NL')} m³ (nokhoogte ${g.nokhoogte_m} m)<br>
            <strong class="text-sky-300">Beslisboom:</strong> ${g.ontkoppelings_regel} (&beta;_pand = ${Math.round(g.bouwvlak_overlap_beta * 100)}%)
          </div>
        </div>
      `;

      bPoly.bindTooltip(
        `<div class="text-xs text-[#f5f6f4] tabular-nums">
          <div class="font-bold text-emerald-300">${g.gebouw_indicator}</div>
          <div class="font-semibold">${g.adres} (${g.kern}) · Bouwjaar ${g.oorspronkelijk_bouwjaar}</div>
          <div class="text-[11px] text-[#9bb0a4]">Footprint: ${g.footprint_m2} m² · Volume: ${g.gebouw_volume_m3.toLocaleString('nl-NL')} m³ · Klik voor Erf-Dossier</div>
        </div>`,
        { sticky: true, direction: 'top', offset: [0, -6] }
      );

      bPoly.bindPopup(popupHtml);

      bPoly.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectGebouwRef.current(g);
      });

      bGroup.addLayer(bPoly);

      // Op lagere zoomniveaus (< 14) een cirkel met witte/cyaan rand zodat de gebouwconversie goed zichtbaar is
      if (currentZoom < 14) {
        const bMarker = L.circleMarker([g.lat, g.lng], {
          pane: 'buildingsPane',
          radius: currentZoom <= 11 ? 4.5 : 5.5,
          fillColor,
          fillOpacity: 0.95,
          color: strokeColor,
          weight: 1.8,
          interactive: true,
        });

        bMarker.bindTooltip(
          `<div class="text-xs text-[#f5f6f4] tabular-nums">
            <div class="font-bold text-emerald-300">${g.gebouw_indicator}</div>
            <div class="font-semibold">${g.adres} (${g.kern})</div>
            <div class="text-[11px] text-[#9bb0a4]">Footprint: ${g.footprint_m2} m² · 3D Volume: ${g.gebouw_volume_m3.toLocaleString('nl-NL')} m³</div>
          </div>`,
          { direction: 'top', offset: [0, -6] }
        );

        bMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectGebouwRef.current(g);
        });

        bGroup.addLayer(bMarker);
      }
    }
  }, [gebouwen, currentZoom, showBuildings]);

  // Render Geëlimineerde GBKN/BGT Sliver-Polygons (indien ingeschakeld)
  useEffect(() => {
    const slGroup = sliversGroupRef.current;
    if (!slGroup) return;

    slGroup.clearLayers();
    if (!showSlivers) return;

    for (const sl of slivers) {
      const sliverPoly = L.polygon(sl.coords, {
        pane: 'sliversPane',
        color: '#22d3ee',
        weight: 2,
        dashArray: '3, 3',
        fillColor: '#06b6d4',
        fillOpacity: 0.45,
        interactive: true,
      });

      sliverPoly.bindTooltip(
        `<div class="text-xs text-white tabular-nums space-y-0.5">
          <div class="font-mono font-bold text-cyan-300">VERWORPEN SLIVER-POLYGON (${sl.sliver_id})</div>
          <div class="font-semibold">${sl.kadastraal_perceel} · ${sl.kern}</div>
          <div class="text-[11px] text-cyan-100">${sl.oorzaak}</div>
          <div class="text-[11px] font-mono text-amber-300">${sl.verworpen_stap}</div>
          <div class="text-[10px] font-mono text-neutral-300">Opp: ${sl.oppervlakte_m2} m² · PP(G): ${sl.polsby_popper} · Breedte: ${sl.inwendige_breedte_m}m</div>
        </div>`,
        { sticky: true, direction: 'top' }
      );

      slGroup.addLayer(sliverPoly);

      const dot = L.circleMarker([sl.lat, sl.lng], {
        pane: 'sliversPane',
        radius: 4,
        fillColor: '#22d3ee',
        fillOpacity: 0.9,
        color: '#060e0a',
        weight: 1,
      });
      dot.bindTooltip(
        `Geëlimineerde Sliver (${sl.verworpen_stap}) · PP=${sl.polsby_popper}`,
        { direction: 'top' }
      );
      slGroup.addLayer(dot);
    }
  }, [slivers, showSlivers]);

  // Highlight Selected Integrated Erf-Dossier Ensemble (Perceel + Geconverteerde Snede + Bouwvlak_t1 + Gekoppelde Opstallen)
  useEffect(() => {
    const hlGroup = selectedHighlightGroupRef.current;
    if (!hlGroup) return;

    hlGroup.clearLayers();

    if (selectedConversie) {
      // 1. Volledig kadastraal moederperceel P_i
      const motherOutline = L.polygon(selectedConversie.perceel_coords, {
        pane: 'highlightPane',
        color: '#10b981',
        weight: 2,
        dashArray: '5, 5',
        fillColor: '#10b981',
        fillOpacity: 0.06,
        interactive: false,
      });
      hlGroup.addLayer(motherOutline);

      // 2. Geconverteerd deelperceel P_i ∩ C_j
      const convHighlight = L.polygon(selectedConversie.polygon_coords, {
        pane: 'highlightPane',
        color: '#ffffff',
        weight: 3,
        fillOpacity: 0,
        interactive: false,
      });
      hlGroup.addLayer(convHighlight);

      // 3. Historisch Agrarisch Bouwvlak_t1 op dit erf
      if (
        Array.isArray(selectedConversie.bouwvlak_coords) &&
        selectedConversie.bouwvlak_coords.length >= 3
      ) {
        const bvHighlight = L.polygon(selectedConversie.bouwvlak_coords, {
          pane: 'highlightPane',
          color: '#fbbf24',
          weight: 2.4,
          dashArray: '6, 4',
          fillColor: '#fbbf24',
          fillOpacity: 0.1,
          interactive: false,
        });
        hlGroup.addLayer(bvHighlight);
      }

      // 4. Alle gekoppelde BAG/BGT opstallen binnen dit Erf-Dossier
      const linkedBuildings = gebouwen.filter(
        (g) => g.conversie_id === selectedConversie.conversie_id
      );
      for (const lb of linkedBuildings) {
        const bHighlight = L.polygon(lb.coords, {
          pane: 'highlightPane',
          color: '#34d399',
          weight: 3.2,
          fillColor: '#34d399',
          fillOpacity: 0.2,
          interactive: false,
        });
        hlGroup.addLayer(bHighlight);
      }
    } else if (selectedGebouw) {
      const bHighlight = L.polygon(selectedGebouw.coords, {
        pane: 'highlightPane',
        color: '#34d399',
        weight: 3.5,
        fillOpacity: 0.15,
        interactive: false,
      });
      hlGroup.addLayer(bHighlight);
    }
  }, [selectedConversie, selectedGebouw, gebouwen]);

  // Respond to external flyToTarget
  useEffect(() => {
    if (!flyToTarget || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(
      [flyToTarget.lat, flyToTarget.lng],
      flyToTarget.zoom,
      { duration: 1.0 }
    );
  }, [flyToTarget]);

  const resetToMunicipality = () => {
    if (!mapInstanceRef.current) return;
    if (municipalityOutlineRef.current) {
      const bounds = municipalityOutlineRef.current.getBounds();
      if (bounds.isValid()) {
        mapInstanceRef.current.flyToBounds(bounds, {
          padding: [20, 20],
          duration: 1.0,
        });
        return;
      }
    }
    mapInstanceRef.current.flyTo([52.785, 6.12], 12, { duration: 1.0 });
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#060e0a] tabular-nums">
      <div
        ref={mapContainerRef}
        className="w-full h-full bg-[#060e0a]"
        id="map"
      />

      {/* Top-Left Map Toolbar */}
      <div className="absolute top-3 left-3 right-3 sm:right-auto z-[500] flex flex-col gap-2 max-w-full">
        <div className="flex items-center gap-1 bg-[var(--bg-card)]/95 backdrop-blur-xs p-1 rounded-[6px] border border-[var(--border-subtle)] shadow-2xl text-[var(--text-main)] overflow-x-auto no-scrollbar">
          {/* Toggle Filter Panel Button */}
          <button
            type="button"
            onClick={onToggleFilterPanel}
            className={`px-2.5 py-1.5 rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showFilterPanel
                ? 'bg-[var(--bg-elevated)] text-[var(--accent-gold-bright)] border border-[var(--border-focus)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
            <span>
              Filters ({conversies.length} kavels · {gebouwen.length} panden)
            </span>
          </button>

          <div className="w-[1px] h-4 bg-[var(--border-subtle)] shrink-0" />

          {/* Toggle Pijler 2: BAG & BGT Opstallen */}
          <button
            type="button"
            onClick={onToggleBuildings}
            className={`px-2.5 py-1.5 rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showBuildings
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
            title="Toon Pijler 2: Geconverteerde agrarische opstallen (BAG 2.0 / 3D BAG LoD2.2 / BGT)"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>BAG/BGT Opstallen ({gebouwen.length})</span>
          </button>

          {/* Toggle Historisch Agrarisch Bouwvlak_t1 */}
          <button
            type="button"
            onClick={onToggleBouwvlakkenT1}
            className={`px-2.5 py-1.5 rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showBouwvlakkenT1
                ? 'bg-amber-500/20 text-[var(--accent-gold-bright)] border border-[var(--accent-gold)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
            title="Toon historische agrarische bouwvlakcontouren op peildatum t₁ (vanaf zoom 12)"
          >
            <Frame className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
            <span>Bouwvlak t₁</span>
          </button>

          <div className="w-[1px] h-4 bg-[var(--border-subtle)] shrink-0" />

          {/* Live PDOK BRK Kadastrale Grenzen WMS v5 Toggle */}
          <button
            type="button"
            onClick={onToggleBrkWmsOverlay}
            className={`px-2.5 py-1.5 rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showBrkWmsOverlay
                ? 'bg-[var(--accent-gold)] text-[#060e0a] font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
            title="Toon live PDOK BRK Kadastrale Kaart v5 perceelsgrenzen (vanaf zoom 14)"
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>BRK Kadastrale Kaart (WMS)</span>
          </button>

          {/* Live PDOK BRK Perceel Prikker */}
          <button
            type="button"
            onClick={() => setIsBrkPickerActive(!isBrkPickerActive)}
            className={`px-2.5 py-1.5 rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isBrkPickerActive
                ? 'bg-sky-500 text-[#060e0a] font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
            title="Klik op een willekeurig perceel in Steenwijkerland om live PDOK BRK + BGT/BAG OGC API v1 gegevens op te halen"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>
              {isLoadingLiveBrk
                ? 'PDOK Laden...'
                : isBrkPickerActive
                ? 'PDOK Prikker Actief (Klik op kaart)'
                : 'Live PDOK BRK/BGT Prikker'}
            </span>
          </button>

          <div className="w-[1px] h-4 bg-[var(--border-subtle)] shrink-0" />

          {/* Sliver-Polygon Inspectie Toggle */}
          <button
            type="button"
            onClick={onToggleSlivers}
            className={`px-2.5 py-1.5 rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showSlivers
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
            title="Toon geëlimineerde GBKN/BGT Sliver-Polygons (Polsby-Popper < 0.08 & 2r_MIC < 2.5m)"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sliver-Filter ({slivers.length})</span>
          </button>

          <div className="w-[1px] h-4 bg-[var(--border-subtle)] shrink-0" />

          {/* Basemap Switcher */}
          <button
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] rounded-[4px] transition-colors cursor-pointer shrink-0"
            title="Basiskaart wijzigen (PDOK BRT Grijs / Luchtfoto / OSM)"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>

        {showLayerMenu && (
          <div className="w-72 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[6px] shadow-2xl p-1.5 z-50 text-xs">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
              Ondergrondkaart (Buiten Steenwijkerland zwart)
            </div>
            {(Object.keys(TILE_LAYERS) as TileLayerKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveTileLayer(key);
                  setShowLayerMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-[4px] transition-colors flex items-center justify-between cursor-pointer ${
                  activeTileLayer === key
                    ? 'bg-[var(--accent-gold)] text-[#060e0a] font-bold'
                    : 'text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <span>{TILE_LAYERS[key].name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom-Left: 60 FPS Tijdschuif (Timeline Slider) + Legenda + Snelkeuze Kernen */}
      <div className="absolute bottom-3 left-3 z-[500] flex flex-col gap-2 max-w-[calc(100%-85px)]">
        {/* 60 FPS Tijdschuif */}
        <div className="bg-[var(--bg-card)]/95 backdrop-blur-xs border border-[var(--border-subtle)] rounded-[6px] px-3.5 py-2.5 shadow-2xl flex flex-wrap items-center gap-3 text-xs text-[var(--text-main)]">
          <button
            type="button"
            onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
            className="px-2.5 py-1 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            {isPlayingTimeline ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pauze</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Tijdreis</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 min-w-[200px] sm:min-w-[280px] flex-1">
            <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
              Peildatum t₂:
            </span>
            <input
              id="timeline-slider"
              type="range"
              min={2012}
              max={2026}
              step={1}
              value={selectedYear}
              onChange={(e) => onChangeSelectedYear(Number(e.target.value))}
              className="w-full accent-[var(--accent-gold)] cursor-pointer h-1.5 bg-[var(--bg-elevated)] rounded-lg"
            />
            <span
              id="timeline-year-label"
              className="font-mono text-sm font-bold text-[var(--accent-gold-bright)] w-11 text-right"
            >
              {selectedYear}
            </span>
          </div>

          <span className="hidden md:inline text-[11px] font-mono text-[var(--text-dim)]">
            {selectedYear >= 2024
              ? 'Regime: Omgevingswet (STOP/TPOD + TAM-IMRO + BOPA art. 4.17)'
              : 'Regime: Wet ruimtelijke ordening (IMRO2012 · SVBP2012)'}
          </span>
        </div>

        {/* Legenda: 6 Canonieke Doelcategorieën + BOPA Contour + Bouwvlak_t1 + Opstallen */}
        <div className="bg-[var(--bg-card)]/95 backdrop-blur-xs border border-[var(--border-subtle)] rounded-[6px] px-3 py-2 shadow-xl flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-main)]">
          <span className="font-display font-bold text-[var(--text-muted)]">
            Agrarisch &rarr; Doel:
          </span>
          {ALL_DOEL_CATEGORIEEN.map((cat) => {
            const meta = DOEL_CATEGORIEEN[cat];
            return (
              <span key={cat} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-[2px] border border-black/50 inline-block"
                  style={{ backgroundColor: meta.fillHex }}
                />
                <span>{meta.shortLabel}</span>
              </span>
            );
          })}
          <span className="text-[var(--text-dim)]">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[2px] border-2 border-[#FA903E] bg-transparent inline-block" />
            <span>BOPA (Klasse II)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[2px] border border-dashed border-[#fbbf24] bg-[#fbbf24]/15 inline-block" />
            <span>Bouwvlak t₁</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[2px] border-2 border-white bg-[#111111] inline-block" />
            <span>Sloop / Herbestemd Pand</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[2px] border-2 border-[#22d3ee] bg-[#E63946] inline-block" />
            <span>Rood-voor-Rood (&gt; t₁)</span>
          </span>
        </div>

        {/* Snelkeuze Kernen */}
        <div className="hidden sm:flex items-center gap-1 bg-[var(--bg-card)]/95 backdrop-blur-xs p-1 rounded-[6px] border border-[var(--border-subtle)] shadow-xl overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={resetToMunicipality}
            className="px-2 py-1 rounded-[4px] text-[11px] font-semibold bg-[var(--bg-elevated)] text-[var(--accent-gold-bright)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer whitespace-nowrap"
          >
            Hele Gemeente
          </button>
          {STEENWIJKERLAND_KERNEN.slice(0, 8).map((kern) => (
            <button
              key={kern.name}
              type="button"
              onClick={() => {
                mapInstanceRef.current?.flyTo([kern.lat, kern.lng], kern.zoom, {
                  duration: 1.0,
                });
              }}
              className="px-2 py-1 rounded-[4px] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer whitespace-nowrap"
            >
              {kern.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom-Right Zoom Controls */}
      <div className="absolute bottom-6 right-3 z-[500] flex flex-col gap-1 bg-[var(--bg-card)]/95 backdrop-blur-xs p-1 rounded-[6px] border border-[var(--border-subtle)] shadow-2xl">
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="p-2 text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] rounded-[4px] transition-colors cursor-pointer"
          title="Inzoomen"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="h-[1px] bg-[var(--border-subtle)]" />
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="p-2 text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] rounded-[4px] transition-colors cursor-pointer"
          title="Uitzoomen"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-[1px] bg-[var(--border-subtle)]" />
        <button
          type="button"
          onClick={resetToMunicipality}
          className="p-2 text-[var(--accent-gold-bright)] hover:bg-[var(--bg-card-hover)] rounded-[4px] transition-colors cursor-pointer"
          title="Toon hele Gemeente Steenwijkerland"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
