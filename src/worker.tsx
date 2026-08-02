import { Hono } from "hono";
import type { Context } from "hono";
import { requestId } from "hono/request-id";

export type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 413 | 415,
  ) {
    super(code);
  }
}

const canonicalOrigin = "https://sangyo-code.yhay81.com";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const telemetryNames = new Set([
  "visited",
  "category_selected",
  "searched",
  "no_result",
  "level_changed",
  "saved",
  "copied",
  "official_opened",
  "returned",
]);
const industries = [
  ["A", "農業、林業", 33, "field"],
  ["B", "漁業", 21, "wave"],
  ["C", "鉱業、採石業、砂利採取業", 32, "stone"],
  ["D", "建設業", 55, "frame"],
  ["E", "製造業", 598, "factory"],
  ["F", "電気・ガス・熱供給・水道業", 20, "energy"],
  ["G", "情報通信業", 45, "signal"],
  ["H", "運輸業、郵便業", 63, "route"],
  ["I", "卸売業、小売業", 205, "shop"],
  ["J", "金融業、保険業", 72, "ledger"],
  ["K", "不動産業、物品賃貸業", 28, "building"],
  ["L", "学術研究、専門・技術サービス業", 42, "draft"],
  ["M", "宿泊業、飲食サービス業", 30, "table"],
  ["N", "生活関連サービス業、娯楽業", 69, "ticket"],
  ["O", "教育、学習支援業", 36, "book"],
  ["P", "医療、福祉", 41, "care"],
  ["Q", "複合サービス事業", 10, "link"],
  ["R", "サービス業（他に分類されないもの）", 67, "service"],
  ["S", "公務（他に分類されるものを除く）", 5, "public"],
  ["T", "分類不能の産業", 1, "blank"],
] as const;
const nowSeconds = () => Math.floor(Date.now() / 1000);

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const enforceSameOrigin = (c: AppContext) => {
  const fetchSite = c.req.header("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") throw new ApiError("cross_site_request", 403);
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) throw new ApiError("cross_site_request", 403);
};

const parseJson = async (c: AppContext, maximumBytes = 256) => {
  if (!(c.req.header("content-type") ?? "").toLowerCase().startsWith("application/json"))
    throw new ApiError("unsupported_media_type", 415);
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).byteLength > maximumBytes)
    throw new ApiError("payload_too_large", 413);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};

const recordEvent = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-sangyo-code-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(
      await sha256(session),
      name,
      c.req.header("x-sangyo-code-qa") === "1" ? 1 : 0,
      nowSeconds(),
    )
    .run();
};

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width,initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      {noindex ? <meta content="noindex,nofollow" name="robots" /> : null}
      <link href={canonical} rel="canonical" />
      <meta content="website" property="og:type" />
      <meta content="産業分類引き" property="og:site_name" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${canonicalOrigin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#17322d" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
      <script defer src="/app.js" />
    </head>
    <body>
      <a class="skip-link" href="#main">
        本文へ
      </a>
      <header class="site-header">
        <a aria-label="産業分類引き ホーム" class="wordmark" href="/">
          <span aria-hidden="true" class="classification-mark">
            <i>A</i>
            <i>01</i>
            <i>0111</i>
          </span>
          <span>産業分類引き</span>
        </a>
        <nav aria-label="案内">
          <a href="/guide">使い方</a>
          <a href="/source">出典</a>
          <a href="/privacy">保存</a>
        </nav>
      </header>
      {children}
      <footer class="site-footer">
        <span>e-Stat「日本標準産業分類」を加工して作成</span>
        <span>
          <a href="/source">出典と注意</a>
          <a href="https://www.e-stat.go.jp/classifications/terms/10" rel="noopener noreferrer">
            e-Stat
          </a>
        </span>
      </footer>
    </body>
  </html>
);

const IndustryTown = () => (
  <div aria-hidden="true" class="industry-town">
    <div class="town-sky">
      <span class="signal-tower">G</span>
      <span class="office-block">L</span>
      <span class="care-block">P</span>
    </div>
    <div class="town-line">
      <span class="field-block">A</span>
      <span class="factory-block">
        <i />
        <b>E</b>
      </span>
      <span class="shop-block">I</span>
      <span class="route-block">H</span>
    </div>
    <div class="classification-rail">
      <span>
        <small>大分類</small>
        <b>G</b>
      </span>
      <i>›</i>
      <span>
        <small>中分類</small>
        <b>39</b>
      </span>
      <i>›</i>
      <span>
        <small>小分類</small>
        <b>391</b>
      </span>
      <i>›</i>
      <span class="rail-final">
        <small>細分類</small>
        <b>3911</b>
      </span>
    </div>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${canonicalOrigin}/`}
    description="日本標準産業分類2,128コードを、事業内容・分類名・コードから探し、階層を確かめてまとめてコピーできます。"
    title="事業内容から産業分類コードを探す | 産業分類引き"
  >
    <main class="home" id="main">
      <section aria-labelledby="product-title" class="town-intro">
        <div class="product-heading">
          <p class="eyebrow">JAPAN STANDARD INDUSTRIAL CLASSIFICATION</p>
          <h1 id="product-title">仕事をたどる。分類コードが決まる。</h1>
          <p>事業内容のことばから、大分類・中分類・小分類・細分類を一続きで確かめます。</p>
          <div class="directory-facts">
            <span>
              <strong>2,128</strong>
              <small>分類コード</small>
            </span>
            <span>
              <strong>20</strong>
              <small>大分類</small>
            </span>
            <span>
              <strong>1,473</strong>
              <small>細分類</small>
            </span>
          </div>
        </div>
        <IndustryTown />
      </section>

      <div class="version-ribbon">
        <strong>令和5年［2023年］7月改定</strong>
        <span>最終判断は各分類の説明・事例・不適合事例を公式詳細で確認してください。</span>
        <a href="/source">データの範囲</a>
      </div>

      <section aria-labelledby="search-heading" class="search-desk">
        <header class="section-heading">
          <div>
            <p>分類台帳</p>
            <h2 id="search-heading">事業内容やコードで探す</h2>
          </div>
          <output id="data-status">一覧を準備しています…</output>
        </header>
        <label class="industry-search" for="industry-search">
          <span>分類名・説明・コードから</span>
          <span class="search-box">
            <i aria-hidden="true">⌕</i>
            <input
              autocomplete="off"
              id="industry-search"
              placeholder="例 ソフトウェア、飲食、3911…"
              type="search"
            />
            <button id="clear-search" type="button">
              消す
            </button>
          </span>
        </label>
        <fieldset class="level-filter">
          <legend>表示する階層</legend>
          <div>
            <button aria-pressed="true" data-level="4" type="button">
              細分類 4桁
            </button>
            <button aria-pressed="false" data-level="all" type="button">
              全階層
            </button>
            <button aria-pressed="false" data-level="parents" type="button">
              大・中・小
            </button>
          </div>
        </fieldset>
        <p class="privacy-note">入力したことばはこの端末内で照合し、送信・保存しません。</p>
      </section>

      <section aria-labelledby="major-heading" class="major-deck">
        <header class="section-heading">
          <div>
            <p>産業の街区</p>
            <h2 id="major-heading">大分類からたどる</h2>
          </div>
          <button hidden id="clear-major" type="button">
            全産業へ戻す
          </button>
        </header>
        <div class="major-grid">
          {industries.map(([code, name, count, icon]) => (
            <button data-major={code} type="button">
              <span aria-hidden="true" class={`major-icon ${icon}`}>
                <i />
              </span>
              <span class="major-code">{code}</span>
              <strong>{name}</strong>
              <small>細分類 {count}件</small>
            </button>
          ))}
        </div>
      </section>

      <section class="result-and-tray">
        <section aria-labelledby="result-heading" class="industry-results">
          <header class="result-heading">
            <div>
              <p>分類票</p>
              <h2 id="result-heading">見つかった分類</h2>
            </div>
            <output id="result-count">—件</output>
          </header>
          <p id="search-status" role="status">
            公式分類表を開いています…
          </p>
          <div class="classification-list" id="classification-list">
            <p class="loading-note">公式分類表を開いています…</p>
          </div>
          <button class="load-more" hidden id="load-more" type="button">
            次の40件を見る
          </button>
        </section>
        <aside aria-labelledby="tray-heading" class="code-tray">
          <header>
            <div>
              <p>持ち出す</p>
              <h2 id="tray-heading">分類票の束</h2>
            </div>
            <output id="saved-count">0 / 8</output>
          </header>
          <div id="saved-items">
            <p>分類票の「束へ」を押すと、最大8件をこの端末に残せます。</p>
          </div>
          <div class="saved-actions">
            <button disabled id="copy-saved" type="button">
              まとめてコピー
            </button>
            <button class="clear-button" disabled id="clear-saved" type="button">
              束を空にする
            </button>
          </div>
        </aside>
      </section>
    </main>
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${canonicalOrigin}/guide`}
    description="日本標準産業分類の大分類・中分類・小分類・細分類をたどり、公式詳細で判断する使い方。"
    title="使い方 | 産業分類引き"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span class="page-index">引</span>
        <div>
          <p>使い方</p>
          <h1>事業の中心を、四段の分類へ落とす</h1>
        </div>
      </header>
      <div class="instruction-grid">
        <section>
          <b>一</b>
          <h2>事業のことばで探す</h2>
          <p>
            商品名だけでなく、何を作る・売る・届ける事業かを入力します。分類名と公式説明を端末内で照合します。
          </p>
        </section>
        <section>
          <b>二</b>
          <h2>親から細分類へたどる</h2>
          <p>大分類から中分類、小分類、4桁の細分類へ進む道筋を分類票ごとに表示します。</p>
        </section>
        <section>
          <b>三</b>
          <h2>公式詳細で確かめる</h2>
          <p>候補が決まったらe-Statの詳細へ進み、事例・不適合事例を含めて最終確認します。</p>
        </section>
      </div>
      <div class="level-ledger">
        <span>
          <b>A</b>
          <small>大分類</small>
        </span>
        <i>›</i>
        <span>
          <b>01</b>
          <small>中分類</small>
        </span>
        <i>›</i>
        <span>
          <b>011</b>
          <small>小分類</small>
        </span>
        <i>›</i>
        <span>
          <b>0111</b>
          <small>細分類</small>
        </span>
      </div>
      <aside class="care-note">
        <strong>キーワード一致だけで決めない</strong>
        <p>
          日本標準産業分類は、事業所の主な経済活動を分類する統計基準です。似た語でも対象外になる場合があります。提出先の指定と公式詳細を確認してください。
        </p>
      </aside>
      <a class="page-cta" href="/">
        産業分類を探す
      </a>
    </main>
  </Layout>
);

const SourcePage = () => (
  <Layout
    canonical={`${canonicalOrigin}/source`}
    description="産業分類引きが利用するe-Stat日本標準産業分類の改定、コード件数、加工、利用条件、注意事項。"
    title="出典とデータ | 産業分類引き"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span class="page-index">典</span>
        <div>
          <p>出典とデータ</p>
          <h1>公式分類表を、たどれる分類台帳へ</h1>
        </div>
      </header>
      <div class="source-grid">
        <section>
          <h2>出典</h2>
          <p>
            政府統計の総合窓口e-Stat「
            <a href="https://www.e-stat.go.jp/classifications/terms/10" rel="noopener noreferrer">
              日本標準産業分類（令和5年［2023年］7月改定）
            </a>
            」の公開CSVを使用します。
          </p>
        </section>
        <section>
          <h2>収録範囲</h2>
          <p>
            大分類20、中分類99、小分類536、細分類1,473の合計2,128コードです。e-Statの表示2,129件から、コードを持たない検索上の注意1行を除いています。
          </p>
        </section>
        <section>
          <h2>表示の加工</h2>
          <p>
            分類コード、項目名、項目の説明を抽出し、親子関係と大分類を付けました。名称と説明は検索しやすい形へ正規化しますが、原文の意味を要約・補完しません。
          </p>
        </section>
        <section>
          <h2>利用条件</h2>
          <p>
            <a href="https://www.e-stat.go.jp/terms-of-use" rel="noopener noreferrer">
              e-Stat利用規約
            </a>
            に従い、出典と加工を表示します。規約対象コンテンツは出典表示等の条件で商用利用できます。
          </p>
        </section>
      </div>
      <dl class="source-ledger">
        <div>
          <dt>取得日</dt>
          <dd>2026年8月2日</dd>
        </div>
        <div>
          <dt>改定コード</dt>
          <dd>04</dd>
        </div>
        <div>
          <dt>CSV</dt>
          <dd>519,299 bytes</dd>
        </div>
        <div>
          <dt>SHA-256</dt>
          <dd>
            <code>7b96fe5dee3c8da38d516a08041c605be7407492e3ee754bc39d7aa3f46f0fe3</code>
          </dd>
        </div>
      </dl>
      <aside class="care-note">
        <strong>説明欄だけでは判断できない場合があります</strong>
        <p>
          このサービスは公開CSVに含まれる説明を表示します。e-Statの各詳細ページにある事例・不適合事例と、申請・調査を所管する機関の案内を最終確認に使ってください。
        </p>
      </aside>
    </main>
  </Layout>
);

