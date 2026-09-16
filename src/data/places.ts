/**
 * Photographs of places — airports, and the cities they are the way into.
 *
 * Ported from the Expo prototype's `src/data/photos.ts`, key names kept
 * identical so screen code moves across without a rename. The images themselves
 * are byte-identical copies; where they came from is a separate and less
 * comfortable question, answered honestly in `assets/places/PROVENANCE.md`. Read
 * that before putting any of them on a public deploy.
 *
 * The native version exists because Metro cannot resolve a `require()` built
 * from a variable. This one exists for a different reason with the same shape:
 * Vite only fingerprints an asset and rewrites its URL when the import is
 * statically analysable. A path assembled at runtime — `` `/places/${code}.jpg` ``
 * — would skip the asset pipeline entirely and then 404 on the GitHub Pages
 * deploy, which serves from `/Wingman/` rather than the domain root. So the
 * literal imports are not boilerplate; they are what makes the deploy work.
 *
 * Importing all 37 eagerly costs almost nothing. Each import resolves to a URL
 * string of a few dozen bytes, not the image bytes — the browser fetches a
 * photograph only when something actually renders it. There is no lazy variant
 * worth the complexity here.
 *
 * Two trees, kept split on purpose:
 *   assets/places/stock/            — atmosphere, not tied to a named airport,
 *                                     reusable in any city
 *   assets/places/airports/<CODE>/  — that airport's own photography, plus its
 *                                     destination city where the two are one
 *                                     trip (CPH → Nyhavn, CDG → Fontainebleau)
 *
 * Adding a city is one folder and one block below, nothing else.
 */

import cdgFontainebleauChateau from '@assets/places/airports/CDG/fontainebleau-chateau.jpg';
import cdgFontainebleauForestRoad from '@assets/places/airports/CDG/fontainebleau-forest-road.jpg';
import cdgTerminal2eWalkway from '@assets/places/airports/CDG/terminal-2e-walkway.jpg';
import cphCafeInRain from '@assets/places/airports/CPH/cafe-in-rain.jpg';
import cphNyhavn from '@assets/places/airports/CPH/nyhavn.jpg';
import cphTerminalExterior from '@assets/places/airports/CPH/terminal-exterior.jpg';
import cphTerminalInterior from '@assets/places/airports/CPH/terminal-interior.jpg';
import lhrCitySkylineDawn from '@assets/places/airports/LHR/city-skyline-dawn.jpg';
import lhrCitySkylineNight from '@assets/places/airports/LHR/city-skyline-night.jpg';
import lhrEscalator from '@assets/places/airports/LHR/escalator.jpg';
import lhrTerminal2Entrance from '@assets/places/airports/LHR/terminal-2-entrance.jpg';
import lhrTowerBridgeDusk from '@assets/places/airports/LHR/tower-bridge-dusk.jpg';
import oslApronSnow from '@assets/places/airports/OSL/apron-snow.jpg';
import oslCitySunset from '@assets/places/airports/OSL/city-sunset.jpg';
import oslOperaHouse from '@assets/places/airports/OSL/opera-house.jpg';
import oslPier from '@assets/places/airports/OSL/pier.jpg';
import oslStreetCrosswalk from '@assets/places/airports/OSL/street-crosswalk.jpg';
import sinJewelStation from '@assets/places/airports/SIN/jewel-station.jpg';
import sinJewelWaterfall from '@assets/places/airports/SIN/jewel-waterfall.jpg';
import sinMarinaBaySkyline from '@assets/places/airports/SIN/marina-bay-skyline.jpg';
import stockApronBlueHour from '@assets/places/stock/apron-blue-hour.jpg';
import stockBaggageCarousel from '@assets/places/stock/baggage-carousel.jpg';
import stockBlackCabDaytime from '@assets/places/stock/black-cab-daytime.jpg';
import stockBlackCabNight from '@assets/places/stock/black-cab-night.jpg';
import stockCloudsWindow from '@assets/places/stock/clouds-window.jpg';
import stockConcourse from '@assets/places/stock/concourse.jpg';
import stockDepartureBoard from '@assets/places/stock/departure-board.jpg';
import stockGateDusk from '@assets/places/stock/gate-dusk.jpg';
import stockJetbridge from '@assets/places/stock/jetbridge.jpg';
import stockLounge from '@assets/places/stock/lounge.jpg';
import stockPassports from '@assets/places/stock/passports.jpg';
import stockRainOnGlass from '@assets/places/stock/rain-on-glass.jpg';
import stockRunway from '@assets/places/stock/runway.jpg';
import stockTaxiNight from '@assets/places/stock/taxi-night.jpg';
import stockTerminalClock from '@assets/places/stock/terminal-clock.jpg';
import stockWayfinding from '@assets/places/stock/wayfinding.jpg';
import stockWindowWarmLight from '@assets/places/stock/window-warm-light.jpg';

