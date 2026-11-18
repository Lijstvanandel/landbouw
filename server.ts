import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  isPointInSteenwijkerland,
  findClosestKern,
} from './src/data/steenwijkerland';
import {
  AgrarischeConversie,
  AgrarischeGebouwConversie,
  AUDIT_PEILDATUM_ISO,
  exportConversiesToCSV,
} from './src/types/agrarisch';
import {
  INITIAL_AGRARISCHE_CONVERSIES,
  INITIAL_GEBOUW_CONVERSIES,
  INITIAL_SLIVER_ARTIFACTS,
  computeExactPolygonGeometryMetrics,
  wgs84ToRd,
} from './src/data/agrarischeConversiesSteenwijkerland';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const PDOK_BRK_OGC_BASE =
  'https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/collections/perceel/items';
const PDOK_BGT_PAND_OGC_BASE =
  'https://api.pdok.nl/lv/bgt/ogc/v1/collections/pand/items';
const PDOK_BGT_OB_OGC_BASE =
  'https://api.pdok.nl/lv/bgt/ogc/v1/collections/overigbouwwerk/items';
const KOOP_SRU_BASE = 'https://repository.overheid.nl/sru';

const conversiesStore: Map<number, AgrarischeConversie> = new Map();
for (const item of INITIAL_AGRARISCHE_CONVERSIES) {
  if (
    isPointInSteenwijkerland(item.lat, item.lng) &&
    item.transitie_datum <= AUDIT_PEILDATUM_ISO
  ) {
    conversiesStore.set(item.conversie_id, item);
  }
}

const gebouwenStore: Map<number, AgrarischeGebouwConversie> = new Map();
for (const b of INITIAL_GEBOUW_CONVERSIES) {
  if (
    isPointInSteenwijkerland(b.lat, b.lng) &&
    b.transitie_datum <= AUDIT_PEILDATUM_ISO
  ) {
    gebouwenStore.set(b.gebouw_conversie_id, b);
  }
}