const PrivacyPage = () => (
  <Layout
    canonical={`${canonicalOrigin}/privacy`}
    description="産業分類引きの検索語、分類票の束、匿名利用計測の保存範囲。"
    title="保存と計測 | 産業分類引き"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span class="page-index">守</span>
        <div>
          <p>保存と計測</p>
          <h1>検索は端末内。残すのは公開分類だけ。</h1>
        </div>
      </header>
      <div class="privacy-grid">
        <section>
          <h2>検索条件</h2>
          <p>
            入力した事業内容、コード、選んだ大分類・階層はブラウザ内で照合します。サーバー、URL、利用イベントへ保存しません。
          </p>
        </section>
        <section>
          <h2>分類票の束</h2>
          <p>
            束へ入れた最大8件の公開分類だけを、このブラウザのlocalStorageへ保存します。いつでも個別に外すか束を空にできます。
          </p>
        </section>
        <section>
          <h2>匿名利用計測</h2>
          <p>
            ランダム端末IDのハッシュ、許可済み操作名、QA判定、時刻だけを35日保持します。検索語、分類コード、分類名、事業内容の列はありません。
          </p>
        </section>
      </div>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", requestId());
app.use("*", async (c, next) => {
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});

app.get("/", (c) => {
  c.header("Cache-Control", "public,max-age=60,s-maxage=300");
  return c.html(<HomePage />);
});
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));

app.post("/api/telemetry", async (c) => {
  enforceSameOrigin(c);
  const payload = await parseJson(c);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError("invalid_request", 400);
  const name =
    typeof (payload as Record<string, unknown>).name === "string"
      ? (payload as Record<string, string>).name
      : "";
  if (!telemetryNames.has(name)) throw new ApiError("invalid_event", 400);
  await recordEvent(c, name);
  return c.body(null, 202);
});

app.get("/health", async (c) => {
  const database = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({
    detail: 1473,
    major: 20,
    ok: database?.ok === 1,
    service: "sangyo-code",
    total: 2128,
  });
});

app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((pagePath) => `<url><loc>${canonicalOrigin}${pagePath}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=3600,s-maxage=86400");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});

app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${canonicalOrigin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 産業分類引き"
    >
      <main class="not-found" id="main">
        <span>404</span>
        <h1>この分類票は見つかりません</h1>
        <p>産業分類を探す画面へ戻ってください。</p>
        <a href="/">産業分類を探す</a>
      </main>
    </Layout>,
  );
});

app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.code, requestId: c.get("requestId") }, error.status);
  console.error(
    "request_failed",
    c.get("requestId"),
    error instanceof Error ? error.message : "unknown",
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};

export { app };
export default { fetch: app.fetch, scheduled };