/** Atmosphere. Nothing here names a city, so all of it travels. */
export const stockPhotos = {
  concourse: stockConcourse,
  cloudsWindow: stockCloudsWindow,
  windowWarmLight: stockWindowWarmLight,
  taxiNight: stockTaxiNight,
  passports: stockPassports,
  runway: stockRunway,
  departureBoard: stockDepartureBoard,
  lounge: stockLounge,
  baggageCarousel: stockBaggageCarousel,
  rainOnGlass: stockRainOnGlass,
  wayfinding: stockWayfinding,
  jetbridge: stockJetbridge,
  apronBlueHour: stockApronBlueHour,
  terminalClock: stockTerminalClock,
  gateDusk: stockGateDusk,
  blackCabDaytime: stockBlackCabDaytime,
  blackCabNight: stockBlackCabNight,
} as const;

/** One block per IATA code. The airport, and the city it lets you into. */
export const airportPhotos = {
  OSL: {
    apronSnow: oslApronSnow,
    operaHouse: oslOperaHouse,
    citySunset: oslCitySunset,
    pier: oslPier,
    streetCrosswalk: oslStreetCrosswalk,
  },
  LHR: {
    terminal2Entrance: lhrTerminal2Entrance,
    escalator: lhrEscalator,
    towerBridgeDusk: lhrTowerBridgeDusk,
    citySkylineNight: lhrCitySkylineNight,
    citySkylineDawn: lhrCitySkylineDawn,
  },
  CPH: {
    terminalExterior: cphTerminalExterior,
    terminalInterior: cphTerminalInterior,
    nyhavn: cphNyhavn,
    cafeInRain: cphCafeInRain,
  },
  SIN: {
    jewelWaterfall: sinJewelWaterfall,
    jewelStation: sinJewelStation,
    marinaBaySkyline: sinMarinaBaySkyline,
  },
  CDG: {
    terminal2eWalkway: cdgTerminal2eWalkway,
    fontainebleauChateau: cdgFontainebleauChateau,
    fontainebleauForestRoad: cdgFontainebleauForestRoad,
  },
} as const;

/**
 * The airports that have photography — five of them.
 *
 * Named for what it is rather than `AirportCode`, which is what the native
 * repo called it. In a codebase whose airport index holds several thousand
 * entries, a type called `AirportCode` that admits exactly five of them invites
 * someone to use it as the general one. `IataCode` in `@domain/ids` is the
 * general one.
 */
export type PhotographedAirport = keyof typeof airportPhotos;

/** The photographs for one airport. A union — each city has its own keys. */
export type PlacePhotoSet = (typeof airportPhotos)[PhotographedAirport];

/** Whether this airport has photography. Narrows, so the lookup needs no cast. */
export function isPhotographed(iata: string): iata is PhotographedAirport {
  return Object.prototype.hasOwnProperty.call(airportPhotos, iata);
}

/**
 * The photographs for a runtime airport code.
 *
 * Returns `undefined` rather than throwing, and `undefined` is the ordinary
 * answer: almost every airport in the index has no photography, and a trip to
 * one of them is a normal trip, not an error. Callers fall back to a stock shot
 * or to no image at all. Same contract as `photoFor` in `seed/photos.ts`.
 *
 * Which single photograph best represents a city on a trip row is a composition
 * decision, so it is deliberately left to the surface making it rather than
 * frozen into a `heroFor()` here.
 */
export function placePhotosFor(iata: string): PlacePhotoSet | undefined {
  return isPhotographed(iata) ? airportPhotos[iata] : undefined;
}
