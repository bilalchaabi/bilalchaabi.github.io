/************************************* 
 * DEV MODE (auto-fill form for testing)
 *************************************/
const DEV_MODE = true; // change to false for production

if (DEV_MODE) {
  window.addEventListener("DOMContentLoaded", () => {
    // Pre-fill form fields for faster testing
    document.getElementById("contactCount").value = 1000;
    document.getElementById("taxexemptstatus").value = "501c3";
    document.getElementById("vettingScore").value = 23;
    document.getElementById("useCase").value = "Political";
    document.getElementById("mmsType").checked = true;

    // Trigger manual mode setup
    applyManualMix(10000);

    // Automatically generate carrier + rate limits
    renderOverview();

    // Fill schedule values
    document.getElementById("timezone").value = "US/Eastern";

    // Automatically run the simulation
    document.getElementById("runTimeline").click();
  });
}


/*************************************
 * FIXED CSV SCHEMA (set these once)
 *************************************/
const PHONE_HEADER = "phone";     // exact header in your export
const CARRIER_HEADER = "carrier_name"; // exact header in your export

/*************************************
 * Manual mix for contact-count-only
 *************************************/
const MANUAL_MIX = [
  { name: "T-Mobile", pct: 0.37 },
  { name: "Verizon", pct: 0.33 },
  { name: "AT&T", pct: 0.28 },
  { name: "United Cellular", pct: 0.01 },
  { name: "Unknown", pct: 0.01 }
];

/*************************************
 * Small helpers
 *************************************/
function normalizeHeader(h) {
  return String(h || "").replace(/^\uFEFF/, "").trim();
}
function normalizePhone(raw) {
  // Keep only digits; require exactly 11 digits per your export guarantee
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}
function mapCarrier(nominal) {
  if (!nominal) return "Unknown";
  const c = String(nominal).toLowerCase();

  if (c.includes("cingular") || c.includes("at&t") || c.includes("att")) return "AT&T";

  if (
    c.includes("t-mobile") || c.includes("t mobile") || c.includes("tmobile") ||
    c.includes("metropcs") || c.includes("metro pcs") ||
    c.includes("powertel") || c.includes("omnipoint") ||
    c.includes("sprint")
  ) return "T-Mobile";

  if (c.includes("verizon")) return "Verizon";
  if (c.includes("united states cellular") || c.includes("us cellular")) return "United Cellular";
  return "Unknown";
}

/*************************************
 * Grab UI elements
 *************************************/
const contactInput = document.getElementById('contactCount');
const csvInput = document.getElementById('csvUpload');
const csvBadge = document.getElementById('csvModeBadge');
const manualBadge = document.getElementById('manualModeBadge');
const contactWarn = document.getElementById('contactWarning');
const assumptionsNote = document.getElementById('assumptionsNote');
const vettingInput = document.getElementById('vettingScore');
const vettingMsg = document.getElementById('vettingMsg');
const outputContainer = document.getElementById('carrierOutput');


const smsRadio = document.getElementById('smsType');
const mmsRadio = document.getElementById('mmsType');
const messageBox = document.getElementById('initialMessage');
const segmentDisplay = document.getElementById('segmentCount');

smsRadio.addEventListener('change', toggleMessageInput);
mmsRadio.addEventListener('change', toggleMessageInput);

function toggleMessageInput() {
  if (mmsRadio.checked) {
    messageBox.value = "";
    messageBox.disabled = true;
    segmentDisplay.textContent = "Segments: 1 (MMS fixed)";
  } else {
    messageBox.disabled = false;
    updateSegmentCount();
  }
}
const GSM_7_SINGLE = 160;
const GSM_7_MULTI  = 153;
const UCS_2_SINGLE = 70;
const UCS_2_MULTI  = 67;
const GSM_BASIC = "\n\f\r @Δ¡¿£_!$Φ\"¥Γ#èΛ¤éΩ%ùΠ&ìΨ'òΣ(ÇΘ)Ξ*:Ø+;ÄäøÆ,<Ööæ-=ÑñÅß.>ÜüåÉ/?§à0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const GSM_EXT = "|^€{}[]~\\";
const MAX_MMS_GRAPHEMES = 1600;

const segmentTotalEl = document.getElementById("segmentTotal");
const charsRemainingEl = document.getElementById("charsRemaining");
const charSetEl = document.getElementById("charSet");

