# Vacant to Vibrant — SF Property Intelligence

A property research tool for the Vacant to Vibrant team. Enter any San Francisco address to surface:

- **Vacancy status** — from SF Commercial Vacancy Tax filings
- **Owner entity** — who filed as owner, with contact lookup links
- **Business history** — every business ever registered at the address, grouped by suite
- **Ground floor detection** — highlights likely retail/ground floor units
- **Property details** — building size, year built, APN, floors, lot size

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up your ATTOM API key
cp .env.example .env
# Edit .env and paste your ATTOM API key

# 3. Start both servers (two terminal tabs)
# Terminal 1:
node server.cjs

# Terminal 2:
npm run dev
```

## File Structure

```
src/
  App.jsx                  # Root: navigation, state, notes/tags/meta
  index.css                # All styles
  pages/
    Dashboard.jsx          # Search + results grid
    PropertyDetail.jsx     # Full property report + outreach tracker
    History.jsx            # Property tracker with tag/status filters
    MapView.jsx            # Map of all tracked properties
    BulkImport.jsx         # Paste multiple addresses for batch lookup
  components/
    AddressSearch.jsx      # Address input with autocomplete dropdown
    PropertyCard.jsx       # Card in the grid (shows tags + notes)
    ExportButton.jsx       # CSV export (includes notes, tags, overrides)

server.cjs                 # Express proxy for ATTOM + SF Open Data APIs
```

## Data Sources

| Data | Source | Cost |
|---|---|---|
| Vacancy status | SF Commercial Vacancy Tax (rzkk-54yv) | Free |
| Owner entity | SF Commercial Vacancy Tax | Free |
| Business history | SF Registered Business Locations (g8m3-pdis) | Free |
| Property details | ATTOM API | Paid (your key) |
| Geocoding | OpenStreetMap Nominatim | Free |

## Features

- **Address autocomplete** — dropdown suggestions as you type
- **Suite-level business history** — grouped by unit, ground floor tagged
- **Outreach Tracker** — notes, status tags, vacancy override per property
- **Map view** — all tracked properties on an interactive SF map
- **Bulk import** — paste up to 50 addresses for batch lookup
- **Persistent sessions** — searched properties survive browser refresh
- **CSV export** — includes notes, tags, and vacancy overrides
