(() => {
  "use strict";

  const sessionKey = "sangyo-code:session:v1";
  const visitKey = "sangyo-code:last-visit:v1";
  const savedKey = "sangyo-code:saved:v1";
  const qa = new URLSearchParams(window.location.search).get("qa") === "1" || navigator.webdriver;
  const codePattern = /^(?:[A-T]|\d{2,4})$/u;
  const levelLabels = { 1: "大分類", 2: "中分類", 3: "小分類", 4: "細分類" };

  const makeSession = () =>
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replaceAll(/[xy]/gu, (character) => {
          const random = Math.floor(Math.random() * 16);
          return (character === "x" ? random : (random & 3) | 8).toString(16);
        });
  let session = makeSession();
  let lastVisit = 0;
  try {
    session = localStorage.getItem(sessionKey) || session;
    localStorage.setItem(sessionKey, session);
    lastVisit = Number(localStorage.getItem(visitKey) || 0);
    localStorage.setItem(visitKey, String(Date.now()));
  } catch {
    // Local storage can be unavailable; searching remains fully usable.
  }

  const headers = () => ({
    "content-type": "application/json",
    "x-sangyo-code-qa": qa ? "1" : "0",
    "x-sangyo-code-session": session,
  });
  const emit = (name) => {
    void fetch("/api/telemetry", {
      body: JSON.stringify({ name }),
      headers: headers(),
      keepalive: true,
      method: "POST",
    }).catch(() => undefined);
  };
  emit("visited");
  if (lastVisit && Date.now() - lastVisit >= 8 * 60 * 60 * 1000) emit("returned");

  const classificationList = document.querySelector("#classification-list");
  if (!classificationList) return;

  const searchInput = document.querySelector("#industry-search");
  const clearSearch = document.querySelector("#clear-search");
  const clearMajor = document.querySelector("#clear-major");
  const dataStatus = document.querySelector("#data-status");
  const searchStatus = document.querySelector("#search-status");
  const resultCount = document.querySelector("#result-count");
  const loadMore = document.querySelector("#load-more");
  const levelButtons = [...document.querySelectorAll("[data-level]")];
  const majorButtons = [...document.querySelectorAll("[data-major]")];
  const savedItems = document.querySelector("#saved-items");
  const savedCount = document.querySelector("#saved-count");
  const copySaved = document.querySelector("#copy-saved");
  const clearSaved = document.querySelector("#clear-saved");

  const element = (tag, className = "", text = "") => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const normalize = (value) =>
    String(value ?? "")
      .normalize("NFKC")
      .toLocaleLowerCase("ja")
      .replaceAll(/[‐‑‒–—―−]/gu, "-")
      .trim();
  const queryTerms = (value) => normalize(value).split(/\s+/u).filter(Boolean);
  const compactCode = (value) =>
    normalize(value)
      .toUpperCase()
      .replaceAll(/[^A-Z0-9]/gu, "");
  const writeClipboard = async (value) => navigator.clipboard.writeText(value);
  const setStatus = (message) => {
    if (searchStatus) searchStatus.textContent = message;
  };

  const safeSaved = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(savedKey) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            codePattern.test(item.c) &&
            typeof item.n === "string" &&
            [1, 2, 3, 4].includes(item.l),
        )
        .slice(0, 8);
    } catch {
      return [];
    }
  };
  let saved = safeSaved();
  const persistSaved = () => {
    try {
      localStorage.setItem(savedKey, JSON.stringify(saved.slice(0, 8)));
    } catch {
      setStatus("このブラウザでは分類票の束を保存できませんでした。");
    }
  };

  let payload = null;
  let items = [];
  let byCode = new Map();
  let filteredItems = [];
  let selectedMajor = "";
  let selectedLevel = "4";
  let visibleCount = 40;
  const trackedSearches = new Set();

  const trailItems = (item) => {
    const trail = [];
    let current = item;
    while (current) {
      trail.unshift(current);
      current = current.p ? byCode.get(current.p) : null;
    }
    return trail;
  };
  const trailText = (item) =>
    trailItems(item)
      .map((part) => `${part.c} ${part.n}`)
      .join(" > ");
  const isSaved = (item) => saved.some((candidate) => candidate.c === item.c);

  const openSaved = (item) => {
    selectedMajor = "";
    selectedLevel = "all";
    if (searchInput) searchInput.value = item.c;
    majorButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
    levelButtons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.level === "all")),
    );
    if (clearMajor) clearMajor.hidden = true;
    renderResults(false);
    document.querySelector(".industry-results")?.scrollIntoView({ behavior: "smooth" });
  };

  const renderSaved = () => {
    if (!savedItems || !savedCount || !copySaved || !clearSaved) return;
    savedItems.replaceChildren();
    savedCount.textContent = `${saved.length} / 8`;
    copySaved.disabled = saved.length === 0;
    clearSaved.disabled = saved.length === 0;
    if (!saved.length) {
      savedItems.append(
        element("p", "tray-empty", "分類票の「束へ」を押すと、最大8件をこの端末に残せます。"),
      );
      return;
    }
    saved.forEach((item, index) => {
      const card = element("article", "saved-classification");
      const number = element("span", "saved-number", String(index + 1).padStart(2, "0"));
      const content = element("div");
      content.append(
        element("code", "", item.c),
        element("strong", "", item.n),
        element("small", "", levelLabels[item.l]),
      );
      const open = element("button", "open-saved", "開く");
      open.type = "button";
      open.addEventListener("click", () => openSaved(item));
      const remove = element("button", "remove-saved", "外す");
      remove.type = "button";
      remove.addEventListener("click", () => {
        saved = saved.filter((candidate) => candidate.c !== item.c);
        persistSaved();
        renderSaved();
        renderResults(false);
      });
      const actions = element("span", "saved-item-actions");
      actions.append(open, remove);
      card.append(number, content, actions);
      savedItems.append(card);
    });
  };

  const addToSaved = (item) => {
    if (isSaved(item)) return;
    if (saved.length >= 8) {
      setStatus("分類票の束は8件までです。不要な分類を外してから追加してください。");
      return;
    }
    saved.push({ c: item.c, l: item.l, n: item.n });
    persistSaved();
    renderSaved();
    renderResults(false);
    emit("saved");
  };

  const makeClassificationCard = (item) => {
    const card = element("article", `classification-card level-${item.l}`);
    const trail = element("div", "classification-trail");
    trailItems(item).forEach((part, index) => {
      if (index) trail.append(element("i", "", "›"));
      const step = element("span", part.c === item.c ? "current" : "");
      step.append(element("code", "", part.c), element("small", "", part.n));
      trail.append(step);
    });

    const heading = element("header", "classification-heading");
    const identity = element("div", "classification-identity");
    identity.append(
      element("span", "level-label", levelLabels[item.l]),
      element("code", "classification-code", item.c),
      element("h3", "classification-name", item.n),
    );
    const copyCode = element("button", "copy-code", "コードをコピー");
    copyCode.type = "button";
    copyCode.addEventListener("click", async () => {
      try {
        await writeClipboard(item.c);
        copyCode.textContent = "コピーしました";
        setTimeout(() => (copyCode.textContent = "コードをコピー"), 1400);
        emit("copied");
      } catch {
        setStatus("コピーできませんでした。コードを選択してコピーしてください。");
      }
    });
    heading.append(identity, copyCode);

    const description = element(
      "p",
      "classification-description",
      item.d || "公式CSVに説明の記載はありません。",
    );
    if (item.d.length > 320) {
      description.classList.add("is-clipped");
      const expand = element("button", "expand-description", "説明をすべて読む");
      expand.type = "button";
      expand.addEventListener("click", () => {
        const clipped = description.classList.toggle("is-clipped");
        expand.textContent = clipped ? "説明をすべて読む" : "説明を閉じる";
      });
      card.append(trail, heading, description, expand);
    } else {
      card.append(trail, heading, description);
    }

    const actions = element("footer", "card-actions");
    const official = element("a", "official-link", "公式の詳細・事例を見る ↗");
    official.href = `https://www.e-stat.go.jp/classifications/terms/10/04/${encodeURIComponent(item.c)}`;
    official.target = "_blank";
    official.rel = "noopener noreferrer";
    official.addEventListener("click", () => emit("official_opened"));
    const copyLine = element("button", "copy-record", "分類情報をコピー");
    copyLine.type = "button";
    copyLine.addEventListener("click", async () => {
      try {
        await writeClipboard(`${item.c}\t${item.n}\t${levelLabels[item.l]}\t${trailText(item)}`);
        copyLine.textContent = "コピーしました";
        setTimeout(() => (copyLine.textContent = "分類情報をコピー"), 1400);
        emit("copied");
      } catch {
        setStatus("コピーできませんでした。もう一度お試しください。");
      }
    });
    const save = element("button", "save-record", isSaved(item) ? "束にあります" : "束へ");
    save.type = "button";
    save.disabled = isSaved(item);
    save.addEventListener("click", () => addToSaved(item));
    actions.append(official, copyLine, save);
    card.append(actions);
    return card;
  };

  const searchSignature = () =>
    [normalize(searchInput?.value), selectedMajor, selectedLevel].join("|");
  const trackSearch = () => {
    if (!normalize(searchInput?.value)) return;
    const signature = searchSignature();
    if (trackedSearches.has(signature)) return;
    trackedSearches.add(signature);
    emit(filteredItems.length ? "searched" : "no_result");
  };

  const renderResults = (track = true) => {
    if (!payload || !resultCount || !loadMore) return;
    const terms = queryTerms(searchInput?.value);
    const exactCode = compactCode(searchInput?.value);
    const exact = codePattern.test(exactCode) ? byCode.get(exactCode) : null;
    filteredItems = items.filter((item) => {
      if (exact) return item.c === exact.c;
      if (selectedMajor && item.m !== selectedMajor) return false;
      if (selectedLevel === "4" && item.l !== 4) return false;
      if (selectedLevel === "parents" && item.l === 4) return false;
      return terms.every((term) => item.search.includes(term));
    });
    classificationList.replaceChildren();
    resultCount.textContent = `${filteredItems.length.toLocaleString("ja-JP")}件`;
    if (!filteredItems.length) {
      classificationList.append(
        element(
          "p",
          "empty-result",
          "条件に合う分類がありません。事業内容の言い換え、全階層、別の大分類をお試しください。",
        ),
      );
    } else {
      filteredItems
        .slice(0, visibleCount)
        .forEach((item) => classificationList.append(makeClassificationCard(item)));
    }
    loadMore.hidden = visibleCount >= filteredItems.length;
    const majorName = selectedMajor ? byCode.get(selectedMajor)?.n : "全産業";
    setStatus(
      `${majorName}から${filteredItems.length.toLocaleString("ja-JP")}件が条件に合います。`,
    );
    if (track) trackSearch();
  };

  let inputTimer = 0;
  searchInput?.addEventListener("input", () => {
    visibleCount = 40;
    renderResults(false);
    window.clearTimeout(inputTimer);
    inputTimer = window.setTimeout(trackSearch, 500);
  });
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      renderResults();
      document.querySelector(".industry-results")?.scrollIntoView({ behavior: "smooth" });
    }
  });
  clearSearch?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    visibleCount = 40;
    renderResults(false);
    searchInput?.focus();
  });
  levelButtons.forEach((button) =>
    button.addEventListener("click", () => {
      selectedLevel = button.dataset.level || "4";
      levelButtons.forEach((candidate) =>
        candidate.setAttribute("aria-pressed", String(candidate === button)),
      );
      visibleCount = 40;
      renderResults();
      emit("level_changed");
    }),
  );
  majorButtons.forEach((button) =>
    button.addEventListener("click", () => {
      selectedMajor = button.dataset.major || "";
      majorButtons.forEach((candidate) =>
        candidate.setAttribute("aria-pressed", String(candidate === button)),
      );
      if (clearMajor) clearMajor.hidden = false;
      visibleCount = 40;
      renderResults(false);
      emit("category_selected");
      document.querySelector(".industry-results")?.scrollIntoView({ behavior: "smooth" });
    }),
  );
  clearMajor?.addEventListener("click", () => {
    selectedMajor = "";
    majorButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
    clearMajor.hidden = true;
    visibleCount = 40;
    renderResults(false);
  });
  loadMore?.addEventListener("click", () => {
    visibleCount += 40;
    renderResults(false);
  });
  copySaved?.addEventListener("click", async () => {
    const lines = [
      "分類コード\t項目名\t階層",
      ...saved.map((item) => `${item.c}\t${item.n}\t${levelLabels[item.l]}`),
    ];
    try {
      await writeClipboard(lines.join("\n"));
      copySaved.textContent = "コピーしました";
      setTimeout(() => (copySaved.textContent = "まとめてコピー"), 1400);
      emit("copied");
    } catch {
      setStatus("コピーできませんでした。ブラウザの権限を確認してください。");
    }
  });
  clearSaved?.addEventListener("click", () => {
    saved = [];
    persistSaved();
    renderSaved();
    renderResults(false);
  });

  renderSaved();
  fetch("/data/index.json", { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error("index_failed");
      return response.json();
    })
    .then((data) => {
      payload = data;
      byCode = new Map(data.items.map((item) => [item.c, item]));
      items = data.items.map((item) => ({
        ...item,
        search: normalize(`${item.c} ${item.n} ${item.d} ${trailText(item)}`),
      }));
      byCode = new Map(items.map((item) => [item.c, item]));
      if (dataStatus)
        dataStatus.textContent = `${data.counts.total.toLocaleString("ja-JP")}コードを収録`;
      renderResults(false);
    })
    .catch(() => {
      if (dataStatus) dataStatus.textContent = "一覧を開けませんでした";
      setStatus("公式分類表を開けませんでした。通信を確認して、ページを再読み込みしてください。");
      classificationList.replaceChildren(
        element("p", "empty-result", "公式分類表を読み込めませんでした。"),
      );
    });
})();