smsRadio.addEventListener("change", toggleMessageInput);
mmsRadio.addEventListener("change", toggleMessageInput);
messageBox.addEventListener("input", updateSegmentStats);

function toggleMessageInput() {
  if (mmsRadio.checked) {
    messageBox.value = "";
    messageBox.disabled = true;
    updateSegmentStats(); // reset view for MMS
  } else {
    messageBox.disabled = false;
    updateSegmentStats();
  }
}

function updateSegmentStats() {
  const text = messageBox.value || "";
  if (mmsRadio.checked) {
    // MMS = always 1 segment, 1600 grapheme limit
    const length = [...text].length;
    const remaining = Math.max(0, MAX_MMS_GRAPHEMES - length);
    segmentTotalEl.textContent = "1";
    charsRemainingEl.textContent = `${remaining}/${MAX_MMS_GRAPHEMES}`;
    charSetEl.textContent = "MMS (fixed 1 segment)";
    return;
  }

  // SMS logic
  const { encoding, characterCount, segmentCount, charsRemaining, charsPerSegment } = getSegmentStats(text);

  segmentTotalEl.textContent = segmentCount;
  charsRemainingEl.textContent = `${charsRemaining}/${charsPerSegment}`;
  charSetEl.textContent = encoding === "gsm_7" ? "GSM-7" : "Unicode";
}

function getSegmentStats(message) {
  const encoding = determineEncoding(message);
  const charCount = getCharacterCount(message, encoding);
  const segCount = charsToSegments(charCount, encoding);
  const charsPerSegment = charsPerSeg(segCount, encoding);
  const charsRemaining = remainingChars(charCount, segCount, encoding);

  return {
    encoding,
    characterCount: charCount,
    segmentCount: segCount,
    charsRemaining,
    charsPerSegment
  };
}

function determineEncoding(message) {
  for (const ch of message) {
    const code = ch.codePointAt(0);
    const isBasic = GSM_BASIC.includes(ch);
    const isExt = GSM_EXT.includes(ch);
    if (!isBasic && !isExt) return "ucs_2";
  }
  return "gsm_7";
}

function getCharacterCount(message, encoding) {
  if (encoding === "gsm_7") {
    let count = 0;
    for (const ch of message) {
      count += GSM_EXT.includes(ch) ? 2 : 1;
    }
    return count;
  } else {
    // UCS-2
    let utf16Units = 0;
    for (const ch of message) {
      utf16Units += ch.codePointAt(0) > 0xFFFF ? 2 : 1;
    }
    return utf16Units;
  }
}

function charsToSegments(count, encoding) {
  if (count === 0) return 1;
  if (encoding === "gsm_7") {
    return count <= GSM_7_SINGLE ? 1 : Math.ceil(count / GSM_7_MULTI);
  } else {
    return count <= UCS_2_SINGLE ? 1 : Math.ceil(count / UCS_2_MULTI);
  }
}

function charsPerSeg(segCount, encoding) {
  if (encoding === "gsm_7") return segCount === 1 ? GSM_7_SINGLE : GSM_7_MULTI;
  else return segCount === 1 ? UCS_2_SINGLE : UCS_2_MULTI;
}

function remainingChars(count, segCount, encoding) {
  const perSeg = charsPerSeg(segCount, encoding);
  const remainder = perSeg - (count % perSeg);
  return remainder === perSeg ? perSeg : remainder;
}

/*************************************
 * Mode + tallies
 *************************************/
let MODE = "NONE"; // "CSV" | "MANUAL" | "NONE"
let carrierCounts = { "AT&T": 0, "T-Mobile": 0, "Verizon": 0, "United Cellular": 0, "Unknown": 0 };
let totalRows = 0;
let totalContacts = 0;     // unique 11-digit (CSV) or manual count
let invalidPhoneRows = 0;  // CSV only
let duplicateRows = 0;     // CSV only

function setModeCSV() {
  MODE = "CSV";
  contactInput.disabled = true;
  csvInput.disabled = false;
  manualBadge?.classList.add('hidden');
  csvBadge?.classList.remove('hidden');
  assumptionsNote?.classList.add('hidden');
}

function setModeManual() {
  MODE = "MANUAL";
  contactInput.disabled = false;
  csvInput.disabled = true;
  csvBadge?.classList.add('hidden');
  manualBadge?.classList.remove('hidden');
  assumptionsNote?.classList.remove('hidden');
}

