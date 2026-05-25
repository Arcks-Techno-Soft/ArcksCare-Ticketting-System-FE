"use client";

/**
 * AddressMap - read-only Leaflet map with two opt-in ways for the customer
 * to pick a location:
 *   1. Search box (Nominatim autocomplete, India-scoped)
 *   2. "Use my current location" button (browser geolocation + reverse geocode)
 *
 * The map itself is non-interactive on purpose — the customer can't tap or
 * drag the marker because in real use we saw mis-taps change the address. To
 * adjust the pin they re-search or re-locate.
 */
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Default Leaflet markers reference assets on a CDN that don't ship with
// react-leaflet. Wire them up explicitly so the marker icon actually shows.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type ParsedAddress = {
  line1?: string;
  line2?: string;
  line3?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export type LocationPayload = {
  lat: number;
  lng: number;
  address: ParsedAddress;
  display_name: string;
};

type Props = {
  /** Initial map centre (default: India centroid) */
  initial?: { lat: number; lng: number };
  /** Fires whenever the user moves the pin or chooses a search result */
  onLocationChange: (loc: LocationPayload) => void;
};

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India

export default function AddressMap({ initial, onLocationChange }: Props) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    initial ?? null
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Forward search (debounced) -------------------------------------
  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchNominatim(query);
        setResults(r);
        setOpen(true);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ---- Reverse geocode + bubble up ------------------------------------
  const handlePick = async (lat: number, lng: number, knownDisplay?: string, knownAddress?: ParsedAddress) => {
    setPosition({ lat, lng });
    let address: ParsedAddress = knownAddress ?? {};
    let display = knownDisplay ?? "";
    if (!knownAddress) {
      const reversed = await reverseGeocode(lat, lng);
      if (reversed) {
        address = parseNominatimAddress(reversed);
        display = reversed.display_name;
      }
    }
    onLocationChange({ lat, lng, address, display_name: display });
  };

  // ---- Use my current location ----------------------------------------
  const handleUseCurrentLocation = () => {
    setLocateError(null);
    if (!("geolocation" in navigator)) {
      setLocateError("Your browser doesn't support location services.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await handlePick(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        // Common: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
        if (err.code === 1) {
          setLocateError("Location permission denied. You can search a place instead.");
        } else if (err.code === 3) {
          setLocateError("Couldn't get your location in time. Try searching instead.");
        } else {
          setLocateError("Couldn't determine your location. Try searching instead.");
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  return (
    <div className="space-y-3">
      {/* Search input + use-my-location button ----------------------- */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* Search input with results dropdown positioned beneath it */}
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
            width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search a place, area or pincode…"
            className="w-full rounded-xl2 border border-line bg-white pl-10 pr-10 py-3 text-[14px]
                       text-ink placeholder:text-ink-subtle transition-all
                       hover:border-line-strong focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
          />
          {searching && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-ink/15 border-t-ink" />
          )}

          {open && results.length > 0 && (
            <ul
              className="absolute z-[1000] mt-1.5 w-full overflow-hidden rounded-xl2 border border-line bg-white shadow-lift"
              role="listbox"
            >
              {results.slice(0, 6).map((r) => (
                <li key={r.place_id}>
                  <button
                    type="button"
                    className="block w-full px-4 py-3 text-left text-[13.5px] text-ink hover:bg-surface-raised"
                    onClick={() => {
                      setQuery(r.display_name.split(",").slice(0, 2).join(", "));
                      setOpen(false);
                      handlePick(
                        parseFloat(r.lat),
                        parseFloat(r.lon),
                        r.display_name,
                        parseNominatimAddress(r as NominatimReverseResult)
                      );
                    }}
                  >
                    <span className="block text-ink">
                      {r.display_name.split(",").slice(0, 2).join(", ")}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink-subtle">
                      {r.display_name.split(",").slice(2).join(",").trim()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl2 border border-line
                     bg-white px-4 py-3 text-[13px] text-ink transition-colors
                     hover:border-ink hover:bg-surface-raised disabled:opacity-50"
        >
          {locating ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
          {locating ? "Locating…" : "Use my current location"}
        </button>
      </div>

      {locateError && (
        <p className="-mt-1 text-[12px] text-accent-danger">{locateError}</p>
      )}

      {/* Map (read-only preview, no click/drag) ------------------------- */}
      <div className="relative overflow-hidden rounded-xl2 border border-line shadow-soft">
        <MapContainer
          center={[position?.lat ?? DEFAULT_CENTER.lat, position?.lng ?? DEFAULT_CENTER.lng]}
          zoom={position ? 15 : 5}
          // Disable every form of interaction so accidental taps can't change the address.
          dragging={false}
          touchZoom={false}
          doubleClickZoom={false}
          scrollWheelZoom={false}
          boxZoom={false}
          keyboard={false}
          zoomControl={false}
          style={{ height: 280, width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter position={position} />
          {position && (
            <Marker
              icon={markerIcon}
              position={[position.lat, position.lng]}
              interactive={false}
            />
          )}
        </MapContainer>

        {!position && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
            <p className="rounded-md bg-white/90 px-3 py-1.5 text-[12.5px] text-ink-muted shadow-soft">
              Search a place or tap “Use my current location” to drop the pin.
            </p>
          </div>
        )}
      </div>

      <p className="text-[12px] leading-relaxed text-ink-subtle">
        The pin updates only when you search a place or use your current location.
        We&apos;ll auto-fill the address fields above each time.
      </p>
    </div>
  );
}

/* ----------------------- Map helper components -------------------------- */

// Note: a previous version supported click-to-drop-pin via useMapEvents. We
// removed it intentionally so accidental taps can't change a customer's address.

function Recenter({ position }: { position: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
  }, [position, map]);
  return null;
}

/* ------------------------- Nominatim API helpers ------------------------ */

type NominatimSearchResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddressBlock;
};

type NominatimReverseResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddressBlock;
};

type NominatimAddressBlock = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  village?: string;
  town?: string;
  city?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
  amenity?: string;
  shop?: string;
  building?: string;
};

async function searchNominatim(q: string): Promise<NominatimSearchResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "in");
  try {
    const res = await fetch(url.toString(), {
      headers: { "Accept-Language": "en", Accept: "application/json" },
    });
    if (!res.ok) return [];
    return (await res.json()) as NominatimSearchResult[];
  } catch {
    return [];
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<NominatimReverseResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  try {
    const res = await fetch(url.toString(), {
      headers: { "Accept-Language": "en", Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as NominatimReverseResult;
  } catch {
    return null;
  }
}

function parseNominatimAddress(r: NominatimReverseResult | NominatimSearchResult): ParsedAddress {
  const a = r.address ?? {};
  // Line 1: prefer the most specific thing - building/shop/amenity then road
  const line1Parts = [a.house_number, a.amenity ?? a.shop ?? a.building, a.road].filter(Boolean);
  const line1 = line1Parts.join(", ");
  const line2 = a.neighbourhood ?? a.suburb ?? a.city_district ?? "";
  // Line 3: anything from display_name not already captured (a useful fallback)
  const line3 = a.county ?? a.state_district ?? "";
  const city = a.city ?? a.town ?? a.village ?? a.county ?? "";
  const state = a.state ?? "";
  const pincode = a.postcode ?? "";

  return {
    line1: line1 || undefined,
    line2: line2 || undefined,
    line3: line3 || undefined,
    city: city || undefined,
    state: state || undefined,
    pincode: pincode || undefined,
  };
}
