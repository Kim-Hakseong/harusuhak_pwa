// 하루수학 App Store 등록 자동화 (ASC API) — 단계별·재실행 안전
//   node scripts/asc/release.mjs setup    버전 문자열·앱 정보(이름·부제·개인정보 URL)·카테고리·연령 등급·콘텐츠 권리·가격(무료)·판매 지역·버전 현지화·저작권·심사 정보
//   node scripts/asc/release.mjs media    6.9" 스크린샷 업로드 (ko, en-US) — store/screenshots/output/{ko,en}/0N-*.png
//   node scripts/asc/release.mjs attach   처리 완료된 최신 빌드를 버전에 연결
//   node scripts/asc/release.mjs submit   심사 제출
//   node scripts/asc/release.mjs check    현재 상태 출력
//   node scripts/asc/release.mjs lint     (오프라인) 메타데이터 파싱·글자 수 확인
// 사람만 가능한 것: ASC 웹에서 앱 레코드 생성, App Privacy(데이터 미수집) 응답 — API 미지원
import { api, all, findApp } from "./asc.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VERSION = "1.0.0";
const PRIVACY_URL = "https://kim-hakseong.github.io/harusuhak_pwa/privacy.html";
const SUPPORT_URL = "https://kim-hakseong.github.io/harusuhak_pwa/support.html";
const COPYRIGHT = "2026 TECHSENSE";
// 메타데이터 파일의 섹션 제목 → 필드
const LOCS = {
  ko: { file: "store/metadata.ko.md", shots: "ko", keys: { name: "앱 이름", subtitle: "부제", promotionalText: "홍보 문구", description: "설명", keywords: "키워드", notes: "심사 노트" } },
  "en-US": { file: "store/metadata.en.md", shots: "en", keys: { name: "Name", subtitle: "Subtitle", promotionalText: "Promotional Text", description: "Description", keywords: "Keywords" } },
};
const LIMITS = { name: 30, subtitle: 30, promotionalText: 170, description: 4000, keywords: 100 };

