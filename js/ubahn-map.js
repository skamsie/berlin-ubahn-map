//naive way of assuming mobile
var isMobile = window.screen.width < window.screen.height ? true : false

var container = d3.select('#ubahn-map');
var currentStation;
var width = isMobile ? window.devicePixelRatio * window.screen.width : screen.width;
var height = isMobile ? window.devicePixelRatio * window.screen.height : screen.height;
var meta;

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
    .replace(new RegExp('['+Object.keys(umlautMap).join('|')+']','g'),
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
        var wikiImage = imagePath ? imagePath : resp.thumbnail.source
        var wikiText = resp.extract
        var wikiUrl = resp.fullurl

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

var map = d3
  .tubeMap()
  .width(width)
  .height(height)
  .on('click', function(station) {
    getWikiData(station);
    $('#about-button').text('?')
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
  $("#draggable-side").show();
  $("#sidebar-buttons").show();
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
  var currentText = $('#about-button').text().replace(/^\s+|\s+$/g, '')

  if (currentText == '?') {
    $('#about-button').text('i')
    showAbout()
  } else {
    $('#about-button').text('?')
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

$(document).ready(function() {
  $('#draggable-side').resizable({
    handles: 'e',
    alsoResize: "#close-button-container,#sidebar,#about-button-container"
  });

  $("#close-button").click(function() {
    $("#sidebar").hide();
    $("#draggable-side").hide();
    $("#sidebar-buttons").hide();
  });

  $("#about-button").click(function() {
    toggleAbout()
  })
});

