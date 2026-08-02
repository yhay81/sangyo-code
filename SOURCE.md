# Source and transformation

## Official source

- Service: 政府統計の総合窓口 e-Stat
- Classification: 日本標準産業分類（令和5年［2023年］7月改定）
- Source page: <https://www.e-stat.go.jp/classifications/terms/10>
- Revision code: `04`
- Retrieved: 2026-08-02 JST
- Download format: e-Statの検索結果ダウンロード（UTF-8 CSV）
- CSV size: 519,299 bytes
- SHA-256: `7b96fe5dee3c8da38d516a08041c605be7407492e3ee754bc39d7aa3f46f0fe3`

The exact download URL and request parameters are retained in `scripts/build-data.mjs` and generated data metadata.

## Dimensions

The official interface reports 2,129 results. The downloaded CSV contains one code-less advisory row followed by 2,128 non-empty, unique classification codes:

| Level       | Code form |  Rows |
| ----------- | --------- | ----: |
| 大分類      | A–T       |    20 |
| 中分類      | 2 digits  |    99 |
| 小分類      | 3 digits  |   536 |
| 細分類      | 4 digits  | 1,473 |
| Total codes |           | 2,128 |

## Transformation / 加工

`scripts/build-data.mjs`:

1. downloads the public CSV from e-Stat;
2. verifies HTTP success, title, columns, byte-level SHA-256, row dimensions, uniqueness, and every parent reference;
3. removes the code-less search advisory row;
4. normalizes line endings and trailing whitespace without summarizing the official name or description;
5. derives parent code, hierarchy level, and major category from official order and code structure;
6. emits one static UTF-8 JSON file for client-side search.

The product does not use the registered e-Stat API and does not continuously scrape detail pages. Examples and non-matching examples that are available on each official detail page are linked, not copied into the local dataset.

## Terms and limitations

Content is reused under the [e-Stat terms of use](https://www.e-stat.go.jp/terms-of-use), which permit commercial reuse of covered content subject to attribution and other stated conditions. The product says that it is based on and processed from e-Stat data and does not use the e-Stat logo.

Keyword matches are candidates, not a classification decision. The Japanese Standard Industrial Classification classifies establishments by their principal economic activity and does not necessarily enumerate every activity. Users should review the official description, examples, non-matching examples, and the receiving authority's instructions before submitting a code.