function setModeNone() {
  MODE = "NONE";
  contactInput.disabled = false;
  csvInput.disabled = false;
  csvBadge?.classList.add('hidden');
  manualBadge?.classList.add('hidden');
  assumptionsNote?.classList.add('hidden');
}

function updateContactWarning(n) {
  if (Number(n) > 150000) contactWarn?.classList.remove('hidden');
  else contactWarn?.classList.add('hidden');
}

/*************************************
 * Vetting score (0–100)
 *************************************/
vettingInput?.addEventListener('input', () => {
  const raw = vettingInput.value;
  if (raw === "") {
    vettingInput.setCustomValidity("");
    vettingMsg?.classList.add('hidden');
    return;
  }
  const val = Number(raw);
  const ok = Number.isFinite(val) && val >= 0 && val <= 100;
  if (!ok) {
    vettingInput.setCustomValidity("Vetting score must be between 0 and 100.");
    vettingMsg?.classList.remove('hidden');
  } else {
    vettingInput.setCustomValidity("");
    vettingMsg?.classList.add('hidden');
  }
  vettingInput.reportValidity();
});

/*************************************
 * Manual mix → compute carrierCounts
 *************************************/
function applyManualMix(total) {
  carrierCounts = { "AT&T": 0, "T-Mobile": 0, "Verizon": 0, "United Cellular": 0, "Unknown": 0 };
  let assigned = 0;
  const parts = MANUAL_MIX.map(m => {
    const exact = total * m.pct;
    const floored = Math.floor(exact);
    assigned += floored;
    return { ...m, exact, floored, frac: exact - floored };
  });
  let remainder = total - assigned;
  parts.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < parts.length && remainder > 0; i++, remainder--) {
    parts[i].floored += 1;
  }
  parts.forEach(p => {
    carrierCounts[p.name] = (carrierCounts[p.name] || 0) + p.floored;
  });
  totalContacts = total;
  totalRows = total; // display parity
  invalidPhoneRows = 0;
  duplicateRows = 0;
}

/*************************************
 * CSV upload → CSV mode (locks count)
 *************************************/
csvInput.addEventListener('change', (event) => {
  const file = event.target.files[0];

  if (!file) {
    if (!contactInput.value) setModeNone();
    return;
  }

  setModeCSV();

  carrierCounts = { "AT&T": 0, "T-Mobile": 0, "Verizon": 0, "United Cellular": 0, "Unknown": 0 };
  totalRows = 0; totalContacts = 0; invalidPhoneRows = 0; duplicateRows = 0;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
    complete: function(results) {
      const rows = results.data || [];
      totalRows = rows.length;

      const fields = (results.meta?.fields || []).map(normalizeHeader);
      if (!fields.includes(PHONE_HEADER) || !fields.includes(CARRIER_HEADER)) {
        alert(`Expected headers not found.\nLooking for "${PHONE_HEADER}" and "${CARRIER_HEADER}".`);
        return;
      }

      const seen = new Set();

      for (const row of rows) {
        const normalized = normalizePhone(row[PHONE_HEADER]);
        if (!normalized) { invalidPhoneRows++; continue; }

        if (seen.has(normalized)) { duplicateRows++; continue; }
        seen.add(normalized);

        const mapped = mapCarrier(row[CARRIER_HEADER]);
        if (carrierCounts[mapped] === undefined) {
          carrierCounts["Unknown"]++;
        } else {
          carrierCounts[mapped]++;
        }
      }

      totalContacts = seen.size;

      // lock in value & visual
      contactInput.value = totalContacts;
      updateContactWarning(totalContacts);

      // quick preview
      outputContainer.textContent =
        JSON.stringify({ mode: MODE, totalRows, totalContacts, invalidPhoneRows, duplicateRows, carrierCounts }, null, 2);
    }
  });
});

/*************************************
 * Contact count typing → Manual mode
 *************************************/
contactInput.addEventListener('input', () => {
  const raw = contactInput.value;
  if (raw === "") {
    if (!csvInput.files || csvInput.files.length === 0) {
      setModeNone();
      outputContainer.textContent = "No CSV uploaded yet.";
      contactWarn?.classList.add('hidden');
    }
    return;
  }

  const val = Number(raw);
  if (!Number.isFinite(val) || val < 0) {
    contactWarn?.classList.add('hidden');
    return;
  }

  setModeManual();
  updateContactWarning(val);
  applyManualMix(val);

  // quick preview
  outputContainer.textContent =
    JSON.stringify({ mode: MODE, totalRows, totalContacts, invalidPhoneRows, duplicateRows, carrierCounts }, null, 2);
});

