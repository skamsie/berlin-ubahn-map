// naive way of assuming mobile
const isMobile = window.screen.width < window.screen.height;
const width = isMobile
  ? window.devicePixelRatio * window.screen.width
  : screen.width;
const height = isMobile
  ? window.devicePixelRatio * window.screen.height
  : screen.height;

const container = d3.select('#ubahn-map');
let mapData;
let focusStations;

// === Utilities ===
function normalizeStationName(name) {
  return name.replace(/[0-9]/g, '').trim();
}

function classFromName(name) {
  return name.replace(/[()0-9 ]/g, '');
}

function allStationNames() {
  const stations = Object.getOwnPropertyNames(mapData.stations);
  const stationNames = [...new Set(stations.map(s => normalizeStationName(s)))];

  return stationNames.sort();
}

// replace spaces with underscores and German characters with their
// English correspondent
// Example:
//   'Görlitzer Bahnhof' -> 'Goerlitzer_Bahnhof'
function transliterateImageName(str) {
  const umlautMap = {
    Ü: 'UE',
    Ä: 'AE',
    Ö: 'OE',
    ü: 'ue',
    ä: 'ae',
    ö: 'oe',
    ß: 'ss',
  };

  return str
    .replace(/[\u00dc|\u00c4|\u00d6][a-z]/g, match => {
      const upper = umlautMap[match[0]];
      return upper[0] + upper[1].toLowerCase() + match.slice(1);
    })
    .replace(
      new RegExp(`[${Object.keys(umlautMap).join('|')}]`, 'g'),
      m => umlautMap[m]
    )
    .replace(/ /g, '_');
}

function preloadImage(url) {
  const img = new Image();
  img.src = url;
  return img.src;
}

function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

// === Sidebar / Wiki Handling ===
function showSidebar(html) {
  $("#sidebar").show();
  $('#sidebar-content-container').html(
    `<div id="wiki-content">${html}</div>`
  );
}

function handleImageColor() {
  if (Cookies.get('grayscale-photos') === 'true') {
    $('.wiki-image').css({
      filter: 'grayscale(100%)',
      '-webkit-filter': 'grayscale(100%)'
    });
  }
}

function addendum(data, lang) {
  const wikiCache = data[`${lang}_wiki_cache`];
  const wikiSources = data[`${lang}_wiki_sources`];
  const imageSource =
    data.image_cache && data.image_source ? data.image_source : '';
  let html = wikiCache ? `Last update: ${wikiCache}<br />` : '';

  if (wikiSources) {
    const sources = Object.entries(wikiSources).map(
      ([k, v]) => `<a href="${v}">${k}</a>`
    );
    html += `Source: ${sources.join(', ')}<br />`;
  }

  if (imageSource) {
    const [author] = Object.keys(imageSource);
    const link = imageSource[author];
    html += link
      ? `Image Source: <a href="${link}">${author}</a>`
      : `Image Source: ${author}`;
  }

  return `<p class="addendum">${html}</p>`;
}

function getWikiData(station, meta) {
  const title = `<h1>${station.name}</h1>`;
  const imagePath = meta.image_cache
    ? `articles/images/${transliterateImageName(station.name)}.jpg`
    : null;

  if (meta.image_cache) preloadImage(imagePath);

  const showContent = data => {
    const body = `<div class="wiki-body"><img class="wiki-image" ` +
      `src="${imagePath}">${data}</div>`;
    showSidebar(
      `${title}${body}${addendum(meta, 'en')}`
    );
    handleImageColor();
    $(".main-footer").hide();
  };

  $.get(`articles/html/${station.name}.html`, showContent);
}

function removeHighlight() {
  if (!focusStations?.current) return;

  d3.selectAll(`.station.${classFromName(focusStations.current.name)}`)
    .attr('fill', 'white')
    .attr('current', 'false');
}

function showWikiData(station) {
  removeHighlight();

  d3.selectAll(`.station.${classFromName(station.name)}`)
    .attr('fill', 'black')
    .attr('current', true);

  const meta = mapData.meta[station.name];

  station.currentLineName ||= getStationLines(
    station.name,
    mapData.lines
  )[0];
  station.servingLinesNames = getStationLines(
    station.name,
    mapData.lines
  );
  focusStations = stationNeighbours(
    station,
    mapData.lines,
    mapData.stations
  );
  focusStations.current = station;

  getWikiData(station, meta);

  $('#lines-for-station').html(
    station.servingLinesNames.join('&nbsp;')
  );
  $('#sidebar-footer').html(
    `<b>coordinates</b> <a href="https://www.openstreetmap.org/?mlat=${
      station.position.lat
    }&mlon=${station.position.lon}&zoom=16" target="_blank">${
      station.position.lat
    }, ${station.position.lon}</a>`
  );
}

