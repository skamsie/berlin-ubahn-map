//naive way of assuming mobile
var isMobile = window.screen.width < window.screen.height ? true : false

var container = d3.select('#ubahn-map');
var width = isMobile ? window.devicePixelRatio * window.screen.width : screen.width;
var height = isMobile ? window.devicePixelRatio * window.screen.height : screen.height;

var focusStations;
var mapData;

function imageName(str) {
  var umlautMap = {
    '\u00dc': 'UE',
    '\u00c4': 'AE',
    '\u00d6': 'OE',
    '\u00fc': 'ue',
    '\u00e4': 'ae',
    '\u00f6': 'oe',
    '\u00df': 'ss',
  }

  return str
    .replace(' ', '_')
    .replace(/[\u00dc|\u00c4|\u00d6][a-z]/g, function(a) {
      var big = umlautMap[a.slice(0, 1)];
      return big.charAt(0) + big.charAt(1).toLowerCase() + a.slice(1);
    })
    .replace(new RegExp('[' + Object.keys(umlautMap).join('|') + ']', 'g'),
      function(a) { return umlautMap[a] }
    );
}

function getWikiData(station, wikiMeta) {
  $('#sidebar-content-container').html('')
  var wikiTitle = '<h1>' + station.name + '</h1>';
  var imagePath = wikiMeta.image_cache ?
    concat('articles/images/', imageName(station.name), '.jpg') :
    null

  if (wikiMeta.image_cache) {
    preloadImage(imagePath)
  }

  if (wikiMeta.en_wiki_cache) {
    $.ajax({
      url: 'articles/html/' + station.name + '.html',
      success: function(data) {
        showSidebar(
          concat(
            wikiTitle, '<img src="', imagePath, '">',
            data, addendum(wikiMeta, 'en')
          )
        )
        $(".main-footer").hide();
      }
    });
  }

  else {
    var wikiStation = station.name.replace(" ", "_").concat("_(Berlin_U-Bahn)");

    $.ajax({
      url: 'https://en.wikipedia.org/w/api.php',
      data: {
        action: 'query',
        titles: wikiStation,
        redirects: 1,
        pithumbsize: 800,
        exsectionformat: "raw",
        prop: 'extracts|pageimages|info',
        inprop: 'url',
        format: 'json'
      },
      dataType: 'jsonp',
      success: function(data) {
        var resp = data.query.pages[Object.keys(data.query.pages)];
        var wikiImage = imagePath ? imagePath : resp.thumbnail.source;
        var wikiText = resp.extract;
        var wikiUrl = resp.fullurl;

        var formattedWikiText = wikiText
          .split('<h2><span id="References">References</span></h2>')[0]
          .split('<h2><span id="Gallery">Gallery</span></h2>')[0]

        var wikiData = concat(
          wikiTitle, '<img src=', '"', wikiImage, '">', formattedWikiText,
          addendum(
            {
              'en_wiki_sources': { 'Wikipedia (EN)': wikiUrl },
              'image_cache': wikiMeta.image_cache,
              'image_source': wikiMeta.image_source
            },
            'en'
          )
        )

        showSidebar(wikiData)
        $(".main-footer").hide();
      }
    });
  }
}

function preloadImage(url) {
  var img = new Image();
  img.src = url;
  return img.src
}

function normalizeStationName(stationName) {
  return stationName.replace(/[0-9]/g, '').trim()
}

function showWikiData(station) {
  function showLinesForStation(lines) {
    $('#lines-for-station').html(lines.join('&nbsp;'))
  }

  function showOpenStreetMapLink(lat, lon) {
    $('#sidebar-footer').html(
      concat(
        '<b>coordinates</b> <a href="https://www.openstreetmap.org/?mlat=',
        lat, '&mlon=', lon, '&zoom=16" target="_blank">', lat, ', ', lon, '</a>')
    )
  }

  // if currentLine name is not defined, get the line with lowest number
  var wikiMeta = window.mapData.meta[station.name];

  station.currentLineName = station.currentLineName ||
    getStationLines(station.name, window.mapData.lines)[0];
  station.servingLinesNames = getStationLines(station.name, window.mapData.lines);

  window.focusStations = stationSiblings(
    station,
    window.mapData.lines,
    window.mapData.stations
  );
  window.focusStations.current = station;

  getWikiData(station, wikiMeta);

  showLinesForStation(station.servingLinesNames)
  showOpenStreetMapLink(
    station.position.lat,
    station.position.lon,
  );
}

var map = d3
  .tubeMap()
  .width(width)
  .height(height)
  .on('click', function(data) {
    showWikiData(data);
  });

