"use client";

/**
 * AddressMap - interactive Leaflet map with location search and pin drop.
 *
 *  - Free: uses OpenStreetMap tiles + Nominatim forward/reverse geocoding
 *  - When the user clicks the map or picks a search result, the marker moves
 *    and `onLocationChange` fires with lat/lng + a parsed address payload
 *    that the parent form uses to autofill its address fields.
 *  - Nominatim usage policy: <=1 req/sec, identifying User-Agent. We debounce
 *    the search input and identify ourselves with an Accept-Language header.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
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

  return (
    <div className="space-y-3">
      {/* Search input -------------------------------------------------- */}
      <div className="relative">
        <div className="relative">
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
        </div>

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

      {/* Map ----------------------------------------------------------- */}
      <div className="overflow-hidden rounded-xl2 border border-line shadow-soft">
        <MapContainer
          center={[position?.lat ?? DEFAULT_CENTER.lat, position?.lng ?? DEFAULT_CENTER.lng]}
          zoom={position ? 15 : 5}
          scrollWheelZoom
          style={{ height: 280, width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPick={(lat, lng) => handlePick(lat, lng)} />
          <Recenter position={position} />
          {position && (
            <Marker
              draggable
              icon={markerIcon}
              position={[position.lat, position.lng]}
              eventHandlers={{
                dragend: (e) => {
                  const ll = e.target.getLatLng();
                  handlePick(ll.lat, ll.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-subtle">
        Click anywhere on the map to drop a pin, or drag the existing pin to fine-tune the location.
        We&apos;ll auto-fill the address fields above when you do.
      </p>
    </div>
  );
}

/* ----------------------- Map helper components -------------------------- */

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

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
