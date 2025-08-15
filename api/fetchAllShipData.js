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
 MAIN FUNCTION
*********************/
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await fetchAllShipData();
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in fetchAllShipData:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message });
  }
}

async function fetchAllShipData() {
  const start = new Date().getTime();

  // Prepare requests for parallel fetch
  const requests = FILTER_SETS.map(filter => ({
    url: "https://www.kiyiemniyeti.gov.tr/gemi_trafik_bilgi_sistemleri",
    method: "POST",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0'
    },
    body: new URLSearchParams({
      ...filter.params,
      submitted: "1"
    }).toString()
  }));

  // Parallel fetch
  const responses = await Promise.all(
    requests.map(request => 
      fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body
      })
    )
  );

  const allResults = {};

  for (let i = 0; i < responses.length; i++) {
    const response = responses[i];
    const filter = FILTER_SETS[i];
    
    try {
      const html = await response.text();
      const data = parseHTMLTable(html);
      allResults[filter.name] = formatData(data);
    } catch (e) {
      allResults[filter.name] = { error: e.toString() };
    }
  }

  const stats = generateDashboardStats(allResults);

  const end = new Date().getTime();

  return {
    stats: stats,
    detailedData: allResults,
    lastUpdate: new Date().toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
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
    const data = results[filter.name];
    
    if (Array.isArray(data)) {
      const direction = filter.name.startsWith("Güney") ? "guney" : "kuzey";
      const type = filter.name.includes("Planlı") ? "planli" : "hazir";

      stats[direction][type] = {
        total: data.length,
        kilavuzlu: data.filter(row => row && row.kilavuz).length,
        kilavuzsuz: data.filter(row => row && !row.kilavuz).length,
        gunduzcu: data.filter(row => row && isDaytimeOnlyShip(row)).length
      };
    } else {
      // Set default values if data is invalid
      const direction = filter.name.startsWith("Güney") ? "guney" : "kuzey";
      const type = filter.name.includes("Planlı") ? "planli" : "hazir";
      stats[direction][type] = {
        total: 0,
        kilavuzlu: 0,
        kilavuzsuz: 0,
        gunduzcu: 0
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