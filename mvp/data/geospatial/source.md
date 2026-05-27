# Geospatial Data Sources

This folder stores local geospatial JSON files used by the planet renderer.

## Files

- `earth-land.geojson`
  - Source: Natural Earth `ne_110m_land.geojson`
  - URL: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
  - License: Public Domain (Natural Earth)

- `moon-maria.geojson`
  - Source dataset: LROC Global Mare boundaries (`LROC_GLOBAL_MARE_180.ZIP`)
  - URL: https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/SHAPEFILE/LROC_GLOBAL_MARE/LROC_GLOBAL_MARE_180.ZIP
  - Produced by: converting the official shapefile ZIP to GeoJSON with `shpjs`
  - Notes: includes real lunar mare polygons in the -180 to 180 longitude domain