/*************************************
 * Rate-limit determination logic (all 4 carriers)
 *************************************/
function getRateLimit(carrier, messageType, vetting, useCase, taxStatus) {
  carrier = (carrier || "").toLowerCase();
  useCase = (useCase || "").toLowerCase();
  taxStatus = (taxStatus || "").toLowerCase();

  /******** AT&T ********/
  if (carrier === "att" || carrier === "at&t") {
    // Government entities → Top tier (A/B)
    if (taxStatus === "government") {
      return { sms: 4500, mms: 2400, interval: "minute", label: "Government" };
    }

    // Political and Charity use cases override vetting
    if (useCase === "political") {
      return { sms: 4500, mms: 2400, interval: "minute", label: "Political Use Case" };
    }
    if (useCase === "charity") {
      return { sms: 2400, mms: 1200, interval: "minute", label: "Charity Use Case" };
    }

    // Vetting-based standard throughput
    if (vetting >= 75) return { sms: 4500, mms: 2400, interval: "minute", label: "Top Tier" };
    if (vetting >= 50) return { sms: 2400, mms: 1200, interval: "minute", label: "Mid Tier" };
    return { sms: 240, mms: 150, interval: "minute", label: "Low Tier" };
  }

  /******** T-Mobile ********/
  if (carrier === "tmobile" || carrier === "t-mobile") {
    // Political (CV Token) or Government → Uncapped
    if (taxStatus === "cvtoken" || taxStatus === "government") {
      return { all: 100_000_000, interval: "day", label: "Uncapped" };
    }

    // Vetting-based daily caps
    if (vetting >= 75) return { all: 200_000, interval: "day", label: "Top Tier (200k/day)" };
    if (vetting >= 50) return { all: 40_000, interval: "day", label: "High-Mid Tier (40k/day)" };
    if (vetting >= 25) return { all: 10_000, interval: "day", label: "Low-Mid Tier (10k/day)" };
    return { all: 2_000, interval: "day", label: "Low Tier (2k/day)" };
  }

  /******** Verizon ********/
  if (carrier === "verizon") {
    return { sms: 4500, mms: 1200, interval: "minute", label: "Standard Verizon" };
  }

  /******** US Cellular ********/
  if (carrier === "us cellular" || carrier === "united cellular") {
    return { sms: 600, mms: 600, interval: "minute", label: "Standard US Cellular" };
  }

  return null;
}


/*************************************
 * Overview Rendering (Carriers + Rate Limits)
 *************************************/
