import { createRequire } from 'node:module';
import { type GeoPermissibleObjects, geoArea, geoCentroid, geoDistance, geoMercator, geoOrthographic, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

// Place outlines for tag visuals (docs/tag-visuals.md): Taiwan's counties and
// townships (taiwan-atlas, from the 內政部國土測繪中心 boundaries) and the
// world's countries (world-atlas, Natural Earth). Drawn as white shapes with
// the site's orange line, like the person sketches; the larger picture shows
// where the place is.

const require = createRequire(import.meta.url);
const ORANGE = '#f54900';
const SIZE = 160;

type Shape = Feature<Polygon | MultiPolygon, Record<string, string>>;
type Atlas = { counties: Shape[]; towns: Shape[]; taiwan: Shape; countries: Shape[] };

let atlas: Atlas | null = null;
/** Loaded on first use: about 1.5 MB of TopoJSON. */
function load(): Atlas {
  if (atlas) return atlas;
  const read = (file: string, object: string) => {
    const topo = require(file) as Topology;
    return (feature(topo, topo.objects[object] as GeometryCollection) as FeatureCollection<Polygon | MultiPolygon, Record<string, string>>)
      .features;
  };
  const taiwanTopo = require('taiwan-atlas/counties-10t.json') as Topology;
  atlas = {
    counties: read('taiwan-atlas/counties-10t.json', 'counties'),
    towns: read('taiwan-atlas/towns-10t.json', 'towns'),
    taiwan: feature(taiwanTopo, taiwanTopo.objects.nation as GeometryCollection).features[0] as Shape,
    countries: read('world-atlas/countries-50m.json', 'countries'),
  };
  return atlas;
}

// The atlas writes 台; readers write both.
const norm = (s: string) => s.replace(/臺/g, '台').trim();

/**
 * Drops far-off islands so the main land fills the picture: 高雄's 東沙 and
 * 南沙, France's overseas departments. Keeps pieces near the largest one.
 */
export function mainland(f: Shape): Shape {
  if (f.geometry.type !== 'MultiPolygon') return f;
  const parts = f.geometry.coordinates.map((p) => {
    const g: Polygon = { type: 'Polygon', coordinates: p };
    return { p, area: geoArea(g), centre: geoCentroid(g) };
  });
  const big = parts.reduce((a, b) => (b.area > a.area ? b : a));
  // In degrees: 2.5× the largest piece's width, at least 1.5°.
  const reach = Math.max(2.5 * Math.sqrt(big.area) * (180 / Math.PI), 1.5);
  const keep = parts.filter((q) => q.area >= big.area * 0.005 && (geoDistance(q.centre, big.centre) * 180) / Math.PI <= reach);
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: keep.map((q) => q.p) } };
}

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">${body}</svg>`;
const pathOf = (projection: ReturnType<typeof geoMercator>, f: GeoPermissibleObjects, attrs: string) =>
  `<path d="${geoPath(projection)(f) ?? ''}" ${attrs}/>`;
const PAPER = `fill="#fff" stroke="${ORANGE}" stroke-width="2.5" stroke-linejoin="round"`;
const FAINT = `fill="#fff" stroke="${ORANGE}" stroke-width="1.5" stroke-opacity=".45" stroke-linejoin="round"`;
const SOLID = `fill="${ORANGE}" stroke="${ORANGE}" stroke-width="1"`;
// Centred on the place's own longitude, so Russia and Fiji are not cut at 180°.
const fit = (f: GeoPermissibleObjects, pad = 14) =>
  geoMercator()
    .rotate([-geoCentroid(f)[0], 0])
    .fitExtent(
      [
        [pad, pad],
        [SIZE - pad, SIZE - pad],
      ],
      f,
    );
const dot = (projection: ReturnType<typeof geoMercator>, at: [number, number]) => {
  const [x, y] = projection(at) ?? [SIZE / 2, SIZE / 2];
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${ORANGE}" stroke="#fff" stroke-width="2.5"/>`;
};

