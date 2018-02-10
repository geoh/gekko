'use strict';
module.exports = function(indicator, index, options) {
  var chart = indicator.chart[index];
  // Here we map the indicator results to the chart data, this could be an
  // object instead with the properties of: x, y, name, color
  var data = _.map(
    indicator.results,
    (value, date) => [moment(date).unix() * 1000, value[index]]
  );

  // Default options for line graph
  var series = {
    name: index,
    data: data,
    yAxis: 'first',
    lineWidth: 1,
    turboThreshold: Infinity,
    marker: {
      enabled: null,
      enabledThreshold: 4,
      radius: 2
    },
    dataGrouping: {
      groupPixelWidth: 4,
      smoothed: true
    }
  }

  _.merge(series, chart);

  options.series.push(series);
};
