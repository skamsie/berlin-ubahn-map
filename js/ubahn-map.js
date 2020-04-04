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

const getBarsAround = (data) => {
  var lat = data.position.lat;
  var lon = data.position.lon;
  var aroundLocation = '(around:600,' + lat + ',' + lon + ');';
  var qu = 'https://lz4.overpass-api.de/api/interpreter?data=[out:json];(' +
      'node[~"tourism|leisure"~"museum|gallery|attraction|park"]' + aroundLocation +
      'way[~"tourism|leisure"~"museum|gallery|attraction|park"]' + aroundLocation +
    ')->._;out;'

  $.ajax({
    url: qu,
    success: function(data) {
      var formattedData = [];
      var elem = data.elements.filter(function(e) {
        return (e.tags.name)
      })

      console.log(data)

      $.each(elem, function( _, value ) {
        var i = {};
        i.name = value.tags.name
        i.address = formatAddress(value.tags)
        i.website = value.tags['contact:website'] || value.tags.website
        i.tags = [fo(value.tags['tourism']), fo(value.tags['leisure'])]
          .filter(function(i) { return i !== '' })
          .join(', ')
      });

      console.log(formattedData)
    }
  });
};

// empty string if undefined
function fo(e) {
  return e === undefined ? '' : e
}

function formatAddress(e) {
  console.log(e)
  var street = (e["addr:street"] && e["addr:housenumber"]) ?
    [e["addr:street"], e["addr:housenumber"]].join(", ") : ''
  var postcode = fo(e["addr:postcode"])
  var neighbourhood = fo(e["addr:suburb"])

  return [street, postcode, neighbourhood]
    .filter(function(i) { return i !== '' })
    .join(', ')
}

function getWikiData(station) {
  var wikiStation = station.name.replace(" ", "_").concat("_(Berlin_U-Bahn)");
  var wikiTitle = '<h1>' + station.name + '</h1>';
  var wikiCached = '<p class="cached">cached: ' + station.wiki_cache + '</p>';

  if (station.wiki_cache !== false && station.wiki_cache !== undefined) {
    $.ajax({
      url: 'articles/' + station.name + '.html',
      dataType: 'jsonp',
      success: function(data) {
        console.log(data)
      }
    });
  }

  else {
    $.ajax({
      url: 'https://en.wikipedia.org/w/api.php',
      data: {
        action: 'query',
        titles: wikiStation,
        redirects: 1,
        pithumbsize: 600,
        exsectionformat: "raw",
        prop: 'extracts|pageimages|info',
        inprop: 'url',
        format: 'json'
      },
      dataType: 'jsonp',
      success: function(data) {
        var resp = data.query.pages[Object.keys(data.query.pages)];
        var wikiImage = resp.thumbnail.source
        var wikiText = resp.extract
        var wikiUrl = resp.fullurl

        var formattedWikiText = wikiText
          .split('<h2><span id="References">References</span></h2>')[0]
          .split('<h2><span id="Gallery">Gallery</span></h2>')[0]

        $("#sidebar").show();
        $("#sidebar-buttons").show();
        $('#sidebar-content').html(
          wikiTitle +
          '<img src=' + '"' + wikiImage + '">' + formattedWikiText +
          '<a href="' + wikiUrl + '">' + wikiUrl + '</a>'
        )
      }
    });
  }
}

var map = d3
  .tubeMap()
  .width(width)
  .height(height)
  .on('click', function(name) {
    getBarsAround(name)
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
