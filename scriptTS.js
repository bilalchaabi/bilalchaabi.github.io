/*************************************
 * DEV MODE (auto-fill form for testing)
 *************************************/
const DEV_MODE = false; // change to true only when testing

if (DEV_MODE) {
  window.addEventListener("DOMContentLoaded", () => {
    // Pre-fill form fields for faster testing
    document.getElementById("contactCount").value = 1000;
    document.getElementById("taxexemptstatus").value = "501c3";
    document.getElementById("vettingScore").value = 23;
    document.getElementById("useCase").value = "Political";
    document.getElementById("mmsType").checked = true;

    // Manual mix preview
    applyManualMix(1000);

    // Generate split outputs with new buttons
    // generateCarrierBreakdown();
    // generateRateLimitSummary();

    // Set schedule defaults (these inputs exist)
    const now = new Date();
    const start = new Date(now); start.setHours(9, 0, 0, 0);
    const end   = new Date(now); end.setDate(end.getDate() + 1); end.setHours(21, 0, 0, 0);
    const toLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

    document.getElementById("startDate").value = toLocal(start);
    document.getElementById("endDate").value = toLocal(end);
    document.getElementById("openTime").value = "09:00";
    document.getElementById("closeTime").value = "21:00";
    // Default actual send start to the campaign start:
    document.getElementById("sendStartTime").value = toLocal(start);

    // Run the simulation
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
  { name: "US Cellular", pct: 0.01 },
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
  if (c.includes("united states cellular") || c.includes("us cellular")) return "US Cellular";
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
let carrierCounts = { "AT&T": 0, "T-Mobile": 0, "Verizon": 0, "US Cellular": 0, "Unknown": 0 };
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
  carrierCounts = { "AT&T": 0, "T-Mobile": 0, "Verizon": 0, "US Cellular": 0, "Unknown": 0 };

  // 🟢 Try reading editable mix values, fallback to MANUAL_MIX if not found
  const inputs = {
    "T-Mobile": document.getElementById("mixTmo"),
    "Verizon": document.getElementById("mixVz"),
    "AT&T": document.getElementById("mixAtt"),
    "US Cellular": document.getElementById("mixUs"),
    "Unknown": document.getElementById("mixUnk")
  };

  // If inputs exist, read values
  const hasInputs = Object.values(inputs).every(el => el !== null);
  let mixValues = [];

  if (hasInputs) {
    const values = Object.entries(inputs).map(([name, el]) => ({
      name,
      value: Number(el.value) || 0
    }));

    // Calculate total entered percentage
    const totalPct = values.reduce((sum, v) => sum + v.value, 0) || 100;

    // Normalize to sum = 1.0
    mixValues = values.map(v => ({
      name: v.name,
      pct: v.value / totalPct
    }));
  } else {
    // fallback if mix panel isn’t loaded
    mixValues = MANUAL_MIX;
  }

  // --- Compute carrier counts based on normalized mix
  let assigned = 0;
  const parts = mixValues.map(m => {
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
  totalRows = total;
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

    // Disable Advanced Carrier Mix when CSV is used
  const mixSection = document.querySelector(".advanced-mix");
  if (mixSection) mixSection.classList.add("mix-disabled");


  carrierCounts = { "AT&T": 0, "T-Mobile": 0, "Verizon": 0, "US Cellular": 0, "Unknown": 0 };
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

      // 🧩 Debug line — log raw values that map to "Unknown"
      if (mapped === "Unknown") {
        console.log("Unknown carrier raw value:", row[CARRIER_HEADER]);
      }

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

      // Keep output placeholder until user generates overview
      outputContainer.textContent = "Please upload a CSV or enter a contact count.";
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

    // Re-enable Advanced Carrier Mix when using manual mode
  const mixSection = document.querySelector(".advanced-mix");
  if (mixSection) mixSection.classList.remove("mix-disabled");

  updateContactWarning(val);
  applyManualMix(val);

  outputContainer.textContent = "Please upload a CSV or enter a contact count.";
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
  if (carrier === "us cellular" || carrier === "US Cellular") {
    return { sms: 600, mms: 600, interval: "minute", label: "Standard US Cellular" };
  }

  return null;
}


/*************************************
 * Overview Rendering (Carriers + Rate Limits)
 *************************************/
function generateCarrierBreakdown() {
  const container = document.getElementById("carrierOutput");

  // 🔄 Always refresh manual mix if in MANUAL mode
  if (MODE === "MANUAL") {
    const val = Number(contactInput.value);
    if (Number.isFinite(val) && val > 0) {
      applyManualMix(val);
    }
  }

  if (MODE === "NONE") {
    container.textContent = "Please upload a CSV or enter a contact count.";
    return;
  }


  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Carrier</th>
        <th>Count</th>
        <th>Percent</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  ["T-Mobile", "Verizon", "AT&T", "US Cellular", "Unknown"].forEach(name => {
    const count = carrierCounts[name] || 0;
    const pct = totalContacts ? ((count / totalContacts) * 100).toFixed(1) : "0.0";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td style="text-align:right;">${count.toLocaleString()}</td>
      <td style="text-align:right;">${pct}%</td>
    `;
    tbody.appendChild(tr);
  });

  const meta = document.createElement("div");
  meta.innerHTML = `
  <div><strong>Mode:</strong> ${MODE}</div>
  <div><strong>Total Rows:</strong> ${totalRows.toLocaleString()}</div>
  <div><strong>Unique Contacts:</strong> ${totalContacts.toLocaleString()}</div>
  ${
    MODE === "CSV"
      ? `<div><strong>Invalid phone rows:</strong> ${invalidPhoneRows}</div>
         <div><strong>Duplicates filtered:</strong> ${duplicateRows}</div>`
      : (() => {
          const tmo = document.getElementById("mixTmo")?.value || 37;
          const vz  = document.getElementById("mixVz")?.value || 33;
          const att = document.getElementById("mixAtt")?.value || 28;
          const us  = document.getElementById("mixUs")?.value || 1;
          const unk = document.getElementById("mixUnk")?.value || 1;
          return `<div class="note">Mix used: T-Mobile ${tmo}%, Verizon ${vz}%, AT&T ${att}%, US Cellular ${us}%, Unknown ${unk}%</div>`;
        })()
  }
`;


  container.innerHTML = "";
  container.appendChild(meta);
  container.appendChild(table);
}

function generateRateLimitSummary() {
  const vettingInput = document.getElementById("vettingScore");
  const useCaseInput = document.getElementById("useCase");
  const taxStatusInput = document.getElementById("taxexemptstatus");

  const vetting = Number(vettingInput.value);
  const useCase = useCaseInput.value;
  const taxStatus = taxStatusInput.value;

  // --- Validation checks ---
  if (!taxStatus || taxStatus === "") {
    alert("Please select a Tax Exempt Status before generating rate limits.");
    return;
  }

  if (vettingInput.value.trim() === "") {
  alert("Please enter a Vetting Score before generating rate limits.");
  vettingInput.focus();
  return;
}

if (isNaN(vetting) || vetting < 0 || vetting > 100) {
  alert("Vetting Score must be a number between 0 and 100.");
  vettingInput.focus();
  return;
}


  if (!useCase || useCase === "") {
    alert("Please select a Use Case before generating rate limits.");
    useCaseInput.focus();
    return;
  }

  // Continue as before
  const messageType =
    document.querySelector('input[name="messageType"]:checked')?.value || "sms";
  const rateContainer = document.getElementById("rateLimitOutput");
  rateContainer.innerHTML = "";


  // T-Mobile rate table
  const tmobileTable = document.createElement("table");
  tmobileTable.innerHTML = `
    <thead>
      <tr>
        <th>Carrier</th>
        <th>Interval</th>
        <th>Total Limit</th>
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
    let totalDisplay, initialDisplay, repliesDisplay;
    if (tRate.label.toLowerCase().includes("uncapped")) {
      totalDisplay = "Uncapped";
      initialDisplay = "—";
      repliesDisplay = "—";
    } else {
      const total = tRate.all ?? 0;
      totalDisplay = total.toLocaleString();
      initialDisplay = Math.floor(total * 0.95).toLocaleString();
      repliesDisplay = Math.ceil(total * 0.05).toLocaleString();
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

  // Note under T-Mobile table
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "5% reserved for replies, 95% for initial messages.";
  rateContainer.appendChild(note);

  // Separator line
  const separator = document.createElement("div");
  separator.className = "table-separator";
  rateContainer.appendChild(separator);

  // Other Carriers table
  const otherTable = document.createElement("table");
  otherTable.innerHTML = `
    <thead>
      <tr>
        <th>Carrier</th>
        <th>Interval</th>
        <th>SMS Limit</th>
        <th>MMS Limit</th>
        <th>Label</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const oBody = otherTable.querySelector("tbody");

  ["Verizon", "AT&T", "US Cellular"].forEach(c => {
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

  // Store state for simulation
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

  if (MODE === "NONE" || !window.__lastOverview) {
    simOut.textContent = "Please generate carrier breakdown and rate limits first.";
    return;
  }

  const { vetting, useCase, taxStatus } = window.__lastOverview;
  const messageType = document.querySelector('input[name="messageType"]:checked')?.value || "sms";
  window.__lastOverview.messageType = messageType;

  // --- Schedule Inputs ---
  const start = new Date(document.getElementById("startDate").value);
  const end = new Date(document.getElementById("endDate").value);
  const sendStart = new Date(document.getElementById("sendStartTime").value);
  const open = document.getElementById("openTime").value;
  const close = document.getElementById("closeTime").value;

  if (!start || !end || !sendStart || !open || !close || isNaN(start) || isNaN(end) || isNaN(sendStart)) {
    simOut.textContent = "Please complete all schedule fields, including Actual Send Start Time.";
    return;
  }

  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const openMinutes = ch * 60 + cm - (oh * 60 + om);
  if (openMinutes <= 0) {
    simOut.textContent = "Daily Close Time must be after Daily Open Time.";
    return;
  }

  // --- Determine message segment count ---
  updateSegmentStats();
  const text = document.getElementById("initialMessage").value || "";
  let segmentsPerMessage = messageType === "mms" ? 1 : getSegmentStats(text).segmentCount || 1;

  // --- Calculate messages needed per carrier ---
  const needs = {};
  Object.keys(carrierCounts).forEach(c => {
    needs[c] = (carrierCounts[c] || 0) * segmentsPerMessage;
  });

  // --- Per-day capacity per carrier ---
  function perDayCapacity(carrier) {
    const rate = getRateLimit(carrier, messageType, vetting, useCase, taxStatus);
    if (!rate) return 0;

    if (carrier === "T-Mobile") {
      if (rate.label.toLowerCase().includes("uncapped")) return rate.all ?? 0;
      return Math.floor((rate.all ?? 0) * 0.95);
    }

    const perMinute = messageType === "mms" ? (rate.mms ?? 0) : (rate.sms ?? 0);
    return perMinute * openMinutes;
  }

  const caps = {
    "T-Mobile": perDayCapacity("T-Mobile"),
    "Verizon": perDayCapacity("Verizon"),
    "AT&T": perDayCapacity("AT&T"),
    "US Cellular": perDayCapacity("US Cellular")
  };

  // --- Simulation Loop ---
  const results = [];
  const current = new Date(sendStart);
  const lastDate = new Date(end);

  // Helper to compute minutes remaining in first day
  function minutesRemainingFirstDay() {
    const openStart = new Date(current);
    openStart.setHours(oh, om, 0, 0);
    const closeEnd = new Date(current);
    closeEnd.setHours(ch, cm, 0, 0);
    if (current < openStart) return openMinutes; // started before open
    if (current > closeEnd) return 0; // after close
    return Math.max(0, (closeEnd - current) / 60000);
  }

  const remaining = { ...needs };
  let dayIndex = 0;

  while (current <= lastDate && Object.values(remaining).some(v => v > 0)) {
  const dayLabel = current.toLocaleDateString();

  const sent = {};
  const queued = {};
  const failed = {};

  for (const carrier of Object.keys(remaining)) {
    // 🟢 Only T-Mobile ignores actual send start time
    const effectiveAvailableMinutes =
      carrier === "T-Mobile"
        ? openMinutes
        : dayIndex === 0
          ? minutesRemainingFirstDay()
          : openMinutes;

    const dailyCap = caps[carrier];
    const canSend = Math.min(dailyCap * (effectiveAvailableMinutes / openMinutes), remaining[carrier]);
    sent[carrier] = Math.floor(canSend);
    remaining[carrier] -= sent[carrier];

    queued[carrier] = remaining[carrier] > 0 ? remaining[carrier] : 0;
    failed[carrier] = 0;
  }

  results.push({ dayLabel, sent, queued, failed });
  current.setDate(current.getDate() + 1);
  current.setHours(oh, om, 0, 0);
  dayIndex++;
  }

  // After loop, mark anything unsent as failed
  for (const carrier of Object.keys(remaining)) {
    if (remaining[carrier] > 0) {
      const last = results[results.length - 1];
      last.failed[carrier] = remaining[carrier];
    }
  }

  // --- Add overall duration summary ---
const summary = document.createElement("div");
summary.innerHTML = "<h3>Estimated Total Duration by Carrier</h3>";

const durationTable = document.createElement("table");
durationTable.innerHTML = `
  <thead>
    <tr>
      <th>Carrier</th>
      <th>Estimated Delivery Time</th>
      <th>Details</th>
    </tr>
  </thead>
  <tbody></tbody>
`;

const sBody = durationTable.querySelector("tbody");

// Build quick per-carrier duration estimate
["T-Mobile", "Verizon", "AT&T", "US Cellular"].forEach(c => {
  const backlog = needs[c];
  const daily = caps[c];
  let durationText = "";
  let debugText = "";

  if (c === "T-Mobile") {
    const rate = getRateLimit("T-Mobile", messageType, vetting, useCase, taxStatus);
    const isUncapped = rate?.label?.toLowerCase().includes("uncapped");
    if (isUncapped) {
      durationText = "Uncapped";
      debugText = "N/A";
    } else {
      const days = backlog > 0 ? Math.ceil(Number(backlog) / Math.max(1, Number(daily))) : 0;
      durationText = `${days} day${days === 1 ? "" : "s"}`;
      debugText = `${backlog.toLocaleString()} ÷ ${daily.toLocaleString()} = ${(backlog / daily).toFixed(2)}`;
    }
  } else {
    const rate = getRateLimit(c, messageType, vetting, useCase, taxStatus);
    const perMinute = messageType === "mms" ? (rate?.mms ?? 0) : (rate?.sms ?? 0);
    if (perMinute <= 0) {
      durationText = "∞";
      debugText = "No capacity rate found";
    } else {
      const totalMinutes = Math.ceil(backlog / perMinute);
      if (totalMinutes >= 60) {
        const hours = (totalMinutes / 60).toFixed(1);
        durationText = `${hours} hour${hours === "1.0" ? "" : "s"}`;
      } else {
        durationText = `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
      }
      debugText = `${backlog.toLocaleString()} ÷ ${perMinute.toLocaleString()} = ${(backlog / perMinute).toFixed(2)}`;
    }
  }

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${c}</td>
    <td>${durationText}</td>
    <td style="text-align:right;">${debugText}</td>
  `;
  sBody.appendChild(tr);
});

// --- Render Results ---



// Wrap duration table in scrollable container
const durationWrapper = document.createElement("div");
durationWrapper.className = "table-wrapper";
durationWrapper.appendChild(durationTable);
summary.appendChild(durationWrapper);
simOut.appendChild(summary);


// Add space and a subheading before day-by-day simulation
const spacer = document.createElement("div");
spacer.style.margin = "20px 0";
simOut.appendChild(spacer);

const dayHeader = document.createElement("h3");
dayHeader.textContent = "Daily Delivery Simulation";
simOut.appendChild(dayHeader);

// Now build the day-by-day table
const summaryTable = document.createElement("table");
summaryTable.innerHTML = `
  <thead>
    <tr>
      <th>Date</th>
      <th>Carrier</th>
      <th>Sent</th>
      <th>Queued</th>
      <th>Failed</th>
    </tr>
  </thead>
  <tbody></tbody>
`;

const tbody = summaryTable.querySelector("tbody");
const carrierOrder = ["T-Mobile", "Verizon", "AT&T", "US Cellular", "Unknown"];

for (const r of results) {
  for (const carrier of carrierOrder) {
    if (!(carrier in r.sent)) continue; // skip carriers not present
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.dayLabel}</td>
      <td>${carrier}</td>
      <td>${r.sent[carrier].toLocaleString()}</td>
      <td>${r.queued[carrier].toLocaleString()}</td>
      <td>${r.failed[carrier].toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  }
}


const dailyWrapper = document.createElement("div");
dailyWrapper.className = "table-wrapper";
dailyWrapper.appendChild(summaryTable);
simOut.appendChild(dailyWrapper);



  const note = document.createElement("p");
  note.className = "note";
  note.innerHTML = `
    <strong>Actual Send Start:</strong> ${new Date(sendStart).toLocaleString()}<br>
    Messages unsent after ${new Date(end).toLocaleString()} are marked as <strong>failed</strong>.
  `;
  simOut.appendChild(note);
}

/*************************************
 * Dynamic Use Case & Vetting Logic
 *************************************/
document.addEventListener("DOMContentLoaded", () => {
  const taxSelect = document.getElementById("taxexemptstatus");
  const useCaseSelect = document.getElementById("useCase");
  const vettingInput = document.getElementById("vettingScore");

  // Store original dropdown options from HTML
  const allOptions = Array.from(useCaseSelect.querySelectorAll("option")).map(opt => ({
    value: opt.value,
    text: opt.textContent
  }));

  function updateUseCaseOptions() {
    const tax = taxSelect.value;
    const currentSelection = useCaseSelect.value;

    // Keep the original "Select..." option only once
    const baseOption = allOptions.find(o => o.value === "" || o.text.toLowerCase().includes("select"));
    useCaseSelect.innerHTML = "";
    if (baseOption) {
      const opt = document.createElement("option");
      opt.value = baseOption.value;
      opt.textContent = baseOption.text;
      useCaseSelect.appendChild(opt);
    }

    let allowed = [];

    if (tax === "501c3") {
      // ✅ 501c3 shows all use cases
      allowed = allOptions.filter(o => o.value && o.text !== baseOption.text);
      vettingInput.disabled = false;
      vettingInput.value = "";
    } else if (tax === "cvtoken") {
      // ✅ CV token → Political only + disable vetting
      allowed = allOptions.filter(o => o.text === "Political");
      vettingInput.disabled = true;
      vettingInput.value = "";
    } else if (tax === "n/a") {
      // ✅ N/A → hide Political and Charity
      allowed = allOptions.filter(o => o.text !== "Political" && o.text !== "Charity" && o.value);
      vettingInput.disabled = false;
      vettingInput.value = "";
    } else {
      // ✅ All others → hide Charity
      allowed = allOptions.filter(o => o.text !== "Charity" && o.value);
      vettingInput.disabled = false;
      vettingInput.value = "";
    }

    // Add filtered options
    allowed.forEach(optData => {
      const opt = document.createElement("option");
      opt.value = optData.value;
      opt.textContent = optData.text;
      useCaseSelect.appendChild(opt);
    });

    // Reset selection if now invalid
    const validValues = Array.from(useCaseSelect.options).map(o => o.value);
    if (!validValues.includes(currentSelection)) {
      useCaseSelect.value = "";
    }
  }

  taxSelect.addEventListener("change", updateUseCaseOptions);
});

/*************************************
 * Advanced Carrier Mix Toggle & Logic
 *************************************/
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("toggleMix");
  const mixPanel = document.getElementById("mixPanel");
  const inputs = [
    document.getElementById("mixTmo"),
    document.getElementById("mixVz"),
    document.getElementById("mixAtt"),
    document.getElementById("mixUs"),
    document.getElementById("mixUnk")
  ];
  const totalEl = document.getElementById("mixTotal");

  // Toggle panel open/close
  toggleBtn.addEventListener("click", () => {
    const isHidden = mixPanel.classList.contains("hidden");
    mixPanel.classList.toggle("hidden");
    toggleBtn.textContent = isHidden
      ? "Advanced Carrier Mix (optional) ▲"
      : "Advanced Carrier Mix (optional) ▼";
  });

  // Update total dynamically
  function updateTotal() {
    const total = inputs.reduce((sum, el) => sum + Number(el.value || 0), 0);
    totalEl.textContent = `${total.toFixed(1)} %`;
    totalEl.style.color = total === 100 ? "green" : "red";
  }

  inputs.forEach(i => i.addEventListener("input", updateTotal));
  updateTotal(); // initialize total on load
});


/*************************************
 * Button Event Listeners
 *************************************/
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("generateCarrierMix")
    .addEventListener("click", generateCarrierBreakdown);

  document.getElementById("generateRateLimits")
    .addEventListener("click", generateRateLimitSummary);

  document.getElementById("runTimeline")
    .addEventListener("click", simulateDelivery);
});


/*************************************
 * Default start/end/send date and time
 *************************************/
document.addEventListener("DOMContentLoaded", () => {
  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");
  const sendStartInput = document.getElementById("sendStartTime");

  if (startInput && endInput && sendStartInput) {
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

    // Set default values
    const startValue = toLocalInputValue(start);
    startInput.value = startValue;
    endInput.value = toLocalInputValue(end);

    // 🟢 Set Actual Send Start to match Start Date
    sendStartInput.value = startValue;
  }
});