function getStationLines(name, lines) {
  return lines
    .filter(line =>
      line.stations.includes(normalizeStationName(name))
    )
    .map(line => line.name)
    .sort();
}

// Get next and previous stations on the same line, or if it's the
// first or last stop of the line, the neighbours are decided
// chronologically.
//
// Examples:
//   - for last station of U6, the next neighbour is the first
//     station of U7
//   - for the first station of U1, the previous neighbour is the last
//     station of U9
function stationNeighbours(station, lines, stations) {
  const line = lines.find(
    l => l.name === station.currentLineName
  );
  const index = line.stations.indexOf(
    normalizeStationName(station.name)
  );
  const lineIndex = lines.indexOf(line);

  const prevLine = lines[(lineIndex - 1 + lines.length) % lines.length];
  const nextLine = lines[(lineIndex + 1) % lines.length];

  const previous = (index > 0)
    ? stations[line.stations[index - 1]]
    : stations[prevLine.stations.slice(-1)[0]];
  const next = (index < line.stations.length - 1)
    ? stations[line.stations[index + 1]]
    : stations[nextLine.stations[0]];

  previous.currentLineName =
    index === 0 ? prevLine.name : line.name;
  next.currentLineName =
    index === line.stations.length - 1 ? nextLine.name : line.name;

  return { previous, next };
}

async function fetchRoute(from, to) {
  let url = `/find_route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  return response.json();
}

async function highlightRoute(from, to, index = 1) {
  const response = await fetchRoute(from, to);
  const routeSteps = response.routes[index - 1].steps;

  routeSteps.forEach(step => {
    step.line = mapData.rawData.lines.find(
      l => l.name === step.line.toUpperCase()
    );
  });

  map.drawRoute(routeSteps);
}

// === Map Setup ===
const map = d3.tubeMap()
  .width(width * 0.9)
  .height(height * 0.9)
  .on('click', showWikiData);

d3.json('./json/berlin-ubahn.json').then(data => {
  d3.json('./json/meta.json').then(meta => {
    container.datum(data).call(map);
    const mapDataInternal = map.data();

    mapData = {
      meta,
      lines: mapDataInternal.lines,
      stations: mapDataInternal.stations,
      rawData: data
    };

    map.drawAll(Cookies.get());

    const svg = container.select('svg');
    const zoom = d3.zoom()
      .scaleExtent([0.5, 10])
      .on('zoom', () => {
        svg.select('g').attr(
          'transform',
          d3.event.transform.toString()
        );
      });

    const zoomContainer = svg.call(zoom);
    zoom.scaleTo(zoomContainer, 1);

    const center = [ (width * 0.9) / 2, (height * 0.9) / 2 ];

    if (isSafari() || isMobile) {
      zoom.translateTo(zoomContainer, -100, 0);
    } else {
      zoom.translateTo(zoomContainer, center[0], center[1]);
    }
  });
});

document
  .querySelector('#route-form')
  .addEventListener('submit', async e => {
    e.preventDefault();
    const from = document.querySelector('#from').value;
    const to = document.querySelector('#to').value;
    try {
      // If you want to highlight the route directly:
      await highlightRoute(from, to);

      // Or if you want more control:
      // const routeData = await fetchRoute(from, to);
      // Process routeData and update the UI as needed
    } catch (error) {
      console.error('Error fetching route:', error);
      // Optionally show an error message to the user
    }
  });

$(document).on("keydown", function (e) {
  if (!$('#sidebar').is(':visible')) return;
  if (e.keyCode === 37) showWikiData(focusStations.previous);
  if (e.keyCode === 39) showWikiData(focusStations.next);
});

$('body').on('click', 'a.station-navigator', function() {
  showWikiData(focusStations[$(this).attr('id')]);
});

$(document).ready(function () {
  $('.fake-link').click(e => e.preventDefault());

  if ($(window).width() >= 1001) {
    $('#sidebar').resizable({ handles: 'e' });
  }

  $('#close-link').click(() => {
    removeHighlight();
    $(".main-footer").show();
    $("#sidebar").hide();
  });
});
