export type ResolvedBirthPlace = {
  status: "resolved";
  placeName: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string;
};

export type UnresolvedBirthPlace = {
  status: "needs_geocoding";
  placeName: string;
};

export type BirthPlaceResolution = ResolvedBirthPlace | UnresolvedBirthPlace;

const LOCAL_PLACE_FIXTURES: Record<string, ResolvedBirthPlace> = {
  "hong kong": {
    status: "resolved",
    placeName: "Hong Kong",
    countryCode: "HK",
    lat: 22.3193,
    lng: 114.1694,
    timezone: "Asia/Hong_Kong"
  },
  "london, uk": {
    status: "resolved",
    placeName: "London, UK",
    countryCode: "GB",
    lat: 51.5072,
    lng: -0.1276,
    timezone: "Europe/London"
  },
  "new york, us": {
    status: "resolved",
    placeName: "New York, US",
    countryCode: "US",
    lat: 40.7128,
    lng: -74.006,
    timezone: "America/New_York"
  }
};

export function resolveBirthPlace(input: string): BirthPlaceResolution {
  const placeName = input.trim().replace(/\s+/g, " ");
  const fixture = LOCAL_PLACE_FIXTURES[placeName.toLowerCase()];

  if (fixture) {
    return fixture;
  }

  return {
    status: "needs_geocoding",
    placeName
  };
}
