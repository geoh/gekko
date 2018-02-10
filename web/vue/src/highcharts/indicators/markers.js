'use strict';
module.exports = function(indicator, index, options) {
  var chart = indicator.chart[index];
  // Here we map the indicator results to the marker points, this could be an
  // object instead with the properties of: x, y, name, color
  var data = _.map(
    indicator.results,
    (value, date) => [moment(date).unix() * 1000, value[index]]
  );

  // Default options for markers
  var series = {
    name: index,
    data: data,
    yAxis: 'first',
    lineWidth: 0,
    marker: {
      enabled: true
    },
    states: {
      hover: {
        lineWidthPlus: 0
      }
    },
    turboThreshold: Infinity
  }

  _.merge(series, chart);

  options.series.push(series);
};
