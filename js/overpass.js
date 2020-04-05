function getPointsOfInterest(station) {
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

      var pointsOfInterest = '<h3>Around ' + station.name + '</h3>';

      $.each(formattedData, function(_, poi) {
        address = poi.address ? poi.address + '<br />' : ''
        website = poi.website ? '<a href="' + poi.website + '">' + poi.website + '</a><br />' : ''
        pointsOfInterest += '<p><b>' + poi.name + '</b><br />' +
          address + website + 'tags: ' + poi.tags
      })

      showSidebar(pointsOfInterest)
    }
  });
};

function overpassApiQuery(lat, lon) {
  var aroundLocation = '(around:600,' + lat + ',' + lon + ');';
  var q = 'https://lz4.overpass-api.de/api/interpreter?data=[out:json];(' +
    'node[~"tourism|leisure"~"museum|gallery|attraction"]' + aroundLocation +
    'way[~"tourism|leisure"~"museum|gallery|attraction"]' + aroundLocation +
    ')->._;out;'
  return q
}

// empty string if undefined
function fo(e) {
  return e === undefined ? '' : e
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