function renderOverview() {
  // Guard: need either CSV or manual count
  const container = outputContainer;
  if (MODE === "NONE") {
    container.textContent = "Please upload a CSV or enter a contact count.";
    return;
  }

  // --- Carrier Breakdown table (same as before) ---
  const table = document.createElement('table');
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.innerHTML = `
    <thead>
      <tr>
        <th style="text-align:left;border-bottom:1px solid #ddd;padding:8px;">Carrier</th>
        <th style="text-align:right;border-bottom:1px solid #ddd;padding:8px;">Count</th>
        <th style="text-align:right;border-bottom:1px solid #ddd;padding:8px;">Percent</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  ["T-Mobile", "Verizon", "AT&T", "United Cellular", "Unknown"].forEach(name => {
    const count = carrierCounts[name] || 0;
    const pct = totalContacts ? ((count / totalContacts) * 100).toFixed(1) : "0.0";
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;">${name}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:right;">${count.toLocaleString()}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:right;">${pct}%</td>
    `;
    tbody.appendChild(tr);
  });

  const meta = document.createElement('div');
  meta.style.margin = "10px 0 15px 0";
  meta.innerHTML = `
    <div><strong>Mode:</strong> ${MODE}</div>
    <div><strong>Total rows:</strong> ${totalRows.toLocaleString()}</div>
    <div><strong>Unique contacts:</strong> ${totalContacts.toLocaleString()}</div>
    ${MODE === "CSV" ? `
      <div><strong>Invalid phone rows:</strong> ${invalidPhoneRows.toLocaleString()}</div>
      <div><strong>Duplicates filtered:</strong> ${duplicateRows.toLocaleString()}</div>
    ` : `
      <div class="note">Assumptions in use: T-Mobile 37%, Verizon 33%, AT&T 28%, US Cellular 1%, Unknown 1%.</div>
    `}
  `;

  container.innerHTML = "";
  container.appendChild(meta);
  container.appendChild(table);

  // --- Rate Limit Summary (now split: T-Mobile table + Other Carriers table) ---
  const vetting = Number(document.getElementById("vettingScore").value) || 0;
  const useCase = document.getElementById("useCase").value;
  const taxStatus = document.getElementById("taxexemptstatus").value || "n/a";
  const messageType = document.querySelector('input[name="messageType"]:checked')?.value || "sms";

  const rateContainer = document.getElementById("rateLimitOutput");
  rateContainer.innerHTML = "";

  // Table 1: T-Mobile
  const tmobileTable = document.createElement("table");
  tmobileTable.innerHTML = `
    <thead>
      <tr>
        <th>Carrier</th>
        <th>Interval</th>
        <th>Total Limit (segments)</th>
        <th>Initial (95%)</th>
        <th>Replies (5%)</th>
        <th>Label</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tBody = tmobileTable.querySelector("tbody");

  const tRate = getRateLimit("T-Mobile", messageType, vetting, useCase, taxStatus);
  if (tRate) {
    // Handle "Uncapped" display for CV token or government
let totalDisplay, initialDisplay, repliesDisplay;

if (tRate.label.toLowerCase().includes("uncapped")) {
  totalDisplay = "Uncapped";
  initialDisplay = "—";
  repliesDisplay = "—";
} else {
  const total = tRate.all ?? 0;
  const initial = Math.floor(total * 0.95);
  const replies = Math.ceil(total * 0.05);
  totalDisplay = total.toLocaleString();
  initialDisplay = initial.toLocaleString();
  repliesDisplay = replies.toLocaleString();
}

const tr = document.createElement("tr");
tr.innerHTML = `
  <td>T-Mobile</td>
  <td>segments/day</td>
  <td>${totalDisplay}</td>
  <td>${initialDisplay}</td>
  <td>${repliesDisplay}</td>
  <td>${tRate.label}</td>