// "## 제목 (n자)" 섹션 본문 추출
function readMeta(loc) {
  const md = readFileSync(join(ROOT, LOCS[loc].file), "utf8");
  const sec = {};
  for (const part of md.split(/^## /m).slice(1)) {
    const nl = part.indexOf("\n");
    sec[part.slice(0, nl).replace(/\s*\(.*\)\s*$/, "").trim()] = part.slice(nl + 1).trim();
  }
  const out = {};
  for (const [field, title] of Object.entries(LOCS[loc].keys)) {
    const k = Object.keys(sec).find((t) => t.startsWith(title));
    if (!k) throw new Error(`${loc}: 섹션 "${title}" 없음`);
    out[field] = sec[k];
    if (LIMITS[field] && [...out[field]].length > LIMITS[field]) throw new Error(`${loc}.${field} ${[...out[field]].length}자 > ${LIMITS[field]}`);
  }
  return out;
}

async function ctx() {
  const app = await findApp();
  if (!app) throw new Error("앱 레코드 없음 — ASC 웹에서 신규 앱(kr.harusuhak.app)을 먼저 만들어야 함");
  const inc = await api("GET", `/v1/apps/${app.id}?include=appInfos,appStoreVersions`);
  const info = inc.included.find((x) => x.type === "appInfos" && x.attributes.state !== "READY_FOR_DISTRIBUTION")
    ?? inc.included.find((x) => x.type === "appInfos");
  const ver = inc.included.find((x) => x.type === "appStoreVersions" && x.attributes.platform === "IOS"
    && ["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"].includes(x.attributes.appStoreState));
  return { app, info, ver };
}

async function upsert(listPath, type, match, attrs, rel) {
  const cur = (await all(listPath)).find(match);
  if (cur) return (await api("PATCH", `/v1/${type}/${cur.id}`, { data: { type, id: cur.id, attributes: attrs } })).data;
  return (await api("POST", `/v1/${type}`, { data: { type, attributes: attrs, relationships: rel } })).data;
}

async function setup() {
  const { app, info, ver } = await ctx();
  console.log("app", app.id, "appInfo", info.id, "version", ver?.id, ver?.attributes.versionString);
  if (!ver) throw new Error("편집 가능한 iOS 버전 없음");

  if (ver.attributes.versionString !== VERSION || ver.attributes.copyright !== COPYRIGHT) {
    await api("PATCH", `/v1/appStoreVersions/${ver.id}`, { data: { type: "appStoreVersions", id: ver.id, attributes: { versionString: VERSION, copyright: COPYRIGHT, releaseType: "AFTER_APPROVAL" } } });
  }
  console.log("version", VERSION, "copyright ok");

  for (const loc of Object.keys(LOCS)) {
    const m = readMeta(loc);
    await upsert(`/v1/appInfos/${info.id}/appInfoLocalizations`, "appInfoLocalizations", (x) => x.attributes.locale === loc,
      { locale: loc, name: m.name, subtitle: m.subtitle, privacyPolicyUrl: PRIVACY_URL },
      { appInfo: { data: { type: "appInfos", id: info.id } } });
    console.log("appInfoLoc", loc, m.name, "/", m.subtitle);
    await upsert(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`, "appStoreVersionLocalizations", (x) => x.attributes.locale === loc,
      { locale: loc, description: m.description, keywords: m.keywords, promotionalText: m.promotionalText, supportUrl: SUPPORT_URL },
      { appStoreVersion: { data: { type: "appStoreVersions", id: ver.id } } });
    console.log("versionLoc", loc, "description", [...m.description].length, "keywords", [...m.keywords].length);
  }

  // 카테고리: 교육 (Kids 아님)
  await api("PATCH", `/v1/appInfos/${info.id}`, { data: { type: "appInfos", id: info.id, relationships: { primaryCategory: { data: { type: "appCategories", id: "EDUCATION" } } } } });
  console.log("category EDUCATION ok");

  // 콘텐츠 권리: MIT 원작 웹앱 사용(권리 있음)
  await api("PATCH", `/v1/apps/${app.id}`, { data: { type: "apps", id: app.id, attributes: { contentRightsDeclaration: "USES_THIRD_PARTY_CONTENT" } } });
  console.log("content rights ok");

  // 연령 등급: 전부 없음 → 4+ (API 가 모르는 필드는 빼고 재시도)
  const enums = ["alcoholTobaccoOrDrugUseOrReferences", "contests", "gamblingSimulated", "gunsOrOtherWeapons", "horrorOrFearThemes", "matureOrSuggestiveThemes",
    "medicalOrTreatmentInformation", "profanityOrCrudeHumor", "sexualContentGraphicAndNudity", "sexualContentOrNudity", "violenceCartoonOrFantasy", "violenceRealistic",
    "violenceRealisticProlongedGraphicOrSadistic"];
  const bools = ["advertising", "gambling", "lootBox", "messagingAndChat", "parentalControls", "ageAssurance", "userGeneratedContent", "unrestrictedWebAccess",
    "socialMedia", "healthOrWellnessTopics"];
  let attrs = { ...Object.fromEntries(enums.map((k) => [k, "NONE"])), ...Object.fromEntries(bools.map((k) => [k, false])) };
  for (let i = 0; i < 6; i++) {
    try { await api("PATCH", `/v1/ageRatingDeclarations/${info.id}`, { data: { type: "ageRatingDeclarations", id: info.id, attributes: attrs } }); break; }
    catch (e) {
      const bad = (e.body?.errors ?? []).map((x) => x.source?.pointer?.split("/").pop()).filter((k) => k && k in attrs);
      if (!bad.length) throw e;
      console.log("age rating: 제외", bad.join(","));
      for (const b of bad) delete attrs[b];
    }
  }
  const ai = await api("GET", `/v1/appInfos/${info.id}`);
  console.log("age rating", ai.data.attributes.appStoreAgeRating, "korea", ai.data.attributes.koreaAgeRating);

  // 가격: 무료 (기준 지역 대한민국)
  const sched = await api("GET", `/v1/apps/${app.id}/appPriceSchedule`).catch(() => null);
  if (!sched?.data) {
    const pts = await api("GET", `/v1/apps/${app.id}/appPricePoints?filter[territory]=KOR&limit=5`);
    const free = pts.data.find((p) => Number(p.attributes.customerPrice) === 0);
    await api("POST", "/v1/appPriceSchedules", {
      data: { type: "appPriceSchedules", relationships: { app: { data: { type: "apps", id: app.id } }, baseTerritory: { data: { type: "territories", id: "KOR" } }, manualPrices: { data: [{ type: "appPrices", id: "${p0}" }] } } },
      included: [{ type: "appPrices", id: "${p0}", attributes: { startDate: null }, relationships: { appPricePoint: { data: { type: "appPricePoints", id: free.id } } } }],
    });
  }
  console.log("price free ok");

  // 판매 지역: 전 지역 + 새 지역 자동
  const avail = await api("GET", `/v1/apps/${app.id}/appAvailabilityV2`).catch(() => null);
  if (!avail?.data) {
    const terr = await all("/v1/territories?limit=200");
    const inc = terr.map((t, i) => ({ type: "territoryAvailabilities", id: `\${t${i}}`, attributes: { available: true, releaseDate: null, preOrderEnabled: false }, relationships: { territory: { data: { type: "territories", id: t.id } } } }));
    await api("POST", "/v2/appAvailabilities", {
      data: { type: "appAvailabilities", attributes: { availableInNewTerritories: true }, relationships: { app: { data: { type: "apps", id: app.id } }, territoryAvailabilities: { data: inc.map((x) => ({ type: x.type, id: x.id })) } } },
      included: inc,
    });
    console.log("availability", terr.length, "territories ok");
  } else console.log("availability 이미 설정됨");

  // 심사 정보: 연락처는 같은 계정의 기존 앱 심사 정보에서 복사, 메모는 metadata.ko.md + en 심사 노트
  const notes = [readMeta("ko").notes, readFileSync(join(ROOT, "store/metadata.en.md"), "utf8").split(/^## Review Notes\s*$/m)[1]?.trim()].filter(Boolean).join("\n\n---\n\n");
  const contact = await findContact(app.id);
  const rdAttrs = { notes: notes.slice(0, 4000), demoAccountRequired: false, ...contact };
  const rd = await api("GET", `/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`).catch(() => null);
  if (rd?.data) await api("PATCH", `/v1/appStoreReviewDetails/${rd.data.id}`, { data: { type: "appStoreReviewDetails", id: rd.data.id, attributes: rdAttrs } });
  else await api("POST", "/v1/appStoreReviewDetails", { data: { type: "appStoreReviewDetails", attributes: rdAttrs, relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: ver.id } } } } });
  console.log("review detail ok (contact", Object.keys(contact).length ? "copied" : "MISSING", ", notes", notes.length, "chars)");
}

async function findContact(selfId) {
  const apps = await api("GET", "/v1/apps?limit=50");
  for (const a of apps.data.filter((x) => x.id !== selfId)) {
    for (const v of (await api("GET", `/v1/apps/${a.id}/appStoreVersions?limit=3`)).data) {
      const rd = await api("GET", `/v1/appStoreVersions/${v.id}/appStoreReviewDetail`).catch(() => null);
      const at = rd?.data?.attributes;
      if (at?.contactEmail && at?.contactPhone && at?.contactFirstName && at?.contactLastName) {
        return { contactFirstName: at.contactFirstName, contactLastName: at.contactLastName, contactPhone: at.contactPhone, contactEmail: at.contactEmail };
      }
    }
  }
  return {};
}

async function uploadShot(setId, file) {
  const buf = readFileSync(file);
  const name = file.split("/").pop();
  const r = (await api("POST", "/v1/appScreenshots", { data: { type: "appScreenshots", attributes: { fileName: name, fileSize: buf.length }, relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: setId } } } } })).data;
  for (const op of r.attributes.uploadOperations) {
    const res = await fetch(op.url, { method: op.method, headers: Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value])), body: buf.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`upload part ${res.status} ${name}`);
  }
  await api("PATCH", `/v1/appScreenshots/${r.id}`, { data: { type: "appScreenshots", id: r.id, attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(buf).digest("hex") } } });
}

async function media() {
  const { ver } = await ctx();
  const vls = await all(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`);
  for (const [loc, cfg] of Object.entries(LOCS)) {
    const vl = vls.find((x) => x.attributes.locale === loc);
    if (!vl) throw new Error(`${loc} 버전 현지화 없음 — setup 먼저`);
    const sets = await all(`/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets`);
    let set = sets.find((s) => s.attributes.screenshotDisplayType === "APP_IPHONE_67")?.id;
    if (!set) set = (await api("POST", "/v1/appScreenshotSets", { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: "APP_IPHONE_67" }, relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: vl.id } } } } })).data.id;
    for (const old of await all(`/v1/appScreenshotSets/${set}/appScreenshots`)) await api("DELETE", `/v1/appScreenshots/${old.id}`);
    const dir = join(ROOT, "store/screenshots/output", cfg.shots);
    const files = readdirSync(dir).filter((f) => /^0\d-.*\.png$/.test(f)).sort();
    for (const f of files) await uploadShot(set, join(dir, f));
    console.log(loc, "APP_IPHONE_67", files.length, "shots uploaded");
  }
}

