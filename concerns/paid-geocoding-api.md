---
name: paid-geocoding-api
domain: integration
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/services/maps/**"
    - "**/services/location/**"
    - "**/functions/*geocode*/**"
    - "**/functions/*nearby*/**"
    - "**/functions/*address*/**"
  diff_keywords:
    - "places\.googleapis"
    - "mapbox\.com"
    - "maps\.googleapis"
    - "searchNearby"
    - "reverseGeocode"
    - "autocomplete"
  packages_imported:
    - "@googlemaps/*"
    - "mapbox-gl"
    - "@mapbox/*"
  env_vars_referenced:
    - "GOOGLE_MAPS_*"
    - "GOOGLE_PLACES_*"
    - "MAPBOX_*"

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["manage-finops"]

waiver_format: |
  PR body line: "concern-waived: paid-geocoding-api — <reason>"

fires_on:
  - first-introduction
  - bugfix-touching-call-shape
  - new-caller
  - refactor

fires_off:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
  - "**/docs/**"

related_concerns:
  - paid-external-api
  - cache-strategy-symmetry
---

# paid-geocoding-api

Per-call billing with a 50km radius cap and per-SKU pricing. Over-fetch + cache is the canonical optimization. Caught Example Marketplace asymmetric cache 2026-05-07.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
