import { cityByKey } from '@data/airports/index';
import { airportPhotos, isPhotographed, stockPhotos, type PhotographedAirport } from '@data/places';
import type { CityKey } from '@domain/ids';

/**
 * Which photograph stands for a place, and the one way we put one on a card.
 *
 * `data/places.ts` holds the images and deliberately refuses to choose between
 * them: which single photograph best represents a city "is a composition
 * decision, so it is deliberately left to the surface making it". This is that
 * decision — made once, for the three surfaces that share it, rather than three
 * times in three screens that would drift apart by the second edit.
 *
 * It sits at the screens root because it belongs to no single screen area, and
 * it could not live in `design/` in any case: design/ may not import `@data`,
 * which is the boundary that keeps the design system swappable. The screen layer
 * owning the choice is also simply correct — a photograph is composition.
 *
 * Two tables rather than one, because a surface is asking one of two different
 * questions:
 *
 *   CITY_SHOT — "where is this trip going?" The place you walk out into.
 *   PORT_SHOT — "which port is this?" The airport itself.
 *
 * Keeping them apart is what stops the Trips screen printing the same frame
 * twice: the SIN trip block gets the Jewel's waterfall, the SIN port card gets
 * its station hall.
 */

export interface PlacePhoto {
  src: string;
  /**
   * What is actually in the frame.
   *
   * Carried with every photograph so a surface can use it as `alt` when the
   * image is doing identifying work — see `describe` on `PlaceBand`. Written
   * as a description of the picture, not as a restatement of the card, because
   * that is the only thing an alt attribute can honestly be.
   */
  caption: string;
}

/** The city, for the surface that is telling you where you are going. */
const CITY_SHOT: Record<PhotographedAirport, PlacePhoto> = {
  OSL: { src: airportPhotos.OSL.operaHouse, caption: 'The opera house in Oslo, from the water' },
  LHR: { src: airportPhotos.LHR.towerBridgeDusk, caption: 'Tower Bridge in London at dusk' },
  CPH: { src: airportPhotos.CPH.nyhavn, caption: 'The coloured houses along Nyhavn in Copenhagen' },
  // Marina Bay would be the obvious Singapore frame and it is the one we cannot
  // use here: that file is a 640×960 portrait, and a wide band crops it to a
  // quarter of itself. The Jewel is Changi rather than the city, which is a
  // real concession — it is also unmistakable, which is the whole job.
  SIN: { src: airportPhotos.SIN.jewelWaterfall, caption: 'The waterfall inside the Jewel at Changi, Singapore' },
  // Not Paris. The photography we hold for CDG is Fontainebleau, which is where
  // the INSEAD cohort is actually going when they land there.
  CDG: { src: airportPhotos.CDG.fontainebleauChateau, caption: 'The château at Fontainebleau, south of Paris' },
};

/** The port, for the surface that is telling you which building you are in. */
const PORT_SHOT: Record<PhotographedAirport, PlacePhoto> = {
  OSL: { src: airportPhotos.OSL.apronSnow, caption: 'Snow on the apron at Oslo Gardermoen' },
  LHR: { src: airportPhotos.LHR.terminal2Entrance, caption: 'The Terminal 2 entrance at Heathrow' },
  CPH: { src: airportPhotos.CPH.terminalExterior, caption: 'The terminal building at Copenhagen Kastrup' },
  SIN: { src: airportPhotos.SIN.jewelStation, caption: 'The station hall under the Jewel at Changi' },
  CDG: { src: airportPhotos.CDG.terminal2eWalkway, caption: 'The Terminal 2E walkway at Charles de Gaulle' },
};

/**
 * Atmosphere, for the roughly 3,265 airports that have no photography at all.
 *
 * Landscape frames only. These are shown as wide bands, and the tall stock
 * shots — the concourse is 640×1138 — survive that crop as an unreadable strip
 * out of the middle.
 *
 * Nothing in here names a city, so nothing in here can be wrong about one.
 * That is the trade: a card for an airport we have never photographed gets mood
 * instead of information, and the code and city name beside it do the
 * identifying.
 */
