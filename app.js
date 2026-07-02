const state = { offers: [], filter: "all", query: "" };

const grid = document.getElementById("grid");
const grid40 = document.getElementById("grid40");
const emptyState = document.getElementById("emptyState");
const resultCount = document.getElementById("resultCount");
const searchInput = document.getElementById("search");

document.getElementById("year").textContent = new Date().getFullYear();

const params = new URLSearchParams(location.search);
if (params.get("q")) {
  state.query = params.get("q");
  searchInput.value = state.query;
}

function daysBetween(a, b) {
  const ms = Math.abs(b - a);
  return ms / (1000 * 60 * 60 * 24);
}

function isNew(dateAddedISO) {
  if (!dateAddedISO) return false;
  const added = new Date(dateAddedISO);
  const now = new Date();
  return daysBetween(added, now) < 7;
}

function normalize(str) {
  return (str || "").toString().toLowerCase().trim();
}

function matchesFilter(offer) {
  const filter = state.filter;
  if (filter === "all") return true;

  if (filter === "new") return isNew(offer.dateAdded);

  if (filter === "partnership") {
    const pg = (offer.partnershipGroup || "").trim();
    return pg.length > 0 && pg.toLowerCase() !== "unpartnered";
  }

  if (filter === "bonus30") return offer.bonus30 === true;

  if (filter === "scam") {
    const scam = normalize(offer.scamAlert);
    return scam === "yes" || scam === "caution";
  }

  return true;
}

function matchesQuery(offer) {
  const q = normalize(state.query);
  if (!q) return true;

  const haystack = [
    offer.name,
    offer.notes,
    offer.partnershipGroup,
    offer.scamAlert,
    offer.status
  ].map(normalize).join(" | ");

  return haystack.includes(q);
}

function sortOffers(a, b) {
  const ao = Number.isFinite(a.displayOrder) ? a.displayOrder : 999999;
  const bo = Number.isFinite(b.displayOrder) ? b.displayOrder : 999999;
  if (ao !== bo) return ao - bo;

  const ad = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
  const bd = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
  return bd - ad;
}

function escapeHTML(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function badgeHTML(offer) {
  const badges = [];
  if (isNew(offer.dateAdded)) badges.push(`<span class="badge badge-new">New</span>`);

  const pg = (offer.partnershipGroup || "").trim();
  if (pg && pg.toLowerCase() !== "unpartnered") {
    badges.push(`<span class="badge badge-emerald">${escapeHTML(pg)}</span>`);
  } else if (pg && pg.toLowerCase() === "unpartnered") {
    badges.push(`<span class="badge">Unpartnered</span>`);
  }

  const scam = normalize(offer.scamAlert);
  if (scam === "yes") badges.push(`<span class="badge badge-danger">Scam alert</span>`);
  if (scam === "caution") badges.push(`<span class="badge badge-caution">Caution</span>`);

  if (normalize(offer.status) === "inactive") badges.push(`<span class="badge">Inactive</span>`);

  return badges.length ? `<div class="badges">${badges.join("")}</div>` : "";
}

function cardHTML(offer) {
  const safeName = offer.name || "Untitled";
  const safeNotes = offer.notes || "—";

  const url = offer.url || "#";
  const isInactive = normalize(offer.status) === "inactive";
  const ctaLabel = isInactive ? "Unavailable" : "Sign-up";

  return `
    <article class="card">
      <div class="card-top">
        <div class="card-logo" aria-hidden="true"></div>
        <div>
          <div class="card-title">${escapeHTML(safeName)}</div>
          <div class="card-desc">${escapeHTML(safeNotes)}</div>
          ${badgeHTML(offer)}
        </div>
      </div>

      <div class="card-actions">
        <a class="btn btn-primary" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"
           ${isInactive ? 'aria-disabled="true" onclick="return false;" style="opacity:.55; pointer-events:none"' : ""}>
          ${ctaLabel}
        </a>
      </div>
    </article>
  `;
}

function render() {
  const base = state.offers.filter(o => normalize(o.status) !== "inactive");

  const filtered = base
    .filter(matchesFilter)
    .filter(matchesQuery)
    .sort(sortOffers);

  grid.innerHTML = filtered.map(cardHTML).join("");
  emptyState.hidden = filtered.length !== 0;
  resultCount.textContent = `${filtered.length} offer${filtered.length === 1 ? "" : "s"} shown`;

  const fortyPlus = base
    .filter(o => {
      const notes = normalize(o.notes);
      return notes.includes("$40") || notes.includes("40+") || notes.includes("share bonus 40");
    })
    .sort(sortOffers);

  grid40.innerHTML = fortyPlus.map(cardHTML).join("");
}

async function loadOffers() {
  const res = await fetch("/api/offers", { headers: { "accept":"application/json" } });
  if (!res.ok) throw new Error("Failed to load offers");
  const data = await res.json();

  state.offers = Array.isArray(data.offers) ? data.offers : [];
  render();
}

document.querySelectorAll(".chip").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.filter = btn.dataset.filter;
    render();
  });
});

searchInput.addEventListener("input", (e) => {
  state.query = e.target.value;
  render();
});

loadOffers().catch(err => {
  console.error(err);
  resultCount.textContent = "Couldn’t load offers. Check API configuration.";
});
