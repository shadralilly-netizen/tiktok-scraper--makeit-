import fs from "fs/promises";
import { chromium } from "playwright";

const competitors = [
  "username_doi_thu_1",
  "username_doi_thu_2",
  "username_doi_thu_3"
];

// lấy tối đa bao nhiêu video mỗi profile trước khi lọc top 30
const MAX_PER_PROFILE = 50;

function parseCount(value) {
  if (!value) return 0;
  const s = String(value).trim().toUpperCase().replace(/,/g, "");
  if (s.endsWith("K")) return Math.round(parseFloat(s) * 1000);
  if (s.endsWith("M")) return Math.round(parseFloat(s) * 1000000);
  if (s.endsWith("B")) return Math.round(parseFloat(s) * 1000000000);
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function scoreVideo(v) {
  // bạn có thể đổi công thức này
  return (
    (v.playCount || 0) * 1 +
    (v.diggCount || 0) * 4 +
    (v.shareCount || 0) * 6 +
    (v.commentCount || 0) * 3
  );
}

async function scrapeProfile(page, username) {
  const url = `https://www.tiktok.com/@${username}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(5000);

  // scroll vài lần để load thêm video
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(1500);
  }

  // thử lấy JSON embedded
  const data = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll("script"));
    for (const s of scripts) {
      const txt = s.textContent || "";
      if (txt.includes("user-post")) {
        return txt;
      }
    }
    return null;
  });

  const html = await page.content();

  const videos = [];

  // Cách 1: bắt link video trên profile
  const links = await page.$$eval('a[href*="/video/"]', anchors => {
    const uniq = new Map();
    for (const a of anchors) {
      const href = a.href;
      const text = (a.textContent || "").trim();
      if (!uniq.has(href)) uniq.set(href, { href, text });
    }
    return Array.from(uniq.values());
  });

  for (const item of links.slice(0, MAX_PER_PROFILE)) {
    const m = item.href.match(/\/video\/(\d+)/);
    videos.push({
      username,
      url: item.href,
      videoId: m ? m[1] : "",
      playCount: parseCount(item.text),
      diggCount: 0,
      shareCount: 0,
      commentCount: 0,
      source: "profile_links"
    });
  }

  // Cách 2: nếu có JSON trong HTML thì parse thêm metadata
  const ldMatches = [...html.matchAll(/"desc":"(.*?)".*?"playCount":(\d+).*?"diggCount":(\d+).*?"commentCount":(\d+).*?"shareCount":(\d+)/g)];
  for (const m of ldMatches.slice(0, MAX_PER_PROFILE)) {
    videos.push({
      username,
      url: "",
      videoId: "",
      desc: m[1],
      playCount: Number(m[2] || 0),
      diggCount: Number(m[3] || 0),
      commentCount: Number(m[4] || 0),
      shareCount: Number(m[5] || 0),
      source: "html_regex"
    });
  }

  // gộp trùng
  const uniq = new Map();
  for (const v of videos) {
    const key = v.url || `${username}_${v.desc || ""}_${v.playCount || 0}`;
    if (!uniq.has(key)) uniq.set(key, v);
  }

  return Array.from(uniq.values()).map(v => ({
    ...v,
    score: scoreVideo(v)
  }));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  });

  let allVideos = [];

  for (const username of competitors) {
    try {
      const videos = await scrapeProfile(page, username);
      allVideos = allVideos.concat(videos);
      console.log(`Done ${username}: ${videos.length} videos`);
    } catch (err) {
      console.error(`Error ${username}:`, err.message);
    }
  }

  await browser.close();

  allVideos.sort((a, b) => b.score - a.score);
  const top30 = allVideos.slice(0, 30);

  await fs.writeFile("results.json", JSON.stringify(top30, null, 2), "utf8");

  const csvHeader = "username,url,playCount,diggCount,commentCount,shareCount,score,desc\n";
  const csvBody = top30.map(v =>
    [
      v.username,
      `"${(v.url || "").replace(/"/g, '""')}"`,
      v.playCount || 0,
      v.diggCount || 0,
      v.commentCount || 0,
      v.shareCount || 0,
      v.score || 0,
      `"${(v.desc || "").replace(/"/g, '""')}"`
    ].join(",")
  ).join("\n");

  await fs.writeFile("results.csv", csvHeader + csvBody, "utf8");

  console.log("Saved results.json and results.csv");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
