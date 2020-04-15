//naive way of assuming mobile
var isMobile = window.screen.width < window.screen.height ? true : false

var container = d3.select('#ubahn-map');
var width = isMobile ? window.devicePixelRatio * window.screen.width : screen.width;
var height = isMobile ? window.devicePixelRatio * window.screen.height : screen.height;
var meta;

var currentStation;
var mapData;

d3.json('./json/meta.json').then(function(data) {
  meta = data;
})

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

function getWikiData(station) {
  var wikiTitle = '<h1>' + station.name + '</h1>';
  var wikiMeta = meta[station.name];
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
        $('#sidebar').scrollTop(0);
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

var map = d3
  .tubeMap()
  .width(width)
  .height(height)
  .on('click', function(data) {
    var current = data.current;
    current.lineName = getStationLines(current.name, data.lines)[0];
    getWikiData(data.current);

    window.currentStation = getStationData(current, data.lines, data.stations)
    window.mapData = {
      stations: data.stations,
      lines: data.lines
    }

    drawLinesForStation(window.currentStation.lines)

    $('#about-link').text('about')
  });

d3.json('./json/berlin-ubahn.json').then(function(data) {
  container.datum(data).call(map);

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
});

function showSidebar(sidebarHtml) {
  $("#sidebar").show();
  $("#about-content").hide();
  $('#wiki-content').html(sidebarHtml)
  $("#wiki-content").show();
}

function showAbout() {
  $("#wiki-content").hide();
  $('#about-content').show();
  $.ajax({
    url: 'about.html',
    success: function(data) {
      $('#about-content').html(data)
    }
  })
}

function showWiki() {
  $("#about-content").hide();
  $('#wiki-content').show();
}

function toggleAbout() {
  var currentText = $('#about-link').text().replace(/^\s+|\s+$/g, '')

  if (currentText == 'about') {
    $('#about-link').text('back')
    showAbout()
  } else {
    $('#about-link').text('about')
    showWiki()
  }
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

function getStationData(station, lines, stations) {
  var line = lines.find(l => l.name == station.lineName);
  var stationName = normalizeStationName(station.name);
  var indexOfStation = line.stations.indexOf(stationName);
  var indexOfLine = lines.indexOf(line);
  var stationData = {};

  if (indexOfStation != 0 && indexOfStation != line.stations.length - 1) {
    stationData.next = stations[line.stations[indexOfStation + 1]];
    stationData.next.lineName = line.name;
    stationData.previous = stations[line.stations[indexOfStation - 1]];
    stationData.previous.lineName = line.name;
  } else if (indexOfStation == 0) {
    stationData.next = stations[line.stations[indexOfStation + 1]]
    stationData.next.lineName = line.name;
    if (indexOfLine == 0) {
      stationData.previous = stations[lines[lines.length - 1].stations.slice(-1)[0]]
      stationData.previous.lineName = lines[lines.length - 1].name
    } else {
      stationData.previous = stations[lines[indexOfLine - 1].stations.slice(-1)[0]]
      stationData.previous.lineName = lines[indexOfLine - 1].name
    }
  } else {
    stationData.previous = stations[line.stations[indexOfStation - 1]]
    stationData.previous.lineName = line.name
    if (indexOfLine == lines.length - 1) {
      stationData.next = stations[lines[0].stations[0]]
      stationData.next.lineName = lines[0].name
    } else {
      stationData.next = stations[lines[indexOfLine + 1].stations[0]]
      stationData.next.lineName = lines[indexOfLine + 1].name
    }
  }

  stationData.current = station
  stationData.lines = getStationLines(stationName, lines)

  return stationData;
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

function stationSiblings(stationName, lines, stations) {
  var station = normalizeStationName(stationName);
  var siblings = [];

  for (var i = 0;  i < lines.length; i++) {
    var indexOfStation = lines[i].stations.indexOf(station);

    if (indexOfStation != -1) {
      siblings.push(
        {
          name: lines[i].name,
          previous: stations[lines[i].stations[indexOfStation - 1]] || null,
          next: stations[lines[i].stations[indexOfStation + 1]] || null,
        }
      )
    }
  }

  return siblings
    .sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
}

function drawLinesForStation(lines) {
  $('#lines-for-station').html(lines.join('&nbsp;'))
}

$('body').on('click', 'a.station-navigator', function() {
  var direction = $(this).attr('id');
  var newCurrentStation = window.currentStation[direction];

  window.currentStation = getStationData(
    newCurrentStation, window.mapData.lines, window.mapData.stations);

  getWikiData(newCurrentStation);
  drawLinesForStation(window.currentStation.lines)
  $('#about-link').text('about')
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
    $("#sidebar").hide();
  });

  $("#about-link").click(function() {
    toggleAbout()
  })
});