let lastPipelineRunTimestamp = new Date().toISOString();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // 1. Get all validated Agrarische Perceelconversies (Grond), Bouwvlakken_t1, Gebouwconversies (Indicatoren 1-4) & Slivers
  app.get('/api/conversies', (_req, res) => {
    const allConversies = Array.from(conversiesStore.values());
    const allGebouwen = Array.from(gebouwenStore.values());
    res.json({
      pipeline: {
        name: 'Geharmoniseerde Bitemporele Conversie-Engine (Grond BRK DKK v5, Bouwvlak_t1 én Gebouwen BAG/3D-BAG/BGT Indicatoren 1–4)',
        gemeente: 'Steenwijkerland (GM1708)',
        peildatum_t1: '2012-01-01',
        peildatum_t2: AUDIT_PEILDATUM_ISO,
        crs: 'EPSG:28992 (RD New) / EPSG:4326 (PMTiles v3 Gzip internalCompression=2)',
        lastRun: lastPipelineRunTimestamp,
      },
      totalCount: allConversies.length,
      buildingCount: allGebouwen.length,
      sliverCount: INITIAL_SLIVER_ARTIFACTS.length,
      conversies: allConversies,
      gebouwen: allGebouwen,
      slivers: INITIAL_SLIVER_ARTIFACTS,
    });
  });

  // 2. Live Multi-Source PDOK BRK Perceel + BAG/BGT Pand & OverigBouwwerk Inspector
  app.post('/api/brk/live-perceel', async (req, res) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !isPointInSteenwijkerland(lat, lng)
    ) {
      res.status(400).json({
        error:
          'Coördinaat valt buiten de gemeentegrenzen van Gemeente Steenwijkerland.',
      });
      return;
    }

    const deltaLat = 0.0014;
    const deltaLng = 0.0021;
    const bbox = `${(lng - deltaLng).toFixed(6)},${(lat - deltaLat).toFixed(6)},${(lng + deltaLng).toFixed(6)},${(lat + deltaLat).toFixed(6)}`;

    const pdokBrkUrl = `${PDOK_BRK_OGC_BASE}?bbox=${bbox}&limit=8&f=json`;
    const pdokPandUrl = `${PDOK_BGT_PAND_OGC_BASE}?bbox=${bbox}&limit=10&f=json`;
    const pdokObUrl = `${PDOK_BGT_OB_OGC_BASE}?bbox=${bbox}&limit=6&f=json`;

    try {
      const [brkResp, pandResp, obResp] = await Promise.all([
        fetch(pdokBrkUrl, {
          headers: { Accept: 'application/geo+json, application/json' },
          signal: AbortSignal.timeout(10000),
        }),
        fetch(pdokPandUrl, {
          headers: { Accept: 'application/geo+json, application/json' },
          signal: AbortSignal.timeout(10000),
        }).catch(() => null),
        fetch(pdokObUrl, {
          headers: { Accept: 'application/geo+json, application/json' },
          signal: AbortSignal.timeout(10000),
        }).catch(() => null),
      ]);

      if (!brkResp.ok) {
        res.status(502).json({
          error: `PDOK BRK OGC API retourneerde status ${brkResp.status}`,
        });
        return;
      }

      const brkData: any = await brkResp.json();
      const pandData: any =
        pandResp && pandResp.ok ? await pandResp.json() : { features: [] };
      const obData: any =
        obResp && obResp.ok ? await obResp.json() : { features: [] };

      const features = Array.isArray(brkData.features) ? brkData.features : [];

      const parsedParcels = features.map((f: any) => {
        const props = f.properties || {};
        const geom = f.geometry || {};
        let outerRing: [number, number][] = [];

        if (geom.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
          outerRing = geom.coordinates[0];
        } else if (
          geom.type === 'MultiPolygon' &&
          Array.isArray(geom.coordinates?.[0]?.[0])
        ) {
          outerRing = geom.coordinates[0][0];
        }

        const leafletCoords: [number, number][] = outerRing.map(
          ([pLng, pLat]: [number, number]) => [Number(pLat), Number(pLng)]
        );
        const metrics = computeExactPolygonGeometryMetrics(leafletCoords);
        const rd = wgs84ToRd(lat, lng);

        return {
          identificatie_lokaal_id: String(
            props.identificatie_lokaal_id || props.identificatie || 'Onbekend'
          ),
          kadastrale_gemeente_code: String(
            props.akr_kadastrale_gemeente_code_waarde ||
              props.kadastrale_gemeente_code ||
              'STW00'
          ),
          kadastrale_gemeente_naam: String(
            props.kadastrale_gemeente_waarde || 'Steenwijkerland'
          ),
          sectie: String(props.sectie || 'A'),
          perceelnummer: String(props.perceelnummer || ''),
          kadastrale_grootte_m2: Number(
            props.kadastrale_grootte_waarde || metrics.areaM2
          ),
          berekend_oppervlak_m2: metrics.areaM2,
          omtrek_m: metrics.perimeterM,
          polsby_popper: metrics.polsbyPopper,
          mbc_reock_ratio: metrics.reockRatio,
          inwendige_breedte_m: metrics.inscribedWidthM,
          aantal_hoekpunten: leafletCoords.length,
          tijdstip_registratie: String(
            props.begin_geldigheid || props.tijdstip_registratie || ''
          ),
          rd_x: rd.x,
          rd_y: rd.y,
          kern: findClosestKern(lat, lng),
          coords: leafletCoords,
        };
      });

      const parsedBuildings = [
        ...(Array.isArray(pandData.features) ? pandData.features : []).map(
          (f: any) => {
            const p = f.properties || {};
            const g = f.geometry || {};
            const ring =
              g.type === 'Polygon'
                ? g.coordinates?.[0] || []
                : g.coordinates?.[0]?.[0] || [];
            const coords: [number, number][] = ring.map(
              ([pLng, pLat]: [number, number]) => [Number(pLat), Number(pLng)]
            );
            const m = computeExactPolygonGeometryMetrics(coords);
            return {
              bron: 'BAG_PAND / BGT_PAND',
              identificatie: String(p.bag_pnd || p.lokaal_id || 'Onbekend'),
              bgt_lokaal_id: String(p.lokaal_id || ''),
              status: String(p.status || 'bestaand'),
              tijdstip_registratie: String(
                p.tijdstip_registratie || ''
              ).slice(0, 10),
              eind_registratie: p.eind_registratie
                ? String(p.eind_registratie).slice(0, 10)
                : null,
              footprint_m2: m.areaM2,
              coords,
            };
          }
        ),
        ...(Array.isArray(obData.features) ? obData.features : []).map(
          (f: any) => {
            const p = f.properties || {};
            const g = f.geometry || {};
            const ring =
              g.type === 'Polygon'
                ? g.coordinates?.[0] || []
                : g.coordinates?.[0]?.[0] || [];
            const coords: [number, number][] = ring.map(
              ([pLng, pLat]: [number, number]) => [Number(pLat), Number(pLng)]
            );
            const m = computeExactPolygonGeometryMetrics(coords);
            return {
              bron: 'BGT_OVERIG_BOUWWERK',
              identificatie: String(p.lokaal_id || 'Onbekend'),
              bgt_lokaal_id: String(p.lokaal_id || ''),
              status: `${p.status || 'bestaand'} (${p.type || 'bouwwerk'})`,
              tijdstip_registratie: String(
                p.tijdstip_registratie || ''
              ).slice(0, 10),
              eind_registratie: p.eind_registratie
                ? String(p.eind_registratie).slice(0, 10)
                : null,
              footprint_m2: m.areaM2,
              coords,
            };
          }
        ),
      ];

      res.json({
        source:
          'PDOK BRK Kadastrale Kaart OGC API v1 + PDOK LV BGT/BAG Pand & OverigBouwwerk OGC API v1 (Live)',
        queryUrl: pdokBrkUrl,
        count: parsedParcels.length,
        parcels: parsedParcels,
        buildings: parsedBuildings.slice(0, 8),
      });
    } catch (e: any) {
      res.status(500).json({
        error: `Kon PDOK BRK/BGT API niet bereiken: ${e?.message || 'Timeout'}`,
      });
    }
  });

  // 3. Live KOOP/DROP SRU 2.0 Gemeenteblad Harvester voor Gemeente Steenwijkerland
  app.get('/api/koop/live-bopa', async (_req, res) => {
    const sruQuery =
      'cql.serverChoice all "Steenwijkerland" AND cql.serverChoice all "omgevingsvergunning"';
    const sruUrl = `${KOOP_SRU_BASE}?operation=searchRetrieve&version=2.0&maximumRecords=15&query=${encodeURIComponent(sruQuery)}`;

    try {
      const resp = await fetch(sruUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) {
        res.status(502).json({
          error: `KOOP SRU 2.0 API retourneerde status ${resp.status}`,
        });
        return;
      }

      const xml = await resp.text();
      const recordMatches = [
        ...xml.matchAll(/<sru:record>([\s\S]*?)<\/sru:record>/g),
      ];
      const records = [];

      for (const m of recordMatches) {
        const body = m[1];
        const gmbId = body
          .match(/<dcterms:identifier>([^<]+)<\/dcterms:identifier>/)?.[1]
          ?.trim();
        const title = body
          .match(/<dcterms:title>([^<]+)<\/dcterms:title>/)?.[1]
          ?.trim();
        const avail = body
          .match(/<dcterms:available>([^<]+)<\/dcterms:available>/)?.[1]
          ?.trim()
          ?.slice(0, 10);

        if (
          gmbId &&
          title &&
          avail &&
          avail <= AUDIT_PEILDATUM_ISO &&
          !/aanvraag|ontwerp|geweigerd/i.test(title)
        ) {
          const yr = Number(avail.slice(0, 4)) || 2024;
          records.push({
            gmb_id: gmbId.toUpperCase(),
            transitie_datum: avail,
            zakelijke_beschrijving: title,
            plan_regime: 'BOPA (Omgevingsvergunning)',
            conversie_klasse: 'KLASSE_II_IN_EXPLOITATIE',
            heeft_pons_tijdelijk_deel: false,
            verwerkingsplicht_uiterlijk_op: `${yr + 5}${avail.slice(4)}`,
            url: `https://zoek.officielebekendmakingen.nl/${gmbId.toLowerCase()}.html`,
          });
        }
      }

      res.json({
        source: 'KOOP/DROP SRU 2.0 Officiële Bekendmakingen (repository.overheid.nl/sru)',
        query: sruQuery,
        count: records.length,
        records: records.slice(0, 10),
      });
    } catch (e: any) {
      res.status(500).json({
        error: `Kon KOOP SRU 2.0 API niet bereiken: ${e?.message || 'Timeout'}`,
      });
    }
  });

  // 4. Direct CSV Export
  app.get('/api/conversies/export.csv', (req, res) => {
    const selectedYear = Number(req.query.selectedYear) || 2026;
    const minOverlap = Number(req.query.minOverlap) || 5;
    const kern = String(req.query.kern || '').trim();

    const filtered = Array.from(conversiesStore.values()).filter((c) => {
      if (c.transitie_datum > AUDIT_PEILDATUM_ISO) return false;
      if (c.transitie_jaar > selectedYear) return false;
      if (c.overlap_percentage < minOverlap) return false;
      if (kern && c.kern !== kern) return false;
      return true;
    });

    const csv = exportConversiesToCSV(filtered);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="agrarische_bestemmingsconversies_steenwijkerland_2012_${selectedYear}.csv"`
    );
    res.send(csv);
  });

  // 5. Direct GeoJSON Export (Ground Parcels, Bouwvlakken_t1 & BAG/BGT Buildings Indicatoren 1-4)
  app.get('/api/conversies/export.geojson', (_req, res) => {
    const allConversies = Array.from(conversiesStore.values());
    const allGebouwen = Array.from(gebouwenStore.values());

    const parcelFeatures = allConversies.map((c) => {
      const ringLngLat = [
        ...c.polygon_coords.map(([lat, lng]) => [lng, lat]),
        [c.polygon_coords[0][1], c.polygon_coords[0][0]],
      ];
      return {
        type: 'Feature',
        id: `GROND-${c.conversie_id}`,
        properties: {
          conversie_id: c.conversie_id,
          object_niveau: 'GROND',
          perceel_id: c.perceel_id,
          virtueel_moederperceel_id: c.virtueel_moederperceel_id,
          bouwvlak_t1_id: c.bouwvlak_t1_id,
          kadastrale_gemeente_code: c.kadastrale_gemeente_code,
          sectie: c.sectie,
          perceelnummer: c.perceelnummer,
          kwaliteitslabel_dkk: c.dkk_kwaliteitslabel,
          kern: c.kern,
          bron_plan_id: c.bron_plan_id,
          bron_bestemming: c.bron_bestemming,
          doel_plan_id: c.doel_plan_id,
          doel_categorie: c.doel_categorie,
          doel_bestemming: c.doel_bestemming,
          plan_regime: c.plan_regime,
          conversie_klasse: c.conversie_klasse,
          transitie_datum: c.transitie_datum,
          transitie_jaar: c.transitie_jaar,
          heeft_pons_tijdelijk_deel: c.heeft_pons_tijdelijk_deel,
          heeft_voorrangsbepaling_preambule:
            c.heeft_voorrangsbepaling_preambule,
          perceel_totaal_m2: c.perceel_totaal_m2,
          geconverteerd_perceel_m2: c.geconverteerd_perceel_m2,
          overlap_percentage: c.overlap_percentage,
          mutatie_type: c.mutatie_type,
          polsby_popper_score: c.compactheid_score,
          mbc_reock_ratio: c.mbc_reock_ratio,
          inwendige_breedte_m: c.inwendige_breedte_m,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ringLngLat],
        },
      };
    });

    const buildingFeatures = allGebouwen.map((b) => {
      const ringLngLat = [
        ...b.coords.map(([lat, lng]) => [lng, lat]),
        [b.coords[0][1], b.coords[0][0]],
      ];
      return {
        type: 'Feature',
        id: `GEBOUW-${b.gebouw_conversie_id}`,
        properties: {
          conversie_id: b.conversie_id,
          gebouw_conversie_id: b.gebouw_conversie_id,
          object_niveau: 'GEBOUW',
          gebouw_id: b.gebouw_id,
          bron_registratie: b.bron_registratie,
          bouwvlak_id_t1: b.bouwvlak_id_t1,
          bouwvlak_overlap_beta: b.bouwvlak_overlap_beta,
          bron_plan_id: b.bron_plan_id,
          oorspronkelijk_bouwjaar: b.oorspronkelijk_bouwjaar,
          status_t1: b.status_t1,
          status_t2: b.status_t2,
          gebruiksdoel_t1: b.gebruiksdoel_t1,
          gebruiksdoel_t2: b.gebruiksdoel_t2,
          specifieke_aanduiding_t2: b.specifieke_aanduiding_t2,
          is_bouwvlak_vervallen_op_t2: b.is_bouwvlak_vervallen_op_t2,
          footprint_m2: b.footprint_m2,
          gebruiksoppervlak_gbo_m2: b.gebruiksoppervlak_gbo_m2,
          gebouw_volume_m3: b.gebouw_volume_m3,
          transitie_datum: b.transitie_datum,
          transitie_jaar: b.transitie_jaar,
          gebouw_indicator: b.gebouw_indicator,
          gebouw_conversie_type: b.gebouw_conversie_type,
          doel_categorie: b.doel_categorie,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ringLngLat],
        },
      };
    });

    res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="agrarische_conversies_grond_en_gebouwen_steenwijkerland.geojson"'
    );
    res.send(
      JSON.stringify(
        {
          type: 'FeatureCollection',
          name: 'agrarische_conversies_2012_2026',
          features: [...parcelFeatures, ...buildingFeatures],
        },
        null,
        2
      )
    );
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Agrarische Conversies Steenwijkerland (Grond, Bouwvlak_t1 & Gebouwen) server running on http://localhost:${PORT}`
    );
  });
}

startServer();