async function latestBuild(appId) {
  const b = await api("GET", `/v1/builds?filter[app]=${appId}&filter[preReleaseVersion.version]=${VERSION}&sort=-uploadedDate&limit=1`);
  return b.data[0] ?? null;
}

async function attach() {
  const { app, ver } = await ctx();
  const b = await latestBuild(app.id);
  if (!b) throw new Error("업로드된 빌드 없음");
  console.log("build", b.attributes.version, b.attributes.processingState, b.id);
  if (b.attributes.processingState !== "VALID") throw new Error(`빌드 처리 중(${b.attributes.processingState}) — 잠시 후 재시도`);
  if (b.attributes.usesNonExemptEncryption == null) {
    await api("PATCH", `/v1/builds/${b.id}`, { data: { type: "builds", id: b.id, attributes: { usesNonExemptEncryption: false } } });
  }
  await api("PATCH", `/v1/appStoreVersions/${ver.id}/relationships/build`, { data: { type: "builds", id: b.id } });
  console.log("build attached to", VERSION);
}

async function submit() {
  const { app, ver } = await ctx();
  const open = (await all(`/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=READY_FOR_REVIEW,UNRESOLVED_ISSUES`))[0];
  const rs = open ?? (await api("POST", "/v1/reviewSubmissions", { data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: { data: { type: "apps", id: app.id } } } } })).data;
  const items = await all(`/v1/reviewSubmissions/${rs.id}/items`);
  if (!items.length) await api("POST", "/v1/reviewSubmissionItems", { data: { type: "reviewSubmissionItems", relationships: { reviewSubmission: { data: { type: "reviewSubmissions", id: rs.id } }, appStoreVersion: { data: { type: "appStoreVersions", id: ver.id } } } } });
  const r = await api("PATCH", `/v1/reviewSubmissions/${rs.id}`, { data: { type: "reviewSubmissions", id: rs.id, attributes: { submitted: true } } });
  console.log("SUBMITTED", r.data.attributes.state, r.data.attributes.submittedDate);
  const v = await api("GET", `/v1/appStoreVersions/${ver.id}`);
  console.log("version state", v.data.attributes.appStoreState);
}

