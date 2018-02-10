'use strict';
module.exports = function(indicator, index, options) {
  var chart = indicator.chart[index];
  // Here we can send extra data through with each indicator result, eg: 'text'
  // or 'fillColor', this is great for outputting custom strategy calculations
  var data = _.map(
    indicator.results,
    (value, date) => { return {
      x: moment(date).unix() * 1000,
      title: value[index],
      text: 'text' in value ? value['text'] : '',
      fillColor: 'fillColor' in value ? value['fillColor'] : ''
    }}
  );

  // Default options for flags
  var series = {
    name: index,
    type: 'flags',
    data: data,
    onSeries: 'trades',
    allowOverlapX: true,
    lineColor: '#aaaaaa',
    y: -80,
    turboThreshold: Infinity
  };

  _.merge(series, chart);

  options.series.push(series);
};