d3.json('./json/berlin-ubahn.json').then(function(data) {
  d3.json('./json/meta.json').then(function(metaData) {
    container.datum(data).call(map);
    var _data = map.data();

    window.mapData = {
      meta: metaData,
      lines:  _data.lines,
      stations: _data.stations
    }

    map.drawAll()

    var svg = container.select('svg');

    zoom = d3
      .zoom()
      .scaleExtent([0.7, 10])
      .on('zoom', zoomed);

    var zoomContainer = svg.call(zoom);
    var initialScale = 1;
    var initialTranslate = [0, height / 25];

    zoom.scaleTo(zoomContainer, initialScale);
    zoom.translateTo(
      zoomContainer,
      initialTranslate[0],
      initialTranslate[1]
    );

    function zoomed() {
      svg.select('g').attr('transform', d3.event.transform.toString());
    }
  })

});

function showSidebar(sidebarHtml) {
  $("#sidebar").show();
  $('#sidebar-content-container').html(
    concat('<div id="wiki-content">', sidebarHtml, '</div>')
  )
}

// return article addendum (article sources and image source)
function addendum(addendumObject, language) {
  wikiCache = addendumObject[language + '_wiki_cache']
  wikiSources = addendumObject[language + '_wiki_sources']
  imageSource = addendumObject.image_cache && addendumObject.image_source ?
    addendumObject.image_source :
    ''
  addendumSection = '';
  addendumSection += wikiCache ?
    'Cached: ' + addendumObject[language + '_wiki_cache'] + '<br />' :
    ''

  if (wikiSources) {
    addendumSection += 'Source: ';
    var sources = [];
    $.each(wikiSources, function(k, v) {
      sources.push('<a href="' + v + '">' + k + '</a>')
    });
    addendumSection += sources.join(', ') + '<br />';
  }

  if (imageSource) {
    var author = Object.keys(imageSource)[0];
    var imagexEternalUrl = imageSource[author];

    var imageSection = imagexEternalUrl ?
      concat(
        'Image Source: <a href="', imagexEternalUrl, '">',
        author, '</a>'
      ) :
      'Image Source: '.concat(author)

    addendumSection += imageSection
  }

  return concat('<p class="addendum">', addendumSection, '</p>')
}

function concat() {
  concatenated = "";
  for (var i = 0; i < arguments.length; i++) {
    concatenated += arguments[i];
  }
  return concatenated;
}

// Get next and previous stations on the same line, or if
// it's the first or last stop of the line, the siblings are
// decided chronoligcally.
//
// Examples:
//   for last station of U6, the next sibling is the first station of U7
//   for the first station of U1, the previous sibling is the last station of U9
function stationSiblings(station, lines, stations) {
  var line = lines.find(l => l.name == station.currentLineName);
  var stationName = normalizeStationName(station.name);
  var indexOfStation = line.stations.indexOf(stationName);
  var indexOfLine = lines.indexOf(line);
  var n;
  var p;

  if (indexOfStation != 0 && indexOfStation != line.stations.length - 1) {
    n = stations[line.stations[indexOfStation + 1]];
    p = stations[line.stations[indexOfStation - 1]];
    n.currentLineName = line.name;
    p.currentLineName = line.name;

  } else if (indexOfStation == 0) {
    n = stations[line.stations[indexOfStation + 1]];
    n.currentLineName = line.name;

    if (indexOfLine == 0) {
      p = stations[lines[lines.length - 1].stations.slice(-1)[0]];
      p.currentLineName = lines[lines.length - 1].name;
    } else {
      p = stations[lines[indexOfLine - 1].stations.slice(-1)[0]]
      p.currentLineName = lines[indexOfLine - 1].name
    }

  } else {
    p = stations[line.stations[indexOfStation - 1]];
    p.currentLineName = line.name;

    if (indexOfLine == lines.length - 1) {
      n = stations[lines[0].stations[0]];
      n.currentLineName = lines[0].name;
    } else {
      n = stations[lines[indexOfLine + 1].stations[0]];
      n.currentLineName = lines[indexOfLine + 1].name;
    }
  }

  return {
    next: n,
    previous: p
  }
}

function getStationLines(stationName, lines) {
  var stationLines = [];

  for (var i = 0;  i < lines.length; i++) {
    var indexOfStation = lines[i].stations
      .indexOf(normalizeStationName(stationName));
    if (indexOfStation !== -1) {
      stationLines.push(lines[i].name)
    }
  }

  return stationLines.sort();
}

$('body').on('click', 'a.station-navigator', function() {
  var direction = $(this).attr('id');
  var newCurrentStation = window.focusStations[direction];

  showWikiData(newCurrentStation);
});

$(document).ready(function() {
  $('.fake-link').click(function(event){
    event.preventDefault();
  });

  if ($(window).width() >= 1001) {
    $('#sidebar').resizable({
      handles: 'e'
    });
  }

  $("#close-link").click(function() {
    $(".main-footer").show();
    $("#sidebar").hide();
  });
});
