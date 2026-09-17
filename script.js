let leads = [];

const table = document.getElementById("leadTable");
const fileInput = document.getElementById("csvFile");
const searchInput = document.getElementById("searchInput");
const scoreFilter = document.getElementById("scoreFilter");

fileInput.addEventListener("change", loadCSV);
searchInput.addEventListener("input", render);
scoreFilter.addEventListener("change", render);
document.getElementById("exportBtn").addEventListener("click", exportCSV);


// -------------------------
// CSV IMPORT
// -------------------------

function loadCSV(event) {

  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = e => {

    const rows = parseCSV(e.target.result);

    if (rows.length < 2) {
      alert("No property records found.");
      return;
    }

    const headers =
      rows[0].map(x => x.trim().toLowerCase());

    leads = rows.slice(1)
      .filter(row => row.some(value => value.trim()))
      .map(row => createLead(headers, row))
      .filter(lead => {
        const location =
          `${lead.address} ${lead.city} ${lead.zip}`.toLowerCase();

        return (
          lead.zip.includes("70433") ||
          location.includes("covington")
        );
      });

    render();

  };

  reader.readAsText(file);
}


// -------------------------
// BASIC CSV PARSER
// -------------------------

function parseCSV(text) {

  const rows = [];
  let row = [];
  let field = "";
  let quotes = false;

  for (let i = 0; i < text.length; i++) {

    const char = text[i];

    if (char === '"') {

      if (quotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quotes = !quotes;
      }

    } else if (char === "," && !quotes) {

      row.push(field);
      field = "";

    } else if (
      (char === "\n" || char === "\r") &&
      !quotes
    ) {

      if (char === "\r" && text[i + 1] === "\n") i++;

      row.push(field);

      if (row.some(value => value.trim())) {
        rows.push(row);
      }

      row = [];
      field = "";

    } else {

      field += char;

    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}


// -------------------------
// COLUMN MATCHING
// -------------------------

function getValue(headers, row, names) {

  for (const name of names) {

    const index =
      headers.findIndex(header =>
        header === name ||
        header.includes(name)
      );

    if (index !== -1) {
      return (row[index] || "").trim();
    }

  }

  return "";
}


// -------------------------
// CREATE LEAD
// -------------------------

function createLead(headers, row) {

  const lead = {

    owner: getValue(
      headers,
      row,
      ["owner name", "owner", "taxpayer"]
    ),

    address: getValue(
      headers,
      row,
      [
        "property address",
        "physical address",
        "site address",
        "address"
      ]
    ),

    city: getValue(
      headers,
      row,
      ["city"]
    ),

    zip: getValue(
      headers,
      row,
      ["zip", "zipcode", "postal"]
    ),

    yearBuilt: Number(
      getValue(
        headers,
        row,
        ["year built", "yearbuilt", "built"]
      )
    ) || 0,

    acres: Number(
      getValue(
        headers,
        row,
        ["acres", "acreage"]
      )
    ) || 0,

    propertyType: getValue(
      headers,
      row,
      [
        "property type",
        "use description",
        "class"
      ]
    ),

    improvementValue: Number(
      cleanNumber(
        getValue(
          headers,
          row,
          [
            "improvement value",
            "improvements",
            "building value"
          ]
        )
      )
    ) || 0

  };

  const result = calculateScore(lead);

  lead.score = result.score;
  lead.service = result.service;
  lead.reason = result.reason;

  return lead;
}


function cleanNumber(value) {

  return value.replace(/[$,\s]/g, "");

}


// -------------------------
// LEAD SCORING
// -------------------------

function calculateScore(property) {

  let score = 40;
  const reasons = [];
  const services = [];

  const currentYear =
    new Date().getFullYear();

  if (property.yearBuilt) {

    const age =
      currentYear - property.yearBuilt;

    if (age >= 30) {
      score += 20;
      reasons.push("Older property");
    }

    else if (age >= 15) {
      score += 12;
      reasons.push("Established property");
    }

  }


  if (property.acres >= .5) {

    score += 8;

    reasons.push(
      "Larger property footprint"
    );

  }


  if (property.improvementValue >= 200000) {

    score += 7;

    reasons.push(
      "Substantial improvements"
    );

  }


  const type =
    property.propertyType.toLowerCase();

  if (
    type.includes("residential") ||
    type.includes("single") ||
    type.includes("home")
  ) {

    score += 10;

    reasons.push(
      "Residential property"
    );

  }


  // Covington-specific service opportunities.
  // These are suggestions, not claims about condition.

  services.push("House Soft Wash");

  if (property.acres >= .25) {
    services.push("Driveway Cleaning");
  }

  if (
    property.yearBuilt &&
    currentYear - property.yearBuilt >= 15
  ) {
    services.push("Gutter Cleaning");
  }

  if (
    property.yearBuilt &&
    currentYear - property.yearBuilt >= 20
  ) {
    services.push("Roof Treatment");
  }


  score = Math.min(score, 100);

  return {

    score,

    service:
      services.join(" + "),

    reason:
      reasons.length
        ? reasons.join(", ")
        : "General exterior-cleaning opportunity"

  };

}


// -------------------------
// DISPLAY
// -------------------------

function render() {

  const search =
    searchInput.value.toLowerCase();

  const minimum =
    Number(scoreFilter.value);

  const filtered =
    leads
      .filter(lead =>
        lead.score >= minimum
      )
      .filter(lead => {

        const text =
          `${lead.owner} ${lead.address} ${lead.city}`
            .toLowerCase();

        return text.includes(search);

      })
      .sort((a, b) =>
        b.score - a.score
      );


  table.innerHTML = "";


  filtered.forEach(lead => {

    const row =
      document.createElement("tr");

    const scoreClass =
      lead.score >= 80
        ? "hot"
        : lead.score >= 65
        ? "warm"
        : "cool";


    row.innerHTML = `

      <td class="score ${scoreClass}">
        ${escapeHTML(lead.score)}/100
      </td>

      <td>
        ${escapeHTML(lead.owner || "Unknown")}
      </td>

      <td>
        <strong>${escapeHTML(lead.address)}</strong><br>
        <small>
          ${escapeHTML(lead.city)}
          ${escapeHTML(lead.zip)}
        </small>
      </td>

      <td>
        ${escapeHTML(lead.service)}
      </td>

      <td>
        ${escapeHTML(lead.reason)}
      </td>

    `;

    table.appendChild(row);

  });


  updateStats(filtered);

}


// -------------------------
// STATS
// -------------------------

function updateStats(data) {

  document.getElementById("totalCount")
    .innerText = data.length;

  const hot =
    data.filter(x => x.score >= 80);

  document.getElementById("hotCount")
    .innerText = hot.length;

  const average =
    data.length
      ? Math.round(
          data.reduce(
            (sum, x) => sum + x.score,
            0
          ) / data.length
        )
      : 0;

  document.getElementById("avgScore")
    .innerText = average;

}


// -------------------------
// EXPORT
// -------------------------

function exportCSV() {

  if (!leads.length) {

    alert("Upload property data first.");

    return;

  }

  const headers = [
    "Lead Score",
    "Owner",
    "Property Address",
    "City",
    "ZIP",
    "Suggested Service",
    "Opportunity Reason"
  ];


  const rows =
    leads
      .sort((a, b) =>
        b.score - a.score
      )
      .map(x => [

        x.score,
        x.owner,
        x.address,
        x.city,
        x.zip,
        x.service,
        x.reason

      ]);


  const csv =
    [headers, ...rows]
      .map(row =>
        row
          .map(csvEscape)
          .join(",")
      )
      .join("\n");


  const blob =
    new Blob(
      [csv],
      { type: "text/csv" }
    );


  const url =
    URL.createObjectURL(blob);


  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    "covington-70433-cleaning-leads.csv";

  link.click();

  URL.revokeObjectURL(url);

}


// -------------------------
// SECURITY / FORMATTING
// -------------------------

function escapeHTML(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function csvEscape(value) {

  const text =
    String(value ?? "");

  return `"${text.replaceAll('"', '""')}"`;

}