`;

    tBody.appendChild(tr);
  }
  rateContainer.appendChild(tmobileTable);

  const note = document.createElement("p");
note.className = "note";
note.innerHTML =
  '5% of your T-Mobile limit is reserved for replies to ensure you can respond to users promptly. 95% of the limit is allocated to Initial Messages';
rateContainer.appendChild(note);

const separator = document.createElement("div");
separator.className = "table-separator";
rateContainer.appendChild(separator);


  // Table 2: Other carriers
  const otherTable = document.createElement("table");
  otherTable.style.marginTop = "20px";
  otherTable.innerHTML = `
    <thead>
      <tr>
        <th>Carrier</th>
        <th>Interval</th>
        <th>SMS Limit (segments)</th>
        <th>MMS Limit (segments)</th>
        <th>Label</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const oBody = otherTable.querySelector("tbody");

  ["Verizon", "AT&T", "United Cellular"].forEach(c => {
    const rate = getRateLimit(c, messageType, vetting, useCase, taxStatus);
    if (!rate) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c}</td>
      <td>segments/minute</td>
      <td>${rate.sms?.toLocaleString?.() ?? "-"}</td>
      <td>${rate.mms?.toLocaleString?.() ?? "-"}</td>
      <td>${rate.label}</td>
    `;
    oBody.appendChild(tr);
  });
  rateContainer.appendChild(otherTable);

  // For simulation to use later
  window.__lastOverview = { vetting, useCase, taxStatus, messageType };
}

/*************************************
 * Simulation (Schedule + Rate Limits)
 * - Minimal working version: computes per-day capacity by carrier
 *   using current message type and schedule window.
 *************************************/
function simulateDelivery() {
  const simOut = document.getElementById("simulationOutput");
  simOut.innerHTML = "";

  // Must have carrierCounts & rate limits ready (from overview)
  if (MODE === "NONE" || !window.__lastOverview) {
    simOut.textContent = "Please click “Generate Overview (Carriers + Rate Limits)” first.";
    return;
  }

  const { vetting, useCase, taxStatus, messageType } = window.__lastOverview;

  // Read schedule inputs
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  const open = document.getElementById("openTime").value;
  const close = document.getElementById("closeTime").value;
  const tz = document.getElementById("timezone").value;

  if (!start || !end || !open || !close || !tz) {
    simOut.textContent = "Please complete Timezone, Start/End, and Open/Close times.";
    return;
  }

  // Compute daily open minutes
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  let openMinutes = (ch * 60 + cm) - (oh * 60 + om);
  if (openMinutes <= 0) {
    simOut.textContent = "Daily Close Time must be after Daily Open Time.";
    return;
  }

  // Build a simple capacity table (per day) by carrier
  function perDayCapacity(carrier) {
    const rate = getRateLimit(carrier, messageType, vetting, useCase, taxStatus);
    if (!rate) return 0;

    // T-Mobile: day-based (allocation already shown in overview, but total is what caps sending per day)
    if (carrier === "T-Mobile") {
      return rate.all ?? 0;
    }

    // Minute-based carriers: scale by open window
    const minutesPerDay = openMinutes;
    // SMS/MMS differ for these carriers
    const perMinute = (messageType === "mms") ? (rate.mms ?? 0) : (rate.sms ?? 0);
    return perMinute * minutesPerDay;
  }

  const caps = {
    "T-Mobile": perDayCapacity("T-Mobile"),
    "Verizon": perDayCapacity("Verizon"),
    "AT&T": perDayCapacity("AT&T"),
    "United Cellular": perDayCapacity("United Cellular")
  };

 // Determine how many segments per contact (based on message type)
const segCount = (messageType === "mms")
  ? 1
  : Number(document.getElementById("segmentTotal").textContent) || 1;

// Calculate total segments that need to be delivered per carrier
const needs = {
  "T-Mobile": (carrierCounts["T-Mobile"] || 0) * segCount,
  "Verizon": (carrierCounts["Verizon"] || 0) * segCount,
  "AT&T": (carrierCounts["AT&T"] || 0) * segCount,
  "United Cellular": (carrierCounts["United Cellular"] || 0) * segCount,
  "Unknown": (carrierCounts["Unknown"] || 0) * segCount
};

  // Simple 1-day projection: how many can we send today, and days needed if only using per-day caps
  const rows = [];
  ["T-Mobile", "Verizon", "AT&T", "United Cellular"].forEach(c => {
    const daily = caps[c];
    const backlog = needs[c];
    const daysNeeded = daily > 0 ? Math.ceil(backlog / daily) : (backlog > 0 ? "∞" : 0);
    rows.push({ carrier: c, backlog, daily, daysNeeded });
  });

// ----- Render Simplified Duration Summary -----
const summaryTable = document.createElement("table");
summaryTable.innerHTML = `
  <thead>
    <tr>
      <th>Carrier</th>
      <th>Estimated Delivery Time</th>
    </tr>
  </thead>
  <tbody></tbody>
`;

const tbody = summaryTable.querySelector("tbody");

rows.forEach(r => {
  let durationText = "";

  if (r.carrier === "T-Mobile") {
    const rate = getRateLimit("T-Mobile", messageType, vetting, useCase, taxStatus);
    const isUncapped = rate?.label?.toLowerCase().includes("uncapped");

    if (isUncapped) {
      durationText = "Uncapped";
    } else {
      const days = r.backlog > 0 ? Math.ceil(r.backlog / Math.max(1, r.daily)) : 0;
      durationText = `${days} day${days === 1 ? "" : "s"}`;
    }
  } else {
    const rate = getRateLimit(r.carrier, messageType, vetting, useCase, taxStatus);
    const perMinute = (messageType === "mms") ? (rate?.mms ?? 0) : (rate?.sms ?? 0);

    if (perMinute <= 0) {
      durationText = "∞";
    } else {
      const totalMinutes = Math.ceil(r.backlog / perMinute);
      if (totalMinutes >= 60) {
        const hours = (totalMinutes / 60).toFixed(1);
        durationText = `${hours} hour${hours === "1.0" ? "" : "s"}`;
      } else {
        durationText = `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
      }
    }
  }

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${r.carrier}</td>
    <td>${durationText}</td>
  `;
  tbody.appendChild(tr);
});

simOut.innerHTML = "";
simOut.appendChild(summaryTable);

const note = document.createElement("p");
note.className = "note";
note.innerHTML =
  "T-Mobile throughput is measured in segments per day. Other carriers are per minute during your open window.";
simOut.appendChild(note);


}

/*************************************
 * Wire up buttons
 *************************************/
/*************************************
 * Dynamic Use Case Filtering + Validation
 *************************************/
const taxStatusSelect = document.getElementById("taxexemptstatus");
const useCaseSelect = document.getElementById("useCase");

// Keep the full original list for reset
const allUseCases = Array.from(useCaseSelect.options).map(opt => ({ value: opt.value, text: opt.text }));

taxStatusSelect.addEventListener("change", () => {
  const status = taxStatusSelect.value;
  // Clear current options
  useCaseSelect.innerHTML = "";

  // Always keep the default "Select..." option
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select...";
  useCaseSelect.appendChild(defaultOption);

  // Filter logic
  if (status === "501c3") {
    // 501c3 can register for ANY use case (including Charity)
    filtered = allUseCases.filter(opt => opt.value);
    } else if (status === "cvtoken") {
    // CV Token only shows Political
    filtered = allUseCases.filter(opt => opt.value === "Political");
    } else if (status === "n/a") {
    // For-profit / unverified cannot register Political or Charity
    filtered = allUseCases.filter(opt => !["Political", "Charity"].includes(opt.value) && opt.value);
    } else {
    // Everyone else (501c4, 501c5, 501c6, government): all except Charity
    filtered = allUseCases.filter(opt => opt.value && opt.value !== "Charity");
    }


  // Rebuild options
  for (const opt of filtered) {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.text;
    useCaseSelect.appendChild(option);
  }

  // Reset useCase selection whenever tax status changes
  useCaseSelect.value = "";

  // Handle vetting field behavior for CV token
const vettingContainer = document.querySelector('label[for="vettingScore"]');
const vettingInput = document.getElementById("vettingScore");
const vettingMsg = document.getElementById("vettingMsg");

if (status === "cvtoken") {
  // Disable vetting score and mark visually
  vettingInput.value = "";
  vettingInput.disabled = true;
  vettingInput.classList.add("readonly");
  vettingMsg.classList.add("hidden");

  // Optional: Add note text
  if (!document.getElementById("vettingNote")) {
    const note = document.createElement("p");
    note.id = "vettingNote";
    note.className = "note";
    note.textContent = "Not required for CV token (political) registrations.";
    vettingContainer.insertAdjacentElement("afterend", note);
  }
} else {
  // Re-enable vetting score
  vettingInput.disabled = false;
  vettingInput.classList.remove("readonly");

  // Remove note if present
  const note = document.getElementById("vettingNote");
  if (note) note.remove();
}

});


/*************************************
 * Validation before running overview
 *************************************/
document.getElementById("generateOverview").addEventListener("click", () => {
  const csvProvided = csvInput.files?.length > 0;
  const manualProvided = contactInput.value && Number(contactInput.value) > 0;
  const taxStatus = taxStatusSelect.value;
  const vettingScore = vettingInput.value;
  const useCase = useCaseSelect.value;

  let errors = [];

  if (!csvProvided && !manualProvided) {
    errors.push("Please upload a CSV or enter a contact count.");
  }

  if (!taxStatus) {
    errors.push("Please select a Tax Exempt Status.");
  }

  const vetNum = Number(vettingScore);
    if (taxStatus !== "cvtoken") {
    if (!vettingScore || isNaN(vetNum) || vetNum < 0 || vetNum > 100) {
        errors.push("Please enter a valid Vetting Score (0–100).");
    }
    }

  if (!useCase) {
    errors.push("Please select a Use Case.");
  }

  if (errors.length > 0) {
    alert(errors.join("\n"));
    return;
  }

  // All checks passed → run overview
  renderOverview();
});

document.getElementById("runTimeline").addEventListener("click", simulateDelivery);

/*************************************
 * Default start/end date and time
 *************************************/
document.addEventListener("DOMContentLoaded", () => {
  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");

  if (startInput && endInput) {
    const now = new Date();

    // Today at 9 AM
    const start = new Date(now);
    start.setHours(9, 0, 0, 0);

    // Tomorrow at 9 PM
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    end.setHours(21, 0, 0, 0);

    // Format as YYYY-MM-DDTHH:mm
    const toLocalInputValue = (date) => {
      const pad = (n) => n.toString().padStart(2, "0");
      const yyyy = date.getFullYear();
      const mm = pad(date.getMonth() + 1);
      const dd = pad(date.getDate());
      const hh = pad(date.getHours());
      const min = pad(date.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    };

    startInput.value = toLocalInputValue(start);
    endInput.value = toLocalInputValue(end);
  }
});

