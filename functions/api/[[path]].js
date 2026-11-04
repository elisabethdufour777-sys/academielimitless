// Académie Limitless : connexion par lien magique (envoyé par GHL) et sauvegarde de la progression.
// Liaisons requises dans Cloudflare Pages :
//   - KV namespace  : ACADEMIE
//   - Variable secrète : GHL_WEBHOOK_URL

const SESSION_DAYS = 90;
const TOKEN_MINUTES = 15;
const MAX_STATE_BYTES = 300 * 1024;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

const randomId = (bytes = 32) => {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const cleanEmail = (e) => String(e || "").trim().toLowerCase();
const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(e) && e.length <= 254;

function getCookie(request, name) {
  const c = request.headers.get("cookie") || "";
  const m = c.match(new RegExp("(?:^|;\\s*)" + name + "=([a-f0-9]{64})"));
  return m ? m[1] : null;
}

async function getSession(request, env) {
  const sid = getCookie(request, "ses");
  if (!sid) return null;
  const email = await env.ACADEMIE.get("ses:" + sid);
  return email ? { sid, email } : null;
}

async function rateLimit(env, key, max, seconds) {
  const k = "rl:" + key;
  const n = parseInt((await env.ACADEMIE.get(k)) || "0", 10);
  if (n >= max) return false;
  await env.ACADEMIE.put(k, String(n + 1), { expirationTtl: Math.max(60, seconds) });
  return true;
}

export async function onRequest({ request, env, params }) {
  if (!env.ACADEMIE) return json({ ok: false, error: "not_configured" }, 503);
  const path = (params.path || []).join("/");
  const method = request.method;

  // Protection simple : les requêtes qui modifient doivent venir du site lui-même.
  if (method !== "GET") {
    const origin = request.headers.get("origin");
    const host = new URL(request.url).host;
    if (origin && new URL(origin).host !== host) return json({ ok: false, error: "bad_origin" }, 403);
  }

  try {
    if (path === "me" && method === "GET") {
      const s = await getSession(request, env);
      return s ? json({ ok: true, auth: true, email: s.email }) : json({ ok: true, auth: false });
    }

    if (path === "login" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const email = cleanEmail(body.email);
      const prenom = String(body.prenom || "").trim().slice(0, 60);
      if (!validEmail(email)) return json({ ok: false, error: "bad_email" }, 400);
      if (!env.GHL_WEBHOOK_URL) return json({ ok: false, error: "not_configured" }, 503);
      const ip = request.headers.get("cf-connecting-ip") || "x";
      if (!(await rateLimit(env, "ip:" + ip, 8, 600)) || !(await rateLimit(env, "em:" + email, 3, 600)))
        return json({ ok: false, error: "rate_limited" }, 429);
      const token = randomId();
      await env.ACADEMIE.put("tok:" + token, email, { expirationTtl: TOKEN_MINUTES * 60 });
      const origin = new URL(request.url).origin;
      const r = await fetch(env.GHL_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, prenom, lien: origin + "/#login=" + token, source: "academie-limitless" }),
      });
      if (!r.ok) return json({ ok: false, error: "send_failed" }, 502);
      return json({ ok: true });
    }

    if (path === "verify" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const token = String(body.token || "");
      if (!/^[a-f0-9]{64}$/.test(token)) return json({ ok: false, error: "bad_token" }, 400);
      const email = await env.ACADEMIE.get("tok:" + token);
      if (!email) return json({ ok: false, error: "expired" }, 410);
      await env.ACADEMIE.delete("tok:" + token);
      const sid = randomId();
      await env.ACADEMIE.put("ses:" + sid, email, { expirationTtl: SESSION_DAYS * 86400 });
      const state = await env.ACADEMIE.get("p:" + email, "json");
      return json({ ok: true, email, state: state || null }, 200, {
        "set-cookie": `ses=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`,
      });
    }

    if (path === "progress") {
      const s = await getSession(request, env);
      if (!s) return json({ ok: false, error: "auth" }, 401);
      if (method === "GET") {
        const state = await env.ACADEMIE.get("p:" + s.email, "json");
        return json({ ok: true, state: state || null });
      }
      if (method === "PUT") {
        const text = await request.text();
        if (text.length > MAX_STATE_BYTES) return json({ ok: false, error: "too_large" }, 413);
        let state;
        try { state = JSON.parse(text); } catch (e) { return json({ ok: false, error: "bad_json" }, 400); }
        if (!state || typeof state !== "object" || Array.isArray(state)) return json({ ok: false, error: "bad_json" }, 400);
        state.updatedAt = Date.now();
        await env.ACADEMIE.put("p:" + s.email, JSON.stringify(state));
        return json({ ok: true });
      }
    }

    if (path === "logout" && method === "POST") {
      const s = await getSession(request, env);
      if (s) await env.ACADEMIE.delete("ses:" + s.sid);
      return json({ ok: true }, 200, { "set-cookie": "ses=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
    }

    return json({ ok: false, error: "not_found" }, 404);
  } catch (e) {
    return json({ ok: false, error: "server" }, 500);
  }
}
