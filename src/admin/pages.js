
export function loginPage(nonce) {
  return pageShell({
    nonce,
    title: "管理画面ログイン",
    body: `
      <main class="auth-wrap">
        <section class="auth-card">
          <p class="eyebrow">TYPE NAVI CONSOLE</p>
          <h1>管理画面ログイン</h1>
          <p class="muted">登録済みの管理者名とパスワードを入力してください。</p>
          <form id="login-form" class="form-stack">
            <label>管理者名<input name="username" autocomplete="username" required minlength="3" maxlength="32"></label>
            <label>パスワード<input name="password" type="password" autocomplete="current-password" required minlength="12" maxlength="128"></label>
            <button class="primary-button" type="submit">ログイン</button>
          </form>
          <p id="message" class="message" role="alert"></p>
        </section>
      </main>`,
    script: `
      const form = document.getElementById("login-form");
      const message = document.getElementById("message");
      const basePath = location.pathname.replace(/\\/$/, "");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.textContent = "確認しています…";
        const values = new FormData(form);
        const response = await fetch(basePath + "/api/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: values.get("username"), password: values.get("password") }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) location.replace(basePath);
        else message.textContent = data.message || "ログインできませんでした。";
      });`,
  });
}

export function setupPage(nonce) {
  return pageShell({
    nonce,
    title: "初期管理者登録",
    body: `
      <main class="auth-wrap">
        <section class="auth-card wide-auth">
          <p class="eyebrow">ONE-TIME SETUP</p>
          <h1>最初の管理者を登録</h1>
          <p class="muted">Cloudflareへ登録した一時セットアップトークンと、1人目の認証情報を入力します。2人目はログイン後に追加できます。</p>
          <form id="setup-form" class="form-stack">
            <label>セットアップトークン<input name="setupToken" type="password" autocomplete="off" required></label>
            <label>管理者名<input name="username" autocomplete="username" required minlength="3" maxlength="32"></label>
            <label>パスワード<input name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128"></label>
            <button class="primary-button" type="submit">最初の管理者を登録する</button>
          </form>
          <p id="message" class="message" role="alert"></p>
        </section>
      </main>`,
    script: `
      const form = document.getElementById("setup-form");
      const message = document.getElementById("message");
      const basePath = location.pathname.replace(/\\/setup\\/?$/, "");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.textContent = "安全な形式で登録しています…";
        const values = Object.fromEntries(new FormData(form));
        const response = await fetch(basePath + "/api/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const data = await response.json().catch(() => ({}));
        message.textContent = data.message || (response.ok ? "登録しました。" : "登録できませんでした。");
        if (response.ok) setTimeout(() => location.replace(basePath), 1200);
      });`,
  });
}