const ATMOSPHERE: PlacePhoto[] = [
  { src: stockPhotos.apronBlueHour, caption: 'An airport apron at blue hour' },
  { src: stockPhotos.gateDusk, caption: 'A departure gate at dusk' },
  { src: stockPhotos.jetbridge, caption: 'A jetbridge reaching an aircraft door' },
  { src: stockPhotos.wayfinding, caption: 'Overhead wayfinding signs in a terminal' },
  { src: stockPhotos.baggageCarousel, caption: 'Bags coming round a carousel' },
];

/**
 * The atmosphere shot for a seed — an airport code, usually.
 *
 * Deterministic on purpose, twice over: the same airport then looks the same
 * every time you open the app, which is a small piece of recognition rather
 * than a lottery, and the screenshots in `docs/shots` stay comparable between
 * runs. A random pick would cost both and buy nothing.
 */
export function atmosphere(seed: string): PlacePhoto {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 9973;
  return ATMOSPHERE[h % ATMOSPHERE.length]!;
}

/** Where a trip is going. Always answers — atmosphere when the airport is unphotographed. */
export function destinationPhoto(iata: string): PlacePhoto {
  return isPhotographed(iata) ? CITY_SHOT[iata] : atmosphere(iata);
}

/** One port on the rail. Always answers, on the same terms. */
export function portPhoto(iata: string): PlacePhoto {
  return isPhotographed(iata) ? PORT_SHOT[iata] : atmosphere(iata);
}

/**
 * A city, by key — for a venue, or for a trip that is a stay with no flights.
 *
 * Returns `undefined` rather than falling back, and that is the point: a
 * conference card earns a photograph by being somewhere we can actually show,
 * and an atmosphere shot on a card whose whole subject is *which place this is*
 * would be decoration. The caller leaves the card text-only instead.
 *
 * A city is matched through its airports, because that is the only bridge the
 * data gives us between a `CityKey` and photography filed under IATA codes.
 */
export function cityPhoto(cityKey: string): PlacePhoto | undefined {
  const codes = cityByKey(cityKey as CityKey)?.airports ?? [];
  const photographed = codes.map(String).find(isPhotographed);
  return photographed ? CITY_SHOT[photographed] : undefined;
}

/**
 * A photograph across the top of a card.
 *
 * One component, so the treatment stays one thing: the wrapper carries the crop
 * and the gradient down into the card's own background, the image carries the
 * `saturate(0.85)` that pulls 37 different cameras back towards this app's four
 * hues, and no text is ever laid over it. That last part is not laziness — it
 * is what lets a new photograph land without a per-image contrast audit in two
 * themes. See `.placeband` in `design/tokens/screens.css`.
 *
 * `describe` decides whether the photograph is information or decoration, and
 * the answer belongs to the surface rather than to the image. On a trip block
 * the destination is spelled out in the timeline directly underneath, so a
 * caption read aloud is noise; on an event card it is the only place the
 * venue's city is named at all.
 */
export function PlaceBand({
  photo,
  className,
  describe = false,
}: {
  photo: PlacePhoto;
  className: string;
  describe?: boolean;
}) {
  return (
    <div className={`placeband ${className}`}>
      <img
        src={photo.src}
        alt={describe ? photo.caption : ''}
        aria-hidden={describe ? undefined : true}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

/**
 * The band on an event card, when its venue is somewhere we can show.
 *
 * Both the board and home render the same event card, so this lives here with
 * the choice rather than being written twice and drifting. It takes the venue
 * and not the circle: which photograph stands for a city is this module's
 * business, and a `Circle` is not.
 *
 * Renders nothing when the city has no photography — see `cityPhoto`.
 */
export function VenueBand({ venue }: { venue?: { cityKey: CityKey } }) {
  const photo = venue ? cityPhoto(String(venue.cityKey)) : undefined;
  if (!photo) return null;
  return <PlaceBand photo={photo} className="eventboard__photo" describe />;
}
