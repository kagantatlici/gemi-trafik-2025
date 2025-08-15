/*********************
 CONFIGURATION
*********************/
const FILTER_SETS = [
  { 
    name: "Kuzey-Güney_Planlı",
    params: { Strait: "I", Direction: "NS", Movement: "YP" } 
  },
  { 
    name: "Kuzey-Güney_Hazır", 
    params: { Strait: "I", Direction: "NS", Movement: "YG" } 
  },
  { 
    name: "Güney-Kuzey_Planlı",
    params: { Strait: "I", Direction: "SN", Movement: "YP" } 
  },
  { 
    name: "Güney-Kuzey_Hazır",
    params: { Strait: "I", Direction: "SN", Movement: "YG" } 
  }
];

/*********************
 MAIN FUNCTIONS
*********************/
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('İstanbul Boğazı Gemi Trafik Durumu')
    .setFaviconUrl('https://www.kiyiemniyeti.gov.tr/favicon.ico');
}

function fetchAllShipData() {
  const start = new Date().getTime(); // süre ölçümü opsiyonel

  // UrlFetchApp.fetchAll için istekleri hazırla
  const requests = FILTER_SETS.map(filter => ({
    url: "https://www.kiyiemniyeti.gov.tr/gemi_trafik_bilgi_sistemleri",
    method: "post",
    payload: { ...filter.params, submitted: "1" },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    muteHttpExceptions: true
  }));

  // Paralel fetch
  const responses = UrlFetchApp.fetchAll(requests);
  const allResults = {};

  responses.forEach((response, index) => {
    const filter = FILTER_SETS[index];
    try {
      const html = response.getContentText();
      const data = parseHTMLTable(html);
      allResults[filter.name] = formatData(data);
    } catch (e) {
      Logger.log(`❌ ${filter.name} failed: ${e}`);
      allResults[filter.name] = { error: e.toString() };
    }
  });

  const stats = generateDashboardStats(allResults);

  const end = new Date().getTime();
  Logger.log("⏱ Toplam fetchAllShipData süresi: " + (end - start) + " ms"); // opsiyonel

  return {
    stats: stats,
    detailedData: allResults,
    lastUpdate: Utilities.formatDate(new Date(), "Europe/Istanbul", "dd.MM.yyyy HH:mm")
  };
}

/*********************
 DATA FORMATTING & STATS
*********************/
function formatData(data) {
  if (data.length === 0) return [];
  return data.map(row => ({
    planlama: decodeHtmlEntities(row[1]),
    gemiAdi: row[2],
    boy: parseFloat(row[3].replace(',','.')),
    gemiTipi: row[4],
    kilavuz: row[5].toLowerCase().includes("evet"),
    romorkor: row[6].toLowerCase().includes("evet"),
    sp2: row[7],
    sp1: row[8]
  }));
}

function generateDashboardStats(results) {
  const stats = {
    guney: { planli: {}, hazir: {} },
    kuzey: { planli: {}, hazir: {} }
  };

  FILTER_SETS.forEach(filter => {
    const data = results[filter.name] || [];
    if (Array.isArray(data)) {
      const direction = filter.name.startsWith("Güney") ? "guney" : "kuzey";
      const type = filter.name.includes("Planlı") ? "planli" : "hazir";

      stats[direction][type] = {
        total: data.length,
        kilavuzlu: data.filter(row => row.kilavuz).length,
        kilavuzsuz: data.filter(row => !row.kilavuz).length,
        gunduzcu: data.filter(row => isDaytimeOnlyShip(row)).length
      };
    }
  });

  return stats;
}

/*********************
 CORE LOGIC
*********************/
function isDaytimeOnlyShip(row) {
  const length = row.boy || 0;
  const type = (row.gemiTipi || "").toUpperCase();
  return (isTanker(type) && length >= 200) || length >= 250;
}

function isTanker(shipType) {
  const tankerKeywords = ["TANKER", "TANK", "PETROL", "CHEMICAL", "GAS", "OIL"];
  return tankerKeywords.some(keyword => shipType.includes(keyword));
}

function parseHTMLTable(html) {
  const tableStart = html.indexOf('<table class="table no-margin table-striped filterable dataTable">');
  if (tableStart === -1) throw new Error("Table not found");

  const tableEnd = html.indexOf('</table>', tableStart) + 8;
  return (html.substring(tableStart, tableEnd).match(/<tr>.*?<\/tr>/gs) || [])
    .filter(row => row.includes('<td'))
    .map(row => (row.match(/<td.*?>(.*?)<\/td>/gs) || [])
      .map(cell => cell.replace(/<[^>]+>/g, '').trim()));
}

/*********************
 UTILITIES
*********************/
function decodeHtmlEntities(text) {
  const entities = {
    '&#199;': 'Ç', '&#231;': 'ç', '&#286;': 'Ğ', '&#287;': 'ğ',
    '&#304;': 'İ', '&#305;': 'ı', '&#214;': 'Ö', '&#246;': 'ö',
    '&#350;': 'Ş', '&#351;': 'ş', '&#220;': 'Ü', '&#252;': 'ü'
  };
  return text.replace(/&#?\w+;/g, match => entities[match] || match);
}