export function dashboardPage(nonce) {
  return pageShell({
    nonce,
    title: "アクセス解析",
    body: `
      <header class="console-header">
        <div><p class="eyebrow">TYPE NAVI CONSOLE</p><h1>アクセス解析</h1></div>
        <div class="header-actions"><span id="signed-in-user"></span><button id="logout" class="ghost-button">ログアウト</button></div>
      </header>
      <main class="dashboard">
        <section class="toolbar panel">
          <div class="range-buttons" id="range-buttons">
            <button data-range="today">今日</button><button class="active" data-range="7d">7日間</button>
            <button data-range="30d">30日間</button><button data-range="all">全期間</button>
          </div>
          <form id="custom-range" class="custom-range">
            <label>開始日<input id="start-date" type="date" required></label><label>終了日<input id="end-date" type="date" required></label>
            <button class="ghost-button" type="submit">期間を指定</button>
          </form>
          <button id="refresh" class="ghost-button">更新</button>
        </section>

        <section id="summary-cards" class="summary-grid" aria-label="主要指標"></section>

        <section class="charts-grid">
          <article class="panel chart-panel"><div class="panel-heading"><div><p class="eyebrow">DAILY TREND</p><h2>日別の推移</h2></div><div class="legend"><span class="visitors">訪問者</span><span class="completed">完了</span><span class="note">note</span></div></div><div id="daily-chart" class="daily-chart"></div></article>
          <article class="panel"><p class="eyebrow">FUNNEL</p><h2>診断の流れ</h2><div id="funnel" class="funnel"></div></article>
        </section>

        <section class="charts-grid">
          <article class="panel"><p class="eyebrow">RESULT TYPES</p><h2>16タイプ別の診断結果</h2><div id="type-results" class="ranking"></div></article>
          <article class="panel"><p class="eyebrow">NOTE CLICKS</p><h2>タイプ別noteクリック</h2><div id="note-results" class="ranking"></div></article>
        </section>

        <section class="panel"><div class="panel-heading"><div><p class="eyebrow">RECENT STATUS</p><h2>最近の集計状況</h2></div><span id="last-updated" class="muted"></span></div><div class="table-wrap"><table><thead><tr><th>日付</th><th>訪問者</th><th>訪問</th><th>回答</th><th>完了</th><th>note</th></tr></thead><tbody id="recent-table"></tbody></table></div></section>

        <section class="settings-grid">
          <article class="panel"><p class="eyebrow">ACCOUNTS</p><h2>管理者アカウント</h2><p class="muted small">最大2名です。自分自身は停止できず、必ず1名以上を有効に保ちます。</p><div id="admin-list" class="admin-list"></div><form id="admin-create-form" class="form-stack compact admin-create" hidden><h3>2人目の管理者を追加</h3><label>管理者名<input name="username" autocomplete="off" required minlength="3" maxlength="32"></label><label>初期パスワード<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><button class="primary-button">追加する</button></form><p id="admin-create-message" class="message"></p></article>
          <article class="panel"><p class="eyebrow">PASSWORD</p><h2>パスワード変更</h2><form id="password-form" class="form-stack compact"><label>現在のパスワード<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>新しいパスワード<input name="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><button class="primary-button">変更する</button></form><p id="password-message" class="message"></p></article>
        </section>

        <section class="panel data-info"><div><b>データ保存期間</b><span>詳細90日・日別集計は無期限</span></div><div><b>集計対象外</b><span>プレビュー・localhost・管理者除外ブラウザ</span></div><div><b>個人情報</b><span>IP・氏名・メールアドレスは保存しません</span></div></section>
      </main>`,
    script: dashboardScript(),
  });
}