async function check() {
  const { app, info, ver } = await ctx();
  console.log("app", app.id, app.attributes.name, "version", ver?.attributes.versionString, ver?.attributes.appStoreState);
  for (const vl of await all(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)) {
    const sets = await all(`/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets`);
    const out = [];
    for (const s of sets) {
      const xs = await all(`/v1/appScreenshotSets/${s.id}/appScreenshots`);
      out.push(`${s.attributes.screenshotDisplayType}:${xs.length}[${[...new Set(xs.map((x) => x.attributes.assetDeliveryState?.state))].join("/")}]`);
    }
    console.log(vl.attributes.locale, out.join(" ") || "스크린샷 없음");
  }
  const b = await latestBuild(app.id);
  console.log("build", b ? `${b.attributes.version} ${b.attributes.processingState}` : "없음");
  const vb = await api("GET", `/v1/appStoreVersions/${ver.id}/build`).catch(() => null);
  console.log("attached build", vb?.data ? vb.data.attributes.version : "없음");
  const ai = await api("GET", `/v1/appInfos/${info.id}`);
  console.log("age rating", ai.data.attributes.appStoreAgeRating);
}

const step = process.argv[2];
// 오프라인: 메타데이터 파싱·글자 수만 확인
async function lint() {
  for (const loc of Object.keys(LOCS)) {
    const m = readMeta(loc);
    console.log(loc, Object.entries(m).map(([k, v]) => `${k}=${[...v].length}`).join(" "), "|", m.name, "/", m.subtitle);
  }
}
const steps = { lint, setup, media, attach, submit, check };
if (!steps[step]) { console.error("usage: release.mjs lint|setup|media|attach|submit|check"); process.exit(2); }
await steps[step]();
