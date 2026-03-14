const vm = require("node:vm");

const REVIEWS_URL = "https://2gis.kz/astana/firm/70000001040136089/tab/reviews";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_REVIEWS = 8;

let cache = {
  loadedAt: 0,
  data: {
    sourceUrl: REVIEWS_URL,
    updatedAt: null,
    total: 0,
    reviews: [],
  },
};

function extractInitialState(html) {
  const match = html.match(/var initialState = JSON\.parse\('[\s\S]*?'\);/);
  if (!match) throw new Error("initialState not found");

  const sandbox = { JSON, initialState: null };
  vm.runInNewContext(match[0], sandbox, { timeout: 1000 });

  if (!sandbox.initialState || typeof sandbox.initialState !== "object") {
    throw new Error("initialState parse failed");
  }

  return sandbox.initialState;
}

function normalizeReview(review) {
  const text = String(review?.text || "").trim();
  if (!text) return null;

  const userName = String(review?.user?.name || "Client").trim() || "Client";
  const rating = Number.isFinite(Number(review?.rating)) ? Number(review.rating) : null;
  const createdAt = review?.date_created ? new Date(review.date_created).toISOString() : null;
  const reviewId = String(review?.id || "").trim();

  return {
    id: reviewId || `${userName}-${createdAt || "no-date"}`,
    author: userName,
    rating,
    text,
    createdAt,
    sourceUrl: REVIEWS_URL,
  };
}

async function fetch2gisReviews() {
  const response = await fetch(REVIEWS_URL, {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`2GIS HTTP ${response.status}`);
  }

  const html = await response.text();
  const state = extractInitialState(html);

  const reviewsMap = state?.data?.review || {};
  const reviews = Object.values(reviewsMap)
    .map((entry) => normalizeReview(entry?.data))
    .filter(Boolean)
    .sort((a, b) => {
      const aTs = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTs = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTs - aTs;
    })
    .slice(0, MAX_REVIEWS);

  return {
    sourceUrl: REVIEWS_URL,
    updatedAt: new Date().toISOString(),
    total: reviews.length,
    reviews,
  };
}

async function get2gisReviews({ force = false } = {}) {
  const age = Date.now() - cache.loadedAt;
  if (!force && cache.loadedAt > 0 && age < CACHE_TTL_MS) {
    return cache.data;
  }

  const fresh = await fetch2gisReviews();
  cache = { loadedAt: Date.now(), data: fresh };
  return fresh;
}

module.exports = { get2gisReviews, REVIEWS_URL };
