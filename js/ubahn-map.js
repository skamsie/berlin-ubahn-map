var isMobile = window.mobileAndTabletcheck()
var container = d3.select('#ubahn-map');

var width = isMobile ? window.devicePixelRatio * window.screen.width : screen.width;

$(document).ready(function() {
  $("#close-button").click(function() {
    $("#sidebar").hide();
    $("#sidebar-buttons").hide();
  });
});

var height = isMobile ? window.devicePixelRatio * window.screen.height : screen.height;

function getPointsOfInterest(station, promisedData) {
  var wikiTitle = '<h1>' + station.name + '</h1>';
  var wikiData = formatWikiData(station, promisedData);

  $.ajax({
    url: overpassApiQuery(station.position.lat, station.position.lon),
    success: function(data) {
      var formattedData = [];
      var elem = data.elements.filter(function(e) {
        return (e.tags.name)
      })

      $.each(elem, function( _, value ) {
        var i = {};
        i.name = value.tags.name
        i.address = formatAddress(value.tags)
        i.website = value.tags['contact:website'] || value.tags.website
        i.tags = formatTags(value.tags)

        if (
          formattedData.filter(
            function(e) { return e.name === i.name }
          ).length == 0
        ) {
          formattedData.push(i)
        }
      });

      var pointsOfInterest = '<hr /> <h3>Around ' + station.name + '</h3>';

      $.each(formattedData, function(_, poi) {
        address = poi.address ? poi.address + '<br />' : ''
        website = poi.website ? '<a href="' + poi.website + '">' + poi.website + '</a><br />' : ''
        pointsOfInterest += '<p><b>' + poi.name + '</b><br />' +
          address + website + 'tags: ' + poi.tags
      })

      showSidebar(wikiTitle + wikiData + pointsOfInterest)
    }
  });
};

// empty string if undefined
function fo(e) {
  return e === undefined ? '' : e
}

function removeInvalid(e) {
  return e.address || e.website
}

function formatTags(e) {
  return ['tourism', 'leisure', 'historic']
    .map(function(i) { return fo(e[i]) })
    .filter(function(i) { return i !== '' })
    .join(', ')
    .replace('attraction', 'tourist attraction')
}

function formatAddress(e) {
  var street = (e["addr:street"] && e["addr:housenumber"]) ?
    [e["addr:street"], e["addr:housenumber"]].join(", ") : ''
  var postcode = fo(e["addr:postcode"])
  var neighbourhood = fo(e["addr:suburb"])

  return [street, postcode, neighbourhood]
    .filter(function(i) { return i !== '' })
    .join(', ')
}

function getWikiData(station) {
  if (station.wiki_cache !== false && station.wiki_cache !== undefined) {
    $.when(
      $.ajax(
        { url: 'articles/' + station.name + '.html' })
    )
      .then(
      function(data) {
        getPointsOfInterest(station, data) }
    )
  } else {
    $.when(
      $.ajax({
        url: 'https://en.wikipedia.org/w/api.php',
        data: {
          action: 'query',
          titles: station.name.replace(" ", "_").concat("_(Berlin_U-Bahn)"),
          redirects: 1,
          pithumbsize: 600,
          exsectionformat: "raw",
          prop: 'extracts|pageimages|info',
          inprop: 'url',
          format: 'json'
        },
        dataType: 'jsonp'
      })
    ).then(
      function(x) {
        getPointsOfInterest(station, x);
      }
    )
  }
}

var map = d3
  .tubeMap()
  .width(width)
  .height(height)
  .on('click', function(station) {
    getWikiData(station)
  });

d3.json('./json/berlin-ubahn.json').then(function(data) {
  container.datum(data).call(map);

  var svg = container.select('svg');

  zoom = d3
    .zoom()
    .scaleExtent([0.7, 5])
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
  $("#sidebar-buttons").show();
  $('#sidebar-content').html(sidebarHtml)
}

function overpassApiQuery(lat, lon) {
  var aroundLocation = '(around:600,' + lat + ',' + lon + ');';
  return 'https://lz4.overpass-api.de/api/interpreter?data=[out:json];(' +
         'node[~"tourism|leisure"~"museum|gallery|attraction"]' + aroundLocation +
         'way[~"tourism|leisure"~"museum|gallery|attraction"]' + aroundLocation +
         ')->._;out;'
}

function formatWikiData(station, stationWikiData) {
  var wikiData;
  var wikiCached = '<p class="cached">cached: ' + station.wiki_cache + '</p>';

  if (typeof(stationWikiData) === 'string') {
    wikiData = stationWikiData + wikiCached
  } else {
    var resp = stationWikiData
      .query.pages[Object.keys(stationWikiData.query.pages)];
    var wikiImage = resp.thumbnail.source
    var wikiText = resp.extract
    var wikiUrl = resp.fullurl

    var formattedWikiText = wikiText
      .split('<h2><span id="References">References</span></h2>')[0]
      .split('<h2><span id="Gallery">Gallery</span></h2>')[0]

    wikiData = '<img src=' + '"' + wikiImage + '">' + formattedWikiText +
      '<a class="small-links" href="' + wikiUrl + '">' + wikiUrl + '</a>'
  }

  return wikiData
}
