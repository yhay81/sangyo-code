# Security

## Reporting

Open a private security advisory on GitHub for vulnerabilities. Do not include personal data or credentials in a public issue.

## Controls

- CSP allows scripts, styles, images, and API calls only from the same origin.
- The telemetry endpoint accepts only JSON, enforces a small body limit, validates an event allowlist, and rejects cross-origin requests.
- Official CSV text is assigned through DOM `textContent`; it is never interpreted as HTML or code.
- External official links use fixed HTTPS origins, escaped codes, and `noopener noreferrer`.
- D1 telemetry rows expire after 35 days through a scheduled cleanup.
- Cloudflare assets contain public reference data only; there are no secrets in the repository or client bundle.