/** The place on its own, filling the picture. */
export function outline(f: Shape) {
  const m = mainland(f);
  return svg(pathOf(fit(m), m, PAPER));
}

/** The place filled in orange inside a faint outline of `around`. */
function within(around: Shape, f: Shape) {
  const m = mainland(around);
  const p = fit(m, 10);
  return svg(pathOf(p, m, FAINT) + pathOf(p, mainland(f), SOLID));
}

/** A globe turned to `at`, every country faint, the place filled or dotted. */
function globe(at: [number, number], f: Shape | null, point: [number, number] | null) {
  const p = geoOrthographic()
    .rotate([-at[0], -Math.max(-60, Math.min(60, at[1]))])
    .fitExtent(
      [
        [8, 8],
        [SIZE - 8, SIZE - 8],
      ],
      { type: 'Sphere' },
    );
  const land = load()
    .countries.map((c) => pathOf(p, c, `fill="#fff" stroke="${ORANGE}" stroke-width=".5" stroke-opacity=".35"`))
    .join('');
  return svg(
    pathOf(p, { type: 'Sphere' }, `fill="#fff" stroke="${ORANGE}" stroke-width="2"`) +
      land +
      (f ? pathOf(p, f, SOLID) : '') +
      (point ? dot(p, point) : ''),
  );
}

export type Place = { value: string; label: string; image: string; large: string };

const TOWN_SUFFIX = ['鄉', '鎮', '市', '區'];

/**
 * A Taiwan county or city by its name with or without 縣/市 (「台北」, 「高雄市」),
 * or a township by its full name (「員山鄉」). A bare township name (「恆春」,
 * 「信義」) is too often something else, and many repeat across counties.
 */
export function taiwanPlace(tag: string): Place | null {
  const t = norm(tag);
  if (t.length < 2) return null;
  const { counties, towns, taiwan } = load();
  // 「新竹」「嘉義」 are both a county and a city: neither.
  const named = counties.filter((f) => [t, `${t}市`, `${t}縣`].includes(norm(f.properties.COUNTYNAME)));
  const county = named.length === 1 ? named[0] : counties.find((f) => norm(f.properties.COUNTYNAME) === t);
  if (county)
    return {
      value: `tw-county:${county.properties.COUNTYCODE}`,
      label: county.properties.COUNTYNAME,
      image: outline(county),
      large: within(taiwan, county),
    };
  if (!TOWN_SUFFIX.includes(t.slice(-1))) return null;
  const hits = towns.filter((f) => norm(f.properties.TOWNNAME) === t);
  if (hits.length !== 1) return null;
  const [town] = hits;
  const home = counties.find((c) => c.properties.COUNTYNAME === town.properties.COUNTYNAME);
  return {
    value: `tw-town:${town.properties.TOWNCODE}`,
    label: `${town.properties.COUNTYNAME}${town.properties.TOWNNAME}`,
    image: outline(town),
    large: home ? within(home, town) : outline(town),
  };
}

const countryById = (iso: string) => load().countries.find((c) => String(c.id) === iso.padStart(3, '0'));

/** A country by its ISO 3166-1 numeric code (Wikidata P299). */
export function country(iso: string, label: string): Place | null {
  const f = countryById(iso);
  if (!f) return null;
  const m = mainland(f);
  return { value: `country:${f.id}`, label, image: outline(f), large: globe(geoCentroid(m) as [number, number], f, null) };
}

/**
 * A city or other settlement as a dot: inside its country's outline for the
 * small picture, on the globe for the large one. In Taiwan, a dot on the
 * island. `qid` is kept as the value.
 */
export function city(qid: string, label: string, at: [number, number], countryIso: string | null): Place {
  const { taiwan } = load();
  const home = countryIso === '158' ? taiwan : countryIso ? countryById(countryIso) : null;
  const shape = home ? mainland(home) : null;
  const small = shape ? svg(pathOf(fit(shape), shape, PAPER) + dot(fit(shape), at)) : globe(at, null, at);
  return { value: `city:${qid}`, label, image: small, large: countryIso === '158' && shape ? small : globe(at, null, at) };
}
