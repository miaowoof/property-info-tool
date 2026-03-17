import { useState, useRef, useEffect } from "react";

export default function AddressSearch({ onSearch, loading }) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch suggestions as user types
  useEffect(() => {
    if (value.trim().length < 4) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSuggesting(true);
      try {
        const query = encodeURIComponent(value + ", San Francisco, CA");
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=8&addressdetails=1&countrycodes=us`,
          { headers: { "User-Agent": "VacantToVibrant/1.0" } }
        );
        const data = await res.json();

        // Filter to SF results and format them nicely
        const sfResults = data
          .filter(r => {
            const addr = r.address || {};
            const city = (addr.city || addr.town || addr.village || "").toLowerCase();
            return city.includes("san francisco") || r.display_name.toLowerCase().includes("san francisco");
          })
          .map(r => {
            const addr = r.address || {};
            // Build a clean display address
            const parts = [
              addr.house_number,
              addr.road,
              addr.unit || addr.level || null,
            ].filter(Boolean);
            const street = parts.join(" ");
            const zip = addr.postcode || "";
            const display = street
              ? `${street}${zip ? ", SF " + zip : ", San Francisco"}`
              : r.display_name.split(",").slice(0, 2).join(",").trim();

            return {
              display,
              full: r.display_name,
              lat: parseFloat(r.lat),
              lon: parseFloat(r.lon),
              type: r.type,
              class: r.class,
              address: addr,
            };
          })
          // Dedupe by display string
          .filter((r, i, arr) => arr.findIndex(x => x.display === r.display) === i)
          // Prefer building/address results over POIs
          .sort((a, b) => {
            const aScore = a.class === "building" || a.type === "house" ? 1 : 0;
            const bScore = b.class === "building" || b.type === "house" ? 1 : 0;
            return bScore - aScore;
          })
          .slice(0, 6);

        setSuggestions(sfResults);
        setShowSuggestions(sfResults.length > 0);
        setHighlighted(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggesting(false);
      }
    }, 350);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectSuggestion = (suggestion) => {
    setValue(suggestion.display);
    setShowSuggestions(false);
    setSuggestions([]);
    onSearch(suggestion.display);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, -1));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlighted(-1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (highlighted >= 0 && showSuggestions) {
      selectSuggestion(suggestions[highlighted]);
    } else if (value.trim()) {
      setShowSuggestions(false);
      onSearch(value.trim());
    }
  };

  return (
    <div ref={containerRef} className="search-wrapper">
      <form className="search-form" onSubmit={handleSubmit}>
        <div className={`search-box ${showSuggestions ? "suggestions-open" : ""}`}>
          <span className="search-pin">⌖</span>
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); }}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Enter a San Francisco address…"
            disabled={loading}
            autoFocus
            autoComplete="off"
          />
          {suggesting && <span className="search-spinner" />}
          <button className="search-btn" type="submit" disabled={loading || !value.trim()}>
            {loading ? <span className="spinner" /> : "Look Up →"}
          </button>
        </div>
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <div className="suggestions-dropdown">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className={`suggestion-item ${highlighted === i ? "highlighted" : ""}`}
              onMouseDown={() => selectSuggestion(s)}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="suggestion-pin">◎</span>
              <div className="suggestion-text">
                <span className="suggestion-main">{s.display}</span>
                {s.type && s.type !== "house" && (
                  <span className="suggestion-type">{s.type}</span>
                )}
              </div>
            </div>
          ))}
          <div className="suggestion-footer">↑↓ to navigate · Enter to select · Esc to close</div>
        </div>
      )}
    </div>
  );
}
