// App Store Connect API 도우미 — ES256 JWT(Node crypto, 외부 라이브러리 없음)
// 비밀값은 ~/.haku-env 의 ASC_KEY_ID · ASC_ISSUER_ID · ASC_KEY_PATH 에서만 읽는다 (코드·git 기록 금지)
import { createSign, createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";

const ENV = Object.fromEntries(
  readFileSync(`${process.env.HOME}/.haku-env`, "utf8").split("\n")
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).replace(/^export\s+/, ""), l.slice(i + 1).replace(/^["']|["']$/g, "")]; })
);
const KID = ENV.ASC_KEY_ID, ISS = ENV.ASC_ISSUER_ID;
if (!KID || !ISS || !ENV.ASC_KEY_PATH) throw new Error("~/.haku-env 에 ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH 필요");
const KEY = createPrivateKey(readFileSync(ENV.ASC_KEY_PATH));
export const BUNDLE_ID = "kr.harusuhak.app";

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
let tok = null, tokAt = 0;
function token() {
  const now = Math.floor(Date.now() / 1000);
  if (tok && now - tokAt < 900) return tok;
  const h = b64({ alg: "ES256", kid: KID, typ: "JWT" }), p = b64({ iss: ISS, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" });
  const s = createSign("SHA256"); s.update(`${h}.${p}`);
  tok = `${h}.${p}.${s.sign({ key: KEY, dsaEncoding: "ieee-p1363" }).toString("base64url")}`; tokAt = now;
  return tok;
}

export async function api(method, path, body) {
  const url = path.startsWith("http") ? path : `https://api.appstoreconnect.apple.com${path}`;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    if (r.status === 429 || r.status >= 500) { await new Promise((x) => setTimeout(x, 2000 * (i + 1))); continue; }
    const j = text ? JSON.parse(text) : {};
    if (!r.ok) { const e = new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j.errors ?? j).slice(0, 900)}`); e.status = r.status; e.body = j; throw e; }
    return j;
  }
  throw new Error(`${method} ${path} → retry exhausted`);
}

export async function all(path) {
  let out = [], next = path;
  while (next) { const j = await api("GET", next); out = out.concat(j.data); next = j.links?.next ?? null; }
  return out;
}

// 번들 ID로 앱 레코드 찾기 (API로는 앱 생성 불가 — 없으면 사람이 ASC 웹에서 생성)
export async function findApp() {
  const r = await api("GET", `/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=5`);
  return r.data.find((a) => a.attributes.bundleId === BUNDLE_ID) ?? null;
}
