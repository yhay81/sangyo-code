# 産業分類引き

事業内容、分類名、コードから、日本標準産業分類の大分類・中分類・小分類・細分類をたどる匿名Webサービスです。

- Production: <https://sangyo-code.yhay81.com>
- Source: e-Stat「日本標準産業分類（令和5年［2023年］7月改定）」
- Dataset: 2,128 codes (20 major / 99 division / 536 group / 1,473 detail)
- Stack: Cloudflare Workers, Hono JSX, Vite+, D1, static JSON

## Local development

```powershell
npm install
npm run data:build
npm run release:check
npm run check
npm test
npm run build
npm run dev
```

`npm run data:build`はe-Statの公開CSVを取得し、既知のSHA-256と分類階層を検証して`public/data/index.json`を生成します。検索はブラウザ内で行い、検索語をWorkerへ送信しません。

## Operations

```powershell
npx wrangler d1 migrations apply sangyo-code --local
npx wrangler d1 migrations apply sangyo-code --remote
npm run deploy
npm run metrics
npm run indexnow
```

公開前の契約検査は、データ件数・ハッシュ・階層、匿名計測、検索の端末内処理、視覚要件、出典・注意事項を確認します。
