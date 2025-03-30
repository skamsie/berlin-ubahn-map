// This file is based on John Valley's d3-tube-map
// https://github.com/johnwalley/d3-tube-map

let HIGHLIGHT = true;
let gMap;

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? factory(exports, require('d3'))
    : typeof define === 'function' && define.amd
    ? define(['exports', 'd3'], factory)
    : (global = global || self, factory(global.d3 = global.d3 || {}, global.d3));
}(this, (function (exports, d3) { 'use strict';

  /* ================================================================
     Utility Functions
  ================================================================ */

  /**
   * Create an SVG arc path representing a train stop.
   * @param {number} lineWidth - The width of the line.
   * @returns {Function} D3 arc generator.
   */
  function trainStop(lineWidth) {
    return d3.arc()
      .innerRadius(0)
      .outerRadius(1.37 * lineWidth)
      .startAngle(0)
      .endAngle(2 * Math.PI);
  }

  function normalizeStationName(name) {
    return name.trim().replace(/ \d+$/, '');
  }

  /**
   * Generate an SVG path string for a given line segment.
   * This function DRYs up repeated corrections (for the start and end of segments)
   * and handles line segments (straight, quadratic, and cubic curves).
   *
   * @param {Object} data - The line data object.
   * @param {Function} xScale - D3 scale function for x–axis.
   * @param {Function} yScale - D3 scale function for y–axis.
   * @param {number} lineWidth - The current line width.
   * @param {number} lineWidthTickRatio - The tick ratio.
   * @returns {string} SVG path string.
   */
  function line(data, xScale, yScale, lineWidth, lineWidthTickRatio) {
    let path = '';
    const lineNodes = data.nodes;
    const unitLength = Math.abs(xScale(1) - xScale(0)) !== 0
      ? Math.abs(xScale(1) - xScale(0))
      : Math.abs(yScale(1) - yScale(0));
    const sqrt2 = Math.sqrt(2);

    // Scale the shift coordinates relative to lineWidth and unitLength
    const shiftCoords = [
      (data.shiftCoords[0] * lineWidth) / unitLength,
      (data.shiftCoords[1] * lineWidth) / unitLength,
    ];

    let lastSectionType = 'diagonal'; // default type

    // Helper to compute start/end corrections for a segment.
    // factor should be 1 for start correction and -1 for end correction.
    function computeCorrection(xDiff, yDiff, factor) {
      const base = lineWidth / (2 * lineWidthTickRatio * unitLength);
      if (xDiff === 0 || yDiff === 0) {
        if (xDiff > 0) return [factor * base, 0];
        if (xDiff < 0) return [-factor * base, 0];
        if (yDiff > 0) return [0, factor * base];
        if (yDiff < 0) return [0, -factor * base];
        return [0, 0];
      } else {
        const diag = base / sqrt2;
        return [
          factor * diag * (xDiff > 0 ? 1 : -1),
          factor * diag * (yDiff > 0 ? 1 : -1)
        ];
      }
    }

    // Helper to generate a quadratic curve command based on direction.
    function quadraticPath(points, direction) {
      direction = (direction || 's').toLowerCase();
      // 'n' and 's' share the same control point; likewise 'e' and 'w'
      if (direction === 'e' || direction === 'w') {
        return `Q${points[1][0]},${points[0][1]},${points[1][0]},${points[1][1]}`;
      }
      // default to 'n'/'s'
      return `Q${points[0][0]},${points[1][1]},${points[1][0]},${points[1][1]}`;
    }

    // Helper to compute control points for cubic curves.
    function computeControlPoints(xDiff, points) {
      if (Math.abs(xDiff) === 1) {
        return lastSectionType === 'udlr'
          ? [points[0][0], points[0][1] + (points[1][1] - points[0][1]) / 2]
          : [points[1][0], points[0][1] + (points[1][1] - points[0][1]) / 2];
      }
      if (Math.abs(xDiff) === 2) {
        return lastSectionType === 'udlr'
          ? [points[0][0] + (points[1][0] - points[0][0]) / 2, points[0][1]]
          : [points[0][0] + (points[1][0] - points[0][0]) / 2, points[1][1]];
      }
      return null;
    }

    // Loop over nodes to construct the path.
    for (let i = 0; i < lineNodes.length; i++) {
      if (i > 0) {
        const currNode = lineNodes[i - 1];
        const nextNode = lineNodes[i];
        const xDiff = Math.round(currNode.coords[0] - nextNode.coords[0]);
        const yDiff = Math.round(currNode.coords[1] - nextNode.coords[1]);

        // Calculate correction for the end point if this is the last segment.
        const lineEndCorrection = (i === lineNodes.length - 1)
          ? computeCorrection(xDiff, yDiff, -1)
          : [0, 0];

        const startPoint = [
          xScale(currNode.coords[0] + shiftCoords[0]),
          yScale(currNode.coords[1] + shiftCoords[1])
        ];
        const endPoint = [
          xScale(nextNode.coords[0] + shiftCoords[0] + lineEndCorrection[0]),
          yScale(nextNode.coords[1] + shiftCoords[1] + lineEndCorrection[1])
        ];
        const points = [startPoint, endPoint];

        // Determine segment type and append the appropriate command.
        if (xDiff === 0 || yDiff === 0) {
          lastSectionType = 'udlr';
          path += `L${points[1][0]},${points[1][1]}`;
        } else if (Math.abs(xDiff) === Math.abs(yDiff) && Math.abs(xDiff) > 1) {
          lastSectionType = 'diagonal';
          path += `L${points[1][0]},${points[1][1]}`;
        } else if (Math.abs(xDiff) === 1 && Math.abs(yDiff) === 1) {
          const direction = (nextNode.dir || 's').toLowerCase();
          path += quadraticPath(points, direction);
        } else if (
          (Math.abs(xDiff) === 1 && Math.abs(yDiff) === 2) ||
          (Math.abs(xDiff) === 2 && Math.abs(yDiff) === 1)
        ) {
          const controlPoints = computeControlPoints(xDiff, points);
          if (controlPoints) {
            path += `C${controlPoints[0]},${controlPoints[1]},${controlPoints[0]},${controlPoints[1]},${points[1][0]},${points[1][1]}`;
          }
        }
      } else {
        // First node: compute a starting point with correction.
        const currNode = lineNodes[i];
        const nextNode = lineNodes[i + 1];
        const xDiff = Math.round(currNode.coords[0] - nextNode.coords[0]);
        const yDiff = Math.round(currNode.coords[1] - nextNode.coords[1]);
        const lineStartCorrection = computeCorrection(xDiff, yDiff, 1);
        const startPoint = [
          xScale(currNode.coords[0] + shiftCoords[0] + lineStartCorrection[0]),
          yScale(currNode.coords[1] + shiftCoords[1] + lineStartCorrection[1])
        ];
        path += `M${startPoint[0]},${startPoint[1]}`;
      }
    }

    return path;
  }

  /* ================================================================
     Classes for Lines and Stations
  ================================================================ */

  /**
   * Class representing a collection of tube lines.
   */
  class Lines {
    constructor(lines) {
      this.lines = lines;
    }
    /**
     * Filter out dashed lines and normalize station names, then sort lines by name.
     * @returns {Array} Normalized lines.
     */
    normalizedLines() {
      const filteredLines = this.lines
        .filter(line => !line.dashed)
        .map(line => ({
          name: line.name,
          stations: line.stations.map(station => normalizeStationName(station))
        }));
      return filteredLines.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  function lineList(lines) {
    return new Lines(lines);
  }

  class Stations {
    constructor(stations) {
      this.stations = stations;
    }
    toArray() {
      return Object.keys(this.stations).map(name => {
        const station = this.stations[name];
        station.name = name;
        return station;
      });
    }
    labeledStations() {
      return this.toArray()
        .filter(station => station.lineLabel === true);
    }
    longStations() {
      return this.toArray()
        .filter(station => station.stationSymbol && station.stationSymbol !== 'single');
    }
    normalStations() {
      return this.toArray().filter(station => station.stationSymbol === 'single');
    }
  }

  function stationList(stations) {
    return new Stations(stations);
  }

  /* ================================================================
     Main map (tubeMap) factory function
  ================================================================ */

  /**
   * Create a tube map visualization.
   * @returns {Function} A function that renders the tube map onto a D3 selection.
   */
  function map() {
    let margin = { top: 80, right: 80, bottom: 20, left: 80 };
    let width = 760;
    let height = 640;
    const xScale = d3.scaleLinear();
    const yScale = d3.scaleLinear();
    let lineWidth;
    const lineWidthMultiplier = 0.7;
    const lineWidthTickRatio = 1;
    let svg;
    let _data;

    const listeners = d3.dispatch('click');

    /**
     * Render the tube map into the given selection.
     * @param {d3.Selection} selection - The DOM selection to render the map into.
     */
    function mapRender(selection) {
      selection.each(function(data) {
        _data = transformData(data);

        // Compute domain boundaries based on line node coordinates.
        const minX = d3.min(_data.raw, line => d3.min(line.nodes, node => node.coords[0])) - 1;
        const maxX = d3.max(_data.raw, line => d3.max(line.nodes, node => node.coords[0])) + 1;
        const minY = d3.min(_data.raw, line => d3.min(line.nodes, node => node.coords[1])) - 1;
        const maxY = d3.max(_data.raw, line => d3.max(line.nodes, node => node.coords[1])) + 1;

        const desiredAspectRatio = (maxX - minX) / (maxY - minY);
        const actualAspectRatio = (width - margin.left - margin.right) / (height - margin.top - margin.bottom);
        const ratioRatio = actualAspectRatio / desiredAspectRatio;

        let maxXRange, maxYRange;
        // Note: y–axis is flipped.
        if (desiredAspectRatio > actualAspectRatio) {
          maxXRange = width - margin.left - margin.right;
          maxYRange = (height - margin.top - margin.bottom) * ratioRatio;
        } else {
          maxXRange = (width - margin.left - margin.right) / ratioRatio;
          maxYRange = height - margin.top - margin.bottom;
        }

        xScale.domain([minX, maxX]).range([margin.left, margin.left + maxXRange]);
        yScale.domain([minY, maxY]).range([margin.top + maxYRange, margin.top]);

        const unitLength = Math.abs(xScale(1) - xScale(0)) || Math.abs(yScale(1) - yScale(0));
        lineWidth = lineWidthMultiplier * unitLength;

        svg = d3.select(this)
          .append('svg')
          .style('width', '100%')
          .style('height', '100%');

        gMap = svg.append('g');
      });
    }

    // Setter/getter functions.
    mapRender.width = function(w) {
      if (!arguments.length) return width;
      width = w;
      return mapRender;
    };

    mapRender.height = function(h) {
      if (!arguments.length) return height;
      height = h;
      return mapRender;
    };

    mapRender.margin = function(m) {
      if (!arguments.length) return margin;
      margin = m;
      return mapRender;
    };

    /**
     * Get processed data.
     * @returns {Object} An object containing lines and station data.
     */
    mapRender.data = function() {
      return {
        lines: _data.lines.normalizedLines(),
        stations: _data.stations.stations
      };
    };

    /**
     * Draw all map elements.
     * @param {Object} options - Options to control what extra elements to show.
     */
    mapRender.drawAll = function(options) {
      drawLines();
      drawLineLabels();
      if (options && options['show-wall'] === 'true') {
        drawWall();
      }
      drawStations(_data.stations.normalStations());
      drawLongStations(_data.stations.longStations());
      if (options && options['show-sbahn'] === 'true') {
        drawLabels(true);
      } else {
        drawLabels(false);
      }
    };

    /**
     * Attach event listeners.
     */
    mapRender.on = function() {
      const value = listeners.on.apply(listeners, arguments);
      return value === listeners ? mapRender : value;
    };

    /**
     * Clear any highlighted route and make all lines gray.
     */
    mapRender.clearRoute = function() {
      gMap.selectAll('.highlight-group').remove();
      gMap.selectAll('.routeStations').remove();
      gMap.selectAll('g.lines path').attr('stroke', '#D9D9D9');
    };

    /**
     * Draw a route based on the given steps.
     * @param {Array} routeSteps - Array of route steps with line, from, and to.
     */
    mapRender.drawRoute = function(routeSteps) {
      mapRender.clearRoute();

      const stationRoles = {
        first: routeSteps[0].from,
        last: routeSteps.at(-1).to,
        nodes: []
      };

      if (routeSteps.length > 1) {
        stationRoles.nodes.push(routeSteps[0].to);
        stationRoles.nodes.push(routeSteps.at(-1).from);
        routeSteps.forEach((s, index, arr) => {
          if (index === 0 || index === arr.length - 1) return;
          stationRoles.nodes.push(s.from);
          stationRoles.nodes.push(s.to);
        });
      }
      stationRoles.nodes = [...new Set(stationRoles.nodes)];

      routeSteps.forEach(step => {
        drawRouteSegment(step.line, step.from, step.to, stationRoles);
      });
    };

    // --- Drawing Helper Functions ---

    /**
     * Compare two station names after normalization.
     * @param {string} stationName
     * @param {string} target
     * @returns {boolean} Whether the names match.
     */
    function matchStation(stationName, target) {
      if (typeof stationName !== 'string' || typeof target !== 'string') {
        return false;
      }
      return normalizeStationName(stationName) === normalizeStationName(target);
    }

    /**
     * Draw station markers for a given set of segment nodes.
     * @param {Array} segmentNodes - Array of node objects.
     * @param {Object} stationRoles - Object defining roles (first, last, nodes).
     */
    function drawRouteStations(segmentNodes, stationRoles) {
      const colors = {
        border: 'black',
        first: '#39FF14',
        last: '#FCE883',
        node: '#C0C0C0',
        normal: 'white'
      };

      const stationTypes = ['normalStations', 'longStations'];
      const stationDrawFns = {
        normalStations: drawStations,
        longStations: drawLongStations
      };

      stationTypes.forEach(type => {
        const stations = _data.stations[type]().filter(s =>
          segmentNodes.some(station => matchStation(station.name, s.name))
        );
        stationDrawFns[type](stations, colors.border, colors.normal, 'routeStations');

        stations.forEach(s => {
          const stationName = normalizeStationName(s.name);
          if (stationName === stationRoles.first) {
            stationDrawFns[type]([s], 'black', colors.first, 'routeStations');
          } else if (stationName === stationRoles.last) {
            stationDrawFns[type]([s], 'black', colors.last, 'routeStations');
          } else if (stationRoles.nodes.includes(stationName)) {
            stationDrawFns[type]([s], 'black', colors.node, 'routeStations');
          }
        });
      });
    }

    /**
     * Draw a highlighted segment of a route.
     * @param {Object} lineData - Data for the line.
     * @param {string} startStation - Start station name.
     * @param {string} endStation - End station name.
     * @param {Object} stationRoles - Station role definitions.
     */
    function drawRouteSegment(lineData, startStation, endStation, stationRoles) {
      const nodes = lineData.nodes;
      const startIndex = nodes.findIndex(n => matchStation(startStation, n.name));
      const endIndex = nodes.findIndex(n => matchStation(endStation, n.name));

      const segmentNodes = startIndex <= endIndex
        ? nodes.slice(startIndex, endIndex + 1)
        : nodes.slice(endIndex, startIndex + 1).reverse();

      const segmentLine = {
        name: '__highlight',
        shiftCoords: lineData.shiftCoords,
        nodes: segmentNodes
      };

      gMap.append('g')
        .attr('class', 'highlight-group')
        .selectAll('path')
        .data([segmentLine])
        .enter()
        .append('path')
        .attr('class', 'highlight-segment')
        .attr('d', d => line(d, xScale, yScale, lineWidth, lineWidthTickRatio))
        .attr('stroke', lineData.color)
        .attr('fill', 'none')
        .attr('stroke-width', lineWidth * 1.4);

      drawRouteStations(segmentNodes, stationRoles);
    }

    /**
     * Draw the Berlin Wall on the map.
     */
    function drawWall() {
      drawWallLabel();
      gMap.append('g')
        .attr('class', 'wall')
        .selectAll('wall-path')
        .data([_data.wall])
        .enter()
        .append('path')
        .attr('d', d => line(d, xScale, yScale, lineWidth, lineWidthTickRatio))
        .attr('stroke', 'grey')
        .style('opacity', '0.4')
        .attr('fill', 'none')
        .attr('stroke-width', 0.4 * lineWidth);
    }

    /**
     * Draw the wall label.
     */
    function drawWallLabel() {
      const wallData = [{
        label: "Wall of Berlin",
        x: 206,
        y: -98,
        name: "Wall of Berlin",
        labelPos: "NE",
        labelAngle: 45,
        labelShiftX: 0,
        labelShiftY: 0
      }];

      gMap.append('g')
        .selectAll('text')
        .data(wallData)
        .enter()
        .append('g')
        .classed('wall', true)
        .append('text')
        .text('Wall of Berlin (1961 - 1989)')
        .attr('fill', 'grey')
        .style('font-size', `${3 * lineWidth}px`)
        .attr('dy', 0)
        .attr('x', d => xScale(d.x + d.labelShiftX) + textPos(d).pos[0])
        .attr('y', d => yScale(d.y + d.labelShiftY) - textPos(d).pos[1])
        .attr('text-anchor', d => textPos(d).textAnchor)
        .attr('transform', d => {
          const _x = xScale(d.x + d.labelShiftX) + textPos(d).pos[0];
          const _y = yScale(d.y + d.labelShiftY) - textPos(d).pos[1];
          return `rotate(${d.labelAngle},${_x},${_y})`;
        })
        .style('-webkit-user-select', 'none');
    }

    /**
     * Draw all tube lines.
     */
    function drawLines() {
      gMap.append('g')
        .attr('class', 'lines')
        .selectAll('path')
        .data(_data.lines.lines)
        .enter()
        .append('path')
        .attr('d', d => line(d, xScale, yScale, lineWidth, lineWidthTickRatio))
        .attr('id', d => d.name)
        .attr('stroke', d => d.color)
        .attr('fill', 'none')
        .attr('stroke-width', lineWidth * 1.4)
        .style("stroke-linecap", "round")
        .style("stroke-dasharray", d => {
          const spaces = lineWidth * 2.7;
          return d.dashed ? `${spaces},${spaces + lineWidth}` : `0,0`;
        })
        .classed('line', true);
    }

    /**
     * Draw stations with a "long" marker.
     * @param {Array} longStationsData - Data for long stations.
     * @param {string} fgColor - Foreground color.
     * @param {string} bgColor - Background color.
     * @param {string} extraClass - Extra CSS class.
     */
    function drawLongStations(longStationsData, fgColor = '#000000', bgColor = '#ffffff', extraClass = '') {
      gMap.append('g')
        .selectAll('path')
        .data(longStationsData)
        .enter()
        .append('g')
        .append('rect')
        .attr("rx", lineWidth)
        .attr("ry", lineWidth)
        .attr('width', lineWidth * 2.4)
        .attr('height', d => lineWidth * (d.stationSymbol === 'double' ? 5 : 8))
        .attr('stroke-width', lineWidth / 4)
        .attr('id', d => d.name)
        .attr('transform', d => {
          const offset = 0.8;
          return `translate(${xScale(d.x + d.shiftX * lineWidthMultiplier - offset)},${yScale(d.y + d.shiftY * lineWidthMultiplier + offset)})`;
        })
        .attr('fill', d => d.visited ? fgColor : bgColor)
        .on('click', function(d) {
          listeners.call('click', this, d);
        })
        .on('mouseover', function(d) {
          toggleHighlight(d, lineWidth);
        })
        .on('mouseout', function(d) {
          toggleHighlight(d, lineWidth);
        })
        .attr('stroke', d => d.visited ? bgColor : fgColor)
        .attr('class', d => `station ${extraClass} ${classFromName(d.name)}`)
        .style('cursor', 'pointer');
    }

    /**
     * Draw stations with a "single" marker.
     * @param {Array} normalStationsData - Data for normal stations.
     * @param {string} fgColor - Foreground color.
     * @param {string} bgColor - Background color.
     * @param {string} extraClass - Extra CSS class.
     */
    function drawStations(normalStationsData, fgColor = '#000000', bgColor = '#ffffff', extraClass = '') {
      gMap.append('g')
        .selectAll('path')
        .data(normalStationsData)
        .enter()
        .append('g')
        .attr('id', d => d.name)
        .on('click', function(d) {
          listeners.call('click', this, d);
        })
        .append('path')
        .attr('d', trainStop(lineWidth))
        .attr('transform', d => `translate(${xScale(d.x + d.shiftX * lineWidthMultiplier)},${yScale(d.y + d.shiftY * lineWidthMultiplier)})`)
        .attr('stroke-width', lineWidth / 4)
        .attr('fill', d => d.visited ? fgColor : bgColor)
        .attr('stroke', d => d.visited ? bgColor : fgColor)
        .on('mouseover', function(d) {
          toggleHighlight(d, lineWidth);
        })
        .on('mouseout', function(d) {
          toggleHighlight(d, lineWidth);
        })
        .attr('class', d => `station ${extraClass} ${classFromName(d.name)}`)
        .style('cursor', 'pointer');
    }

    /**
     * Draw image labels for lines.
     */
    function drawLineLabels() {
      gMap.selectAll('image')
        .data(_data.stations.labeledStations())
        .enter()
        .append('g')
        .attr('id', d => d.name)
        .append('image')
        .attr('xlink:href', d => d.lineLabelPath)
        .attr('width', lineWidth * 5.2)
        .attr('height', lineWidth * 5.2)
        .attr('dy', 0)
        .attr('x', d => xScale(d.x + d.lineLabelShiftX) + lineLabelPos(d).pos[0])
        .attr('y', d => yScale(d.y + d.lineLabelShiftY) - lineLabelPos(d).pos[1]);
    }

    /**
     * Draw station text labels.
     * @param {boolean} drawSbahn - Whether to draw the S–Bahn indicator.
     */
    function drawLabels(drawSbahn) {
      gMap.append('g')
        .selectAll('text')
        .data(_data.stations.toArray())
        .enter()
        .append('g')
        .attr('id', d => d.name)
        .classed('label', true)
        .on('click', function(d) {
          listeners.call('click', this, d);
        })
        .append('text')
        .text(d => d.label)
        .attr('fill', d => d.inactive ? 'grey' : 'black')
        .style('font-size', `${3 * lineWidth}px`)
        .style('font-weight', d => d.labelBold ? '700' : '400')
        .on('mouseover', function(d) {
          toggleHighlight(d, lineWidth);
        })
        .on('mouseout', function(d) {
          toggleHighlight(d, lineWidth);
        })
        .attr('dy', 0)
        .attr('x', d => xScale(d.x + d.labelShiftX) + textPos(d).pos[0])
        .attr('y', d => yScale(d.y + d.labelShiftY) - textPos(d).pos[1])
        .attr('text-anchor', d => textPos(d).textAnchor)
        .attr('transform', d => {
          const _x = xScale(d.x + d.labelShiftX) + textPos(d).pos[0];
          const _y = yScale(d.y + d.labelShiftY) - textPos(d).pos[1];
          return `rotate(${d.labelAngle},${_x},${_y})`;
        })
        .attr('class', d => `label ${d.labelBold ? 'bold-label' : ''} ${classFromName(d.name)}`)
        .style('display', d => d.hide !== true ? 'block' : 'none')
        .style('text-decoration', d => d.closed ? 'line-through' : 'none')
        .style('-webkit-user-select', 'none')
        .classed('highlighted', d => d.visited)
        .call(wrap, d => textPos(d).alignmentBaseline)
        .append('tspan')
        .classed('sbahn', true)
        .style('fill', 'green')
        .text(d => {
          if (drawSbahn === true) {
            const spacingBefore = d.sBahnLabelNoBeforeSpace ? '' : ' ';
            const spacingAfter = d.sBahnLabelAfterSpace ? ' ' : '';
            return d.sBahn ? `${spacingBefore}S${spacingAfter}` : '';
          }
          return '';
        })
        .attr('dy', 0)
        .style('font-weight', 400)
        .call(wrap, d => textPos(d).alignmentBaseline);
    }

    /* ================================================================
       Data Transformation Functions
    ================================================================ */

    function transformData(data) {
      return {
        raw: data.lines,
        wall: data.wall,
        stations: extractStations(data),
        lines: extractLines(data.lines),
      };
    }

    function extractStations(data) {
      data.lines.forEach(line => {
        line.nodes.forEach(d => {
          if (!d.hasOwnProperty('name')) return;
          if (!data.stations.hasOwnProperty(d.name))
            throw new Error('Cannot find station with key: ' + d.name);
          const station = data.stations[d.name];
          station.x = d.coords[0];
          station.y = d.coords[1];
          station.labelAngle = d.hasOwnProperty('labelAngle') ? d.labelAngle : 0;
          station.sBahn = d.sBahn === true;
          station.sBahnLabelNoBeforeSpace = d.sBahnLabelNoBeforeSpace === true;
          station.sBahnLabelAfterSpace = d.sBahnLabelAfterSpace === true;
          station.labelBold = d.hasOwnProperty('labelBold') ? d.labelBold : false;
          station.inactive = d.hasOwnProperty('inactive') && d.inactive;
          station.stationSymbol = d.hasOwnProperty('stationSymbol') ? d.stationSymbol : 'single';

          if (d.lineLabel === true) {
            station.lineLabel = true;
            station.lineLabelPos = d.lineLabelPos;
            station.lineLabelPath = d.lineLabelPath;
            station.lineLabelShiftX = d.lineLabelShiftX || 0;
            station.lineLabelShiftY = d.lineLabelShiftY || 0;
          } else {
            station.lineLabel = false;
          }

          if (station.labelPos === undefined) {
            station.labelPos = d.labelPos;
            station.labelShiftX = d.hasOwnProperty('labelShiftCoords')
              ? d.labelShiftCoords[0]
              : d.hasOwnProperty('shiftCoords')
              ? d.shiftCoords[0]
              : line.shiftCoords[0];
            station.labelShiftY = d.hasOwnProperty('labelShiftCoords')
              ? d.labelShiftCoords[1]
              : d.hasOwnProperty('shiftCoords')
              ? d.shiftCoords[1]
              : line.shiftCoords[1];
          }

          station.label = data.stations[d.name].label;
          station.position = data.stations[d.name].position;
          station.closed = data.stations[d.name].hasOwnProperty('closed')
            ? data.stations[d.name].closed
            : false;
          station.visited = false;

          if (!d.hide) {
            station.shiftX = d.hasOwnProperty('shiftCoords') ? d.shiftCoords[0] : line.shiftCoords[0];
            station.shiftY = d.hasOwnProperty('shiftCoords') ? d.shiftCoords[1] : line.shiftCoords[1];
          }
        });
      });
      return stationList(data.stations);
    }

    function extractLines(data) {
      const lines = [];
      data.forEach(line => {
        const lineObj = {
          name: line.name,
          title: line.label,
          dashed: line.hasOwnProperty("dashed") && line.dashed,
          stations: [],
          color: line.color,
          shiftCoords: line.shiftCoords,
          nodes: line.nodes,
          highlighted: false,
        };
        lines.push(lineObj);
        line.nodes.forEach(d => {
          if (!d.hasOwnProperty('name')) return;
          lineObj.stations.push(d.name);
        });
      });
      return lineList(lines);
    }

    /**
     * Get text positioning for a station label.
     * @param {Object} data - Station data.
     * @returns {Object} Object with pos, textAnchor, and alignmentBaseline.
     */
    function textPos(data) {
      return itemPos(data, "labelPos");
    }

    /**
     * Get text positioning for a line label.
     * @param {Object} data - Station data.
     * @returns {Object} Object with pos, textAnchor, and alignmentBaseline.
     */
    function lineLabelPos(data) {
      return itemPos(data, "lineLabelPos");
    }

    /**
     * Compute positioning details based on a given item (labelPos or lineLabelPos).
     * @param {Object} data - Station data.
     * @param {string} item - The property name for position.
     * @returns {Object} Object with pos, textAnchor, and alignmentBaseline.
     */
    function itemPos(data, item) {
      let pos, textAnchor, alignmentBaseline;
      const offset = lineWidth * 1.8;
      const numLines = data.label.split(/\n/).length;
      const diagFactor = Math.sqrt(2);

      switch (data[item].toLowerCase()) {
        case 'n':
          pos = [0, 2.1 * lineWidth * (numLines - 0.5) + offset];
          textAnchor = 'middle';
          alignmentBaseline = 'baseline';
          break;
        case 'ne':
          pos = [offset / diagFactor, (lineWidth * (numLines - 1) + offset) / diagFactor];
          textAnchor = 'start';
          alignmentBaseline = 'baseline';
          break;
        case 'e':
          pos = [offset, -2];
          textAnchor = 'start';
          alignmentBaseline = 'baseline';
          break;
        case 'se':
          pos = [offset / diagFactor, -offset / diagFactor];
          textAnchor = 'start';
          alignmentBaseline = 'hanging';
          break;
        case 's':
          pos = [0, -lineWidthMultiplier * offset];
          textAnchor = 'middle';
          alignmentBaseline = 'hanging';
          break;
        case 'sw':
          pos = [-offset / diagFactor, -offset / diagFactor];
          textAnchor = 'end';
          alignmentBaseline = 'hanging';
          break;
        case 'w':
          pos = [-offset, -2];
          textAnchor = 'end';
          alignmentBaseline = 'baseline';
          break;
        case 'nw':
          pos = [-(lineWidth * (numLines - 1) + offset) / diagFactor, (lineWidth * (numLines - 1) + offset) / diagFactor];
          textAnchor = 'end';
          alignmentBaseline = 'baseline';
          break;
      }
      return { pos, textAnchor, alignmentBaseline };
    }

    /**
     * Generate a class name from a station name.
     * @param {string} currentName - The station name.
     * @returns {string} Sanitized class name.
     */
    function classFromName(currentName) {
      return currentName.replace(/[()0-9 ]/g, '');
    }

    /**
     * Toggle highlight for a station and its label.
     * @param {Object} d - Station data.
     * @param {number} lineWidth - Current line width.
     */
    function toggleHighlight(d, lineWidth) {
      if (!HIGHLIGHT) return;
      const station = d3.selectAll('.station.' + classFromName(d.name));
      const label = d3.selectAll('.label.' + classFromName(d.name));

      if (station.attr('highlighted') === 'true') {
        station.attr('highlighted', 'false')
          .attr('fill', station.attr('current') === 'true' ? 'black' : 'white')
          .attr('stroke-width', lineWidth / 4);
        label.attr('highlighted', 'false')
          .style('text-decoration', 'none');
      } else {
        station.attr('highlighted', 'true')
          .attr('stroke-width', lineWidth / 2);
        label.attr('highlighted', 'false')
          .style('text-decoration', 'underline');
      }
    }

    /**
     * Wrap text into multiple lines in an SVG text element.
     * @param {d3.Selection} text - The D3 selection of text.
     * @param {Function} baseline - A function that returns the baseline.
     */
    function wrap(text, baseline) {
      text.each(function() {
        const textEl = d3.select(this);
        const lines = textEl.text().split(/\n/);
        const x = textEl.attr('x');
        const y = textEl.attr('y');
        const dy = parseFloat(textEl.attr('dy'));
        textEl.text(null)
          .append('tspan')
          .attr('x', x)
          .attr('y', y)
          .attr('dy', dy + 'em')
          .attr('dominant-baseline', baseline)
          .text(lines[0]);
        for (let i = 1; i < lines.length; i++) {
          textEl.append('tspan')
            .attr('x', x)
            .attr('y', y)
            .attr('dy', (i * 1.1 + dy) + 'em')
            .attr('dominant-baseline', baseline)
            .text(lines[i]);
        }
      });
    }

    // Return the main mapRender function.
    return mapRender;
  }

  exports.tubeMap = map;
  Object.defineProperty(exports, '__esModule', { value: true });

})));
