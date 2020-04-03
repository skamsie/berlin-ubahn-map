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

function saveData(data, fileName) {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";

    var json = JSON.stringify(data),
        blob = new Blob([data], {type: "text/html;charset=utf-8"}),
        url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
}

function getWikiData(station) {
  var wikiStation = station.name.replace(" ", "_").concat("_(Berlin_U-Bahn)");
  var wikiTitle = '<h1>U Bahn ' + station.name + '</h1>';
  var wikiCached = '<p class="cached">cached: ' + station.wiki_cache + '</p>';

  if (station.wiki_cache !== false && station.wiki_cache !== undefined) {
    $.ajax({
      url: 'articles/' + station.name + '.html',
      success: function(data) {
        $("#sidebar").show();
        $('#sidebar-content').html(wikiTitle + data + wikiCached)
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

        var toSave = '<img src=' + '"' + wikiImage + '">' + formattedWikiText +
                     '<a href="' + wikiUrl + '">' + wikiUrl + '</a>'

        saveData(toSave, station.name + '.html')

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
    getWikiData(name)
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