function pageShell({ nonce, title, body, script }) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${title}｜Type Navi Console</title><style nonce="${nonce}">${styles()}</style></head><body>${body}<script nonce="${nonce}">${script}</script></body></html>`;
}

function dashboardScript() {
  return `
    const basePath = location.pathname.replace(/\\/$/, "");
    const state = { csrf: "", range: "7d", start: "", end: "", userId: null };
    const number = new Intl.NumberFormat("ja-JP");

    async function api(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      if (options.body) headers["Content-Type"] = "application/json";
      if (options.method && options.method !== "GET") headers["X-CSRF-Token"] = state.csrf;
      const response = await fetch(basePath + "/api/" + path, { credentials: "same-origin", ...options, headers });
      if (response.status === 401) { location.replace(basePath); throw new Error("Unauthorized"); }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "処理できませんでした。");
      return data;
    }

    async function initialize() {
      const session = await api("session");
      state.csrf = session.csrfToken;
      state.userId = session.user.id;
      document.getElementById("signed-in-user").textContent = session.user.username;
      await Promise.all([loadMetrics(), loadAdmins()]);
    }

    async function loadMetrics() {
      const query = new URLSearchParams({ range: state.range });
      if (state.range === "custom") { query.set("start", state.start); query.set("end", state.end); }
      const data = await api("metrics?" + query);
      renderSummary(data.summary);
      renderDaily(data.daily);
      renderFunnel(data.summary);
      renderRanking("type-results", data.types, "completed");
      renderRanking("note-results", data.types, "noteClicks");
      renderRecent(data.daily.slice(-10).reverse());
      document.getElementById("last-updated").textContent = "最終更新 " + new Date(data.generatedAt).toLocaleString("ja-JP");
    }

    function renderSummary(summary) {
      const cards = [
        ["訪問者数", summary.visitors, "人"], ["訪問回数", summary.visits, "回"],
        ["平均滞在時間", formatDuration(summary.averageSeconds), ""], ["回答数", summary.answers, "回答"],
        ["回答開始人数", summary.started, "人"], ["診断完了人数", summary.completed, "人"],
        ["診断完了率", summary.completionRate, "%"], ["結果表示人数", summary.resultViews, "人"],
        ["noteクリック人数", summary.noteClicks, "人"], ["noteクリック率", summary.noteClickRate, "%"],
      ];
      const root = document.getElementById("summary-cards"); root.textContent = "";
      cards.forEach(([label, value, unit]) => { const card = document.createElement("article"); card.className = "metric-card"; const p=document.createElement("p");p.textContent=label;const strong=document.createElement("strong");strong.textContent=typeof value === "number" ? number.format(value) : value;const span=document.createElement("span");span.textContent=unit;card.append(p,strong,span);root.append(card); });
    }

    function renderDaily(rows) {
      const root = document.getElementById("daily-chart"); root.textContent = "";
      const max = Math.max(1, ...rows.flatMap(row => [row.visitors, row.completed, row.noteClicks]));
      rows.forEach(row => { const group=document.createElement("div");group.className="bar-group";group.title=row.day; const bars=document.createElement("div");bars.className="bars"; [["visitors",row.visitors],["completed",row.completed],["note",row.noteClicks]].forEach(([name,value])=>{const bar=document.createElement("i");bar.className=name;bar.style.height=Math.max(2,value/max*100)+"%";bar.title=value;bars.append(bar);}); const label=document.createElement("span");label.textContent=row.day.slice(5).replace("-","/"); group.append(bars,label);root.append(group); });
    }

    function renderFunnel(summary) {
      const steps=[["訪問",summary.visits],["回答開始",summary.started],["診断完了",summary.completed],["noteクリック",summary.noteClicks]];
      const max=Math.max(1,summary.visits); const root=document.getElementById("funnel");root.textContent="";
      steps.forEach(([label,value])=>{const row=document.createElement("div");const text=document.createElement("span");text.textContent=label;const bar=document.createElement("i");bar.style.width=Math.max(4,value/max*100)+"%";const count=document.createElement("b");count.textContent=number.format(value);row.append(text,bar,count);root.append(row);});
    }

    function renderRanking(id, rows, key) {
      const sorted=[...rows].sort((a,b)=>b[key]-a[key]);const max=Math.max(1,...sorted.map(row=>row[key]));const root=document.getElementById(id);root.textContent="";
      sorted.forEach(row=>{const item=document.createElement("div");const label=document.createElement("b");label.textContent=row.type;const track=document.createElement("span");const fill=document.createElement("i");fill.style.width=(row[key]/max*100)+"%";track.append(fill);const count=document.createElement("em");count.textContent=number.format(row[key]);item.append(label,track,count);root.append(item);});
    }

    function renderRecent(rows) {
      const root=document.getElementById("recent-table");root.textContent="";rows.forEach(row=>{const tr=document.createElement("tr");[row.day,row.visitors,row.visits,row.answers,row.completed,row.noteClicks].forEach(value=>{const td=document.createElement("td");td.textContent=value;tr.append(td);});root.append(tr);});
    }

    async function loadAdmins() {
      const data=await api("admins");const root=document.getElementById("admin-list");root.textContent="";
      data.admins.forEach(admin=>{const row=document.createElement("div");row.className="admin-row";const info=document.createElement("div");const name=document.createElement("b");name.textContent=admin.username+(admin.id===state.userId?"（あなた）":"");const last=document.createElement("span");last.textContent=admin.lastLoginAt?"最終ログイン "+new Date(admin.lastLoginAt).toLocaleString("ja-JP"):"ログイン履歴なし";info.append(name,last);const button=document.createElement("button");button.className=admin.active?"status active":"status";button.textContent=admin.active?"有効":"停止中";button.disabled=admin.id===state.userId;button.addEventListener("click",async()=>{await api("admins/status",{method:"POST",body:JSON.stringify({userId:admin.id,active:!admin.active})});await loadAdmins();});row.append(info,button);root.append(row);});
      const createForm=document.getElementById("admin-create-form");createForm.hidden=data.admins.length>=2;
      if(data.admins.length>=2)document.getElementById("admin-create-message").textContent="管理者は2名登録済みです。";
    }

    document.getElementById("range-buttons").addEventListener("click",event=>{if(!event.target.dataset.range)return;document.querySelectorAll("[data-range]").forEach(button=>button.classList.remove("active"));event.target.classList.add("active");state.range=event.target.dataset.range;loadMetrics();});
    document.getElementById("custom-range").addEventListener("submit",event=>{event.preventDefault();state.range="custom";state.start=document.getElementById("start-date").value;state.end=document.getElementById("end-date").value;document.querySelectorAll("[data-range]").forEach(button=>button.classList.remove("active"));loadMetrics();});
    document.getElementById("refresh").addEventListener("click",()=>loadMetrics());
    document.getElementById("logout").addEventListener("click",async()=>{await api("logout",{method:"POST"});location.replace(basePath);});
    document.getElementById("admin-create-form").addEventListener("submit",async event=>{event.preventDefault();const message=document.getElementById("admin-create-message");try{const values=Object.fromEntries(new FormData(event.target));const data=await api("admins/create",{method:"POST",body:JSON.stringify(values)});message.textContent=data.message;event.target.reset();await loadAdmins();}catch(error){message.textContent=error.message;}});
    document.getElementById("password-form").addEventListener("submit",async event=>{event.preventDefault();const message=document.getElementById("password-message");try{const values=Object.fromEntries(new FormData(event.target));const data=await api("password",{method:"POST",body:JSON.stringify(values)});message.textContent=data.message;event.target.reset();}catch(error){message.textContent=error.message;}});
    function formatDuration(seconds){const value=Math.round(seconds||0);if(value<60)return value+"秒";const minutes=Math.floor(value/60);return minutes+"分"+(value%60)+"秒";}
    initialize().catch(error=>{document.body.textContent="管理画面を読み込めませんでした。";console.error(error);});
  `;
}

function styles() {
  return `
    [hidden]{display:none!important}.admin-create{margin-top:18px;padding-top:18px;border-top:1px solid var(--line)}.admin-create h3{margin:0;font-size:15px}
    :root{--bg:#fff8f6;--surface:#fff;--text:#342d3b;--muted:#796f7b;--primary:#e66b83;--accent:#7565c7;--line:#eee3e5;--green:#50a581;--shadow:0 14px 38px #4e304414}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP","Yu Gothic",sans-serif;line-height:1.6}.eyebrow{margin:0 0 4px;color:var(--primary);font-size:11px;font-weight:800;letter-spacing:.14em}.muted{color:var(--muted)}.small{font-size:12px}h1,h2,p{margin-top:0}h1{font-size:clamp(25px,4vw,36px);margin-bottom:0}h2{font-size:18px;margin-bottom:16px}.auth-wrap{min-height:100vh;display:grid;place-items:center;padding:22px}.auth-card{width:min(100%,440px);padding:38px;border:1px solid var(--line);border-radius:24px;background:var(--surface);box-shadow:var(--shadow)}.wide-auth{width:min(100%,760px)}.form-stack{display:grid;gap:15px}.form-stack label{display:grid;gap:6px;font-size:13px;font-weight:700}.form-stack input{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:11px;background:#fff;color:var(--text);font:inherit}.form-stack input:focus{outline:3px solid #e66b8324;border-color:var(--primary)}.primary-button,.ghost-button,.range-buttons button,.status{border:0;border-radius:10px;padding:10px 15px;font:inherit;font-weight:700;cursor:pointer}.primary-button{color:#fff;background:linear-gradient(120deg,var(--primary),#bd72bf)}.ghost-button,.range-buttons button{color:var(--text);background:#f5eef1}.message{min-height:1.5em;margin:14px 0 0;color:#b34f64;font-size:13px}.two-column{grid-template-columns:1fr 1fr}.two-column .full{grid-column:1/-1}fieldset{display:grid;gap:13px;border:1px solid var(--line);border-radius:14px;padding:16px}legend{padding:0 8px;font-weight:800}.console-header{max-width:1280px;margin:auto;padding:26px 24px 10px;display:flex;align-items:center;justify-content:space-between}.header-actions{display:flex;align-items:center;gap:12px}.dashboard{max-width:1280px;margin:auto;padding:16px 24px 60px;display:grid;gap:16px}.panel,.metric-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow)}.panel{padding:21px}.toolbar{display:flex;flex-wrap:wrap;align-items:end;gap:12px}.range-buttons{display:flex;flex-wrap:wrap;gap:6px}.range-buttons button.active{color:#fff;background:var(--primary)}.custom-range{display:flex;align-items:end;gap:8px;margin-left:auto}.custom-range label{display:grid;gap:3px;color:var(--muted);font-size:11px}.custom-range input{padding:8px;border:1px solid var(--line);border-radius:8px}.summary-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.metric-card{padding:17px}.metric-card p{margin-bottom:6px;color:var(--muted);font-size:12px}.metric-card strong{font-size:clamp(22px,3vw,31px)}.metric-card span{margin-left:4px;color:var(--muted);font-size:11px}.charts-grid,.settings-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:16px}.settings-grid{grid-template-columns:1fr 1fr}.panel-heading{display:flex;align-items:start;justify-content:space-between;gap:14px}.legend{display:flex;gap:12px;font-size:11px}.legend span::before{content:"";display:inline-block;width:8px;height:8px;margin-right:4px;border-radius:50%}.legend .visitors::before,.bars .visitors{background:var(--accent)}.legend .completed::before,.bars .completed{background:var(--primary)}.legend .note::before,.bars .note{background:#efb83e}.daily-chart{height:240px;display:flex;align-items:stretch;gap:7px;padding-top:15px;overflow-x:auto}.bar-group{min-width:28px;flex:1;display:grid;grid-template-rows:1fr auto;gap:6px;text-align:center;color:var(--muted);font-size:10px}.bars{display:flex;align-items:end;justify-content:center;gap:2px;border-bottom:1px solid var(--line)}.bars i{width:6px;min-height:2px;border-radius:4px 4px 0 0}.funnel{display:grid;gap:13px}.funnel>div{display:grid;grid-template-columns:78px 1fr 44px;align-items:center;gap:8px;font-size:12px}.funnel i{display:block;height:22px;border-radius:6px;background:linear-gradient(90deg,var(--primary),var(--accent))}.funnel b{text-align:right}.ranking{display:grid;gap:8px}.ranking>div{display:grid;grid-template-columns:44px 1fr 38px;align-items:center;gap:8px;font-size:12px}.ranking span{height:9px;overflow:hidden;border-radius:99px;background:#f1e9ed}.ranking i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--primary),var(--accent))}.ranking em{text-align:right;font-style:normal}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}.admin-list{display:grid;gap:10px}.admin-row{display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;background:#fcf7f8}.admin-row div{display:grid}.admin-row span{color:var(--muted);font-size:11px}.status{padding:7px 11px;background:#eee;color:var(--muted)}.status.active{background:#e6f6ef;color:#327d61}.status:disabled{cursor:not-allowed;opacity:.65}.compact{max-width:420px}.data-info{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.data-info div{display:grid;gap:4px}.data-info span{color:var(--muted);font-size:12px}@media(max-width:900px){.summary-grid{grid-template-columns:repeat(2,1fr)}.charts-grid,.settings-grid{grid-template-columns:1fr}.toolbar,.custom-range{align-items:stretch}.custom-range{width:100%;margin-left:0}.data-info{grid-template-columns:1fr}}@media(max-width:560px){.console-header{align-items:flex-start}.header-actions{align-items:end;flex-direction:column}.dashboard,.console-header{padding-left:14px;padding-right:14px}.summary-grid{grid-template-columns:1fr 1fr}.metric-card{padding:14px}.custom-range{display:grid;grid-template-columns:1fr 1fr}.custom-range button{grid-column:1/-1}.two-column{grid-template-columns:1fr}.two-column .full{grid-column:auto}.auth-card{padding:25px}}
  `;
}

