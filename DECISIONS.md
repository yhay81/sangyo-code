# Product decisions

## Scope

- Replace the narrow job of finding and carrying out current Japanese Standard Industrial Classification codes.
- Search official code, name, and description locally; show the complete four-level path.
- Link to e-Stat for examples and non-matching examples instead of presenting keyword matching as a final decision.
- Save at most eight public classifications in local storage for comparison and batch copy.

## Boundaries

- No accounts, uploads, community content, messaging, payments, or advertising.
- No e-Stat API application ID is required; the release uses a verified public CSV snapshot.
- No search query, selected code, classification name, or described business activity enters telemetry.
- No claim that the product is an official classifier or that e-Stat endorses it.

## Design

The interface is organized as an industrial town: farms, factory, shop, route, communications, and care buildings lead into a four-step classification rail and paper classification cards. Typography stays secondary to the map, hierarchy, codes, cards, and carry-out tray. CSS uses flat color, borders, and physical forms without decorative gradients.

## Authentication

Better Auth is intentionally omitted. The service handles public reference data and needs neither identity nor cross-device synchronization.
