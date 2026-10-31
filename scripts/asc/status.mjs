// 현재 상태 조회: 앱 레코드 · 번들 ID · 버전 · 빌드
import { api, findApp, BUNDLE_ID } from "./asc.mjs";
const bid = await api("GET", `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}`);
console.log("bundleId", bid.data.map((b) => `${b.attributes.identifier} (${b.attributes.platform})`).join(", ") || "없음");
const app = await findApp();
if (!app) { console.log("APP 없음 — ASC 웹에서 신규 앱 생성 필요"); process.exit(0); }
console.log("APP", app.id, app.attributes.name, app.attributes.sku, app.attributes.primaryLocale);
const vers = await api("GET", `/v1/apps/${app.id}/appStoreVersions?limit=5`);
for (const v of vers.data) console.log("version", v.id, v.attributes.versionString, v.attributes.appStoreState);
const builds = await api("GET", `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=5`);
for (const b of builds.data) console.log("build", b.attributes.version, b.attributes.processingState, b.id);
