# Map tile Referer correction

The global no-referrer response policy suppressed identification required by OpenStreetMap. Leaflet now sets referrerPolicy: origin on tile images only, identifying the site without paths or query parameters. The global OAuth policy stays no-referrer. Attribution and normal browser caching are preserved; no proxy, provider switch or bulk downloading.

Policy: https://operations.osmfoundation.org/policies/tiles/

Validation: all 116 Angular tests and production build pass. Real Chrome on the existing deployment loaded all 18 visible tiles with HTTP 200, zero 403, and origin-only Referer. Both frontend replicas became Ready. Previous image is retained for rollback. No AWS infrastructure, database, credential or plan changes.

Three communities have no coordinates, so their locations are not invented. Main still requires the team integration review described in MAIN-INTEGRATION-REVIEW.md.
