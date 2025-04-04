const MIN_WIDTH = 1200;   // Minimum width for the design scale
const MIN_HEIGHT = 900;   // Minimum height for the design scale

let mapData, focusStations;
let planner = null;       // Will hold the current RoutePlanner instance
let sidebarManager = null; // Will hold the SidebarManager instance

const containerEl = document.querySelector('#ubahn-map');
const rect = containerEl.getBoundingClientRect();
const width = rect.width < MIN_WIDTH ? MIN_WIDTH : rect.width;
const height = rect.height < MIN_HEIGHT ? MIN_HEIGHT : rect.height;

const container = d3.select('#ubahn-map');

class RoutePlanner {
  constructor(from, to) {
    this.from = from;
    this.to = to;
    this.response = null;
    this.index = 0;       // Start with the first route (index 0)
    this.totalRoutes = 0;
  }

  async fetchRoute() {
    const url = `/find_route?from=${encodeURIComponent(this.from)}`
              + `&to=${encodeURIComponent(this.to)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }
    this.response = await res.json();
    this.totalRoutes = this.response.routes.length;
    this.index = 0; // Reset the index on every new fetch
  }

  // Draws the route corresponding to the current index
  async showCurrentRoute() {
    if (!this.response) {
      await this.fetchRoute();
    }
    const currentRoute = this.response.routes[this.index];
    if (!currentRoute) {
      console.warn(`No route found at index ${this.index}`);
      return;
    }
    // Clone each step so we don't modify the original data
    const routeSteps = currentRoute.steps.map(function(step) {
      return Object.assign({}, step);
    });
    routeSteps.forEach(function(step) {
      if (typeof step.line === "string") {
        step.line = mapData.rawData.lines.find(function(l) {
          return l.name === step.line.toUpperCase();
        });
      }
    });
    map.drawRoute(routeSteps);
  }

  // Advances to the next route (cycles to 0 after the last route)
  async nextRoute() {
    this.index = (this.index + 1) % this.totalRoutes;
    await this.showCurrentRoute();
  }

  // Goes to the previous route (cycles to the last one if at index 0)
  async prevRoute() {
    this.index = (this.index - 1 + this.totalRoutes) % this.totalRoutes;
    await this.showCurrentRoute();
  }
}

class SidebarManager {
  constructor(mapData) {
    this.mapData = mapData;
    this.focusStations = {}; // Will store { previous, current, next }
  }

  showSidebar(html) {
    $("#sidebar").show();
    $("#sidebar-content-container").html('<div id="wiki-content">' + html + '</div>');
  }

  handleImageColor() {
    if (Cookies.get("grayscale-photos") === "true") {
      $(".wiki-image").css({
        filter: "grayscale(100%)",
        "-webkit-filter": "grayscale(100%)"
      });
    }
  }

  addendum(data, lang) {
    const wikiCache = data[lang + '_wiki_cache'];
    const wikiSources = data[lang + '_wiki_sources'];
    const imageSource = data.image_cache && data.image_source ? data.image_source : "";
    let html = wikiCache ? 'Last update: ' + wikiCache + '<br />' : "";
    if (wikiSources) {
      const sources = Object.entries(wikiSources).map(function(entry) {
        const k = entry[0], v = entry[1];
        return '<a href="' + v + '">' + k + '</a>';
      });
      html += 'Source: ' + sources.join(', ') + '<br />';
    }
    if (imageSource) {
      const author = Object.keys(imageSource)[0];
      const link = imageSource[author];
      html += link ? 'Image Source: <a href="' + link + '">' + author + '</a>' : 'Image Source: ' + author;
    }
    return '<p class="addendum">' + html + '</p>';
  }

  getWikiData(station, meta) {
    const title = '<h1>' + station.name + '</h1>';
    const imagePath = meta.image_cache
      ? 'articles/images/' + transliterateImageName(station.name) + '.jpg'
      : null;
    if (meta.image_cache) {
      preloadImage(imagePath);
    }
    const showContent = function(data) {
      const body = '<div class="wiki-body"><img class="wiki-image" src="' + imagePath + '">' + data + '</div>';
      this.showSidebar(title + body + this.addendum(meta, "en"));
      this.handleImageColor();
      $(".main-footer").hide();
    }.bind(this);
    $.get('articles/html/' + station.name + '.html', showContent);
  }

  removeHighlight() {
    if (!this.focusStations.current) return;
    d3.selectAll('.station.' + classFromName(this.focusStations.current.name))
      .attr('fill', 'white')
      .attr('current', 'false');
  }

  getStationLines(name) {
    return this.mapData.lines
      .filter(function(line) {
        return line.stations.includes(normalizeStationName(name));
      })
      .map(function(line) {
        return line.name;
      })
      .sort();
  }

  stationNeighbours(station) {
    const lines = this.mapData.lines;
    const stations = this.mapData.stations;
    const line = lines.find(function(l) {
      return l.name === station.currentLineName;
    });
    const index = line.stations.indexOf(normalizeStationName(station.name));
    const lineIndex = lines.indexOf(line);
    const prevLine = lines[(lineIndex - 1 + lines.length) % lines.length];
    const nextLine = lines[(lineIndex + 1) % lines.length];
    const previous = index > 0
      ? stations[line.stations[index - 1]]
      : stations[prevLine.stations.slice(-1)[0]];
    const next = index < line.stations.length - 1
      ? stations[line.stations[index + 1]]
      : stations[nextLine.stations[0]];
    previous.currentLineName = index === 0 ? prevLine.name : line.name;
    next.currentLineName = index === line.stations.length - 1 ? nextLine.name : line.name;
    return { previous: previous, next: next };
  }

  updateStation(station) {
    this.removeHighlight();

    // Highlight the new station
    d3.selectAll('.station.' + classFromName(station.name))
      .attr('fill', 'black')
      .attr('current', true);

    // Retrieve meta and station lines
    const meta = this.mapData.meta[station.name];
    station.currentLineName = station.currentLineName || this.getStationLines(station.name)[0];
    station.servingLinesNames = this.getStationLines(station.name);

    // Compute neighbours and store focus
    this.focusStations = this.stationNeighbours(station);
    this.focusStations.current = station;

    // Get and display wiki data
    this.getWikiData(station, meta);

    // Update additional sidebar info
    $("#lines-for-station").html(station.servingLinesNames.join("&nbsp;"));
    $("#sidebar-footer").html(
      '<b>coordinates</b>' +
      '<a href="https://www.openstreetmap.org/?mlat=' + station.position.lat +
      '&mlon=' + station.position.lon +
      '&zoom=16" target="_blank">' +
      station.position.lat + ', ' + station.position.lon + '</a>'
    );
  }
}

// ========================================================
// Map Setup
// ========================================================
const map = d3.tubeMap()
  .width(width * 0.9)
  .height(height * 0.9)
  .on('click', function(station) {
    sidebarManager.updateStation(station);
  });

function initMap() {
  d3.json('./json/berlin-ubahn.json').then(function(data) {
    d3.json('./json/meta.json').then(function(meta) {
      container.datum(data).call(map);
      const mapDataInternal = map.data();
      mapData = {
        meta: meta,
        lines: mapDataInternal.lines,
        stations: mapDataInternal.stations,
        rawData: data
      };

      sidebarManager = new SidebarManager(mapData);
      map.drawAll(Cookies.get());
      setupZoomAndCenter();
    });
  });
}

function setupZoomAndCenter() {
  const svg = container.select('svg');
  const zoom = d3.zoom()
    .scaleExtent([0.5, 10])
    .on('zoom', function() {
      svg.select('g').attr('transform', d3.event.transform.toString());
    });
  svg.call(zoom);

  // Hide container until centering is complete to avoid visual "jump"
  containerEl.style.opacity = 0;
  setTimeout(function() {
    const g = svg.select('g');
    const textEls = g.selectAll('text').style('display', 'none');
    const bounds = g.node().getBBox();
    textEls.style('display', null);

    const margin = 50;
    const viewX = bounds.x - margin;
    const viewY = bounds.y - margin;
    const viewW = bounds.width + margin * 2;
    const viewH = bounds.height + margin * 2;

    svg.attr("viewBox", viewX + " " + viewY + " " + viewW + " " + viewH)
       .attr("preserveAspectRatio", "xMidYMid meet");

    containerEl.style.opacity = 1;
  }, 100);
}

// ========================================================
// Utility Functions
// ========================================================
function normalizeStationName(name) {
  return name.replace(/[0-9]/g, '').trim();
}

function classFromName(name) {
  return name.replace(/[()0-9 ]/g, '');
}

function allStationNames() {
  const stations = Object.getOwnPropertyNames(mapData.stations);
  const stationNames = Array.from(new Set(stations.map(function(s) {
    return normalizeStationName(s);
  })));
  return stationNames.sort();
}

function transliterateImageName(str) {
  const umlautMap = {
    'Ü': 'UE',
    'Ä': 'AE',
    'Ö': 'OE',
    'ü': 'ue',
    'ä': 'ae',
    'ö': 'oe',
    'ß': 'ss'
  };
  return str
    .replace(/[\u00dc|\u00c4|\u00d6][a-z]/g, function(match) {
      const upper = umlautMap[match[0]];
      return upper[0] + upper[1].toLowerCase() + match.slice(1);
    })
    .replace(new RegExp('[' + Object.keys(umlautMap).join('|') + ']', 'g'), function(m) {
      return umlautMap[m];
    })
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

// ========================================================
// Event Handlers & Initialization
// ========================================================
$('#route-form').on('submit', async function(e) {
  e.preventDefault();
  const from = $('#from').val();
  const to = $('#to').val();
  planner = new RoutePlanner(from, to);
  try {
    await planner.fetchRoute();
    await planner.showCurrentRoute();
    updateRouteIndexDisplay();
    $('#route-navigation').css('display', 'block');
  } catch (error) {
    console.error('Error fetching route:', error);
  }
});

// route planner handlers
$('#prev-route').on('click', async () => {
  await planner.prevRoute();
  updateRouteIndexDisplay();
});
$('#next-route').on('click', async () => {
  await planner.nextRoute();
  updateRouteIndexDisplay();
});
$('.reset-btn').on('click', () => {
  map.reset(Cookies.get());
  $('#route-navigation').hide();
});

function updateRouteIndexDisplay() {
  $('#current-route').text(planner.index + 1);
  $('#total-routes').text(`Number of routes found: ${planner.totalRoutes}`)
}

$(document).on("keydown", function(e) {
  if (!$('#sidebar').is(':visible')) return;
  if (e.keyCode === 37 && sidebarManager && sidebarManager.focusStations.previous) {
    sidebarManager.updateStation(sidebarManager.focusStations.previous);
  }
  if (e.keyCode === 39 && sidebarManager && sidebarManager.focusStations.next) {
    sidebarManager.updateStation(sidebarManager.focusStations.next);
  }
});

$('body').on('click', 'a.station-navigator', function() {
  if (sidebarManager) {
    sidebarManager.updateStation(sidebarManager.focusStations[$(this).attr('id')]);
  }
});

$(document).ready(function() {
  $('.fake-link').click(function(e) { e.preventDefault(); });
  if ($(window).width() >= 1001) {
    $('#sidebar').resizable({ handles: 'e' });
  }
  $('#close-link').click(function() {
    if (sidebarManager) {
      sidebarManager.removeHighlight();
    }
    $(".main-footer").show();
    $("#sidebar").hide();
  });
  $("#route-planner").draggable();
});

// ========================================================
// Kick off Map Initialization
// ========================================================
initMap();
