import _ from 'lodash';
// global moment
global._ = _; // Set lodash as global for indicator series templates

var Highcharts = require('highcharts/highstock.src.js');
require('./overrides.js')(Highcharts);
require('highcharts/modules/drag-panes')(Highcharts);

// This function is used to add up custom information for the tooltip when
// highcharts has automatically grouped the data points together
var customPointData = function(point, key) {
  if (typeof point[key] !== "undefined") {
    return point[key];
  } else if (typeof point.dataGroup !== "undefined") {
    var index = point.dataGroup.start;
    var length = index + point.dataGroup.length;
    var value = 0;
    while (++index < length) {
      value += point.series.options.data[index][key];
    }
    return value;
  }
}

export default function(_data, _trades, _report, _results, _height) {
  // Here we map out our market candle and volume data
  var volume = [];
  var data = _.map(_data, (candle) => {
      var isUp = candle.close >= candle.open;
      volume.push({
        x: moment(candle.start).unix() * 1000,
        y: candle.volume,
        color: isUp ? '#6e9270' : '#b54b70',
        open: candle.open,
        close: candle.close
      });
      return {
        x: moment(candle.start).unix() * 1000,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        trades: candle.trades
      }
  });

  // Map trades with appropriate colors
  var trades = _.map(_trades, (trade) => {
    var isBuy = trade.action === 'buy';
    return {
      x: moment(trade.date).unix() * 1000,
      y: trade.price,
      color: isBuy ? '#8dff00' : '#f6011a'
    }
  });

  var chartOptions = {
    chart: {
      renderTo: 'resultHighchart',
      zoomType: 'x',
      height: _height
    },
    legend: {
      enabled: true,
      align: 'center',
      backgroundColor: '#FFFFFF',
      borderColor: 'black',
      borderWidth: 0,
      layout: 'horizontal',
      verticalAlign: 'bottom',
      y: 0,
      shadow: false,
      floating: false
    },
    rangeSelector: {
      allButtonsEnabled: true,
      buttons: [{ type: 'hour', count: 1, text: '1h' },
                { type: 'hour', count: 3, text: '3h' },
                { type: 'hour', count: 6, text: '6h' },
                { type: 'hour', count: 12, text: '12h' },
                { type: 'day', count: 1, text: '1d' },
                { type: 'week', count: 1, text: '7d'},
                { type: 'month', count: 1, text: '1m' },
                { type: 'month', count: 3, text: '3m' },
                { type: 'year', count: 1, text: '1y' },
                { type: 'ytd', count: 1, text: 'YTD' },
                { type: 'all', text: 'ALL' }],
      selected: 10,
      inputEnabled: true,
      enabled: true
    },
    // Tooltip is fixed to the top left of the chart - much easier to read
    tooltip: {
      padding: 3,
      shared: true,
      split: false,
      positioner: (w, h, p) => { return { x: 10, y: 40 } }
    },
    // Boost disabled so that large datasets can be displayed with custom colors
    boost: {
      enabled: false
    },
    xAxis: {
      gridLineWidth: 1,
      gridLineColor: '#f4f4f4'
    },
    yAxis: [{ // Primary yAxis
      id: 'primary',
      opposite: true,
      height: '70%',
      resize: {
        enabled: true
      },
      title: {
        text: `${_report.asset}-${_report.currency} Trades`,
        style: {
          color: '#7cb5ec'
        }
      }
    }, { // Volume yAxis Overlay
      id: 'volume',
      gridLineWidth: 0,
      top: '60%',
      height: '10%'
    }, { // First row for indicators
      id: 'first',
      opposite: true,
      top: '70%',
      height: '10%',
      offset: 2,
      title: {
        text: ''
      },
    }, { // Second row for indicators
      id: 'second',
      opposite: true,
      top: '80%',
      height: '10%',
      offset: 2,
      title: {
        text: ''
      }
    }, { // Second row for indicators
      id: 'third',
      opposite: true,
      top: '90%',
      height: '10%',
      offset: 2,
      title: {
        text: ''
      }
    }],
    series: [{ // Main market data series
      type: 'candlestick',
      id: 'trades',
      name: `${_report.asset}-${_report.currency}`,
      data: data,
      yAxis: 'primary',
      zIndex: 1,
      tooltip: {
        // Custom tooltip to include number of trades
        pointFormatter: function() {
          return `<span style="color:${this.color}">●</span>
<b>${this.series.name}</b><br/>
Open: ${this.open}<br/>
High: ${this.high}<br/>
Low: ${this.low}<br/>
Close: ${this.close}<br/>
Trades: ${customPointData(this, 'trades')}<br/>`
          }
      },
      turboThreshold: Infinity,
      dataGrouping: {
        groupPixelWidth: 4,
        smoothed: true
      }
    }, { // Data series for the actual trades
      type: 'line',
      id: 'trades',
      name: "Trades",
      data: trades,
      lineWidth: 0,
      marker: {
        enabled: true,
        radius: 4
      },
      states: {
          hover: {
              lineWidthPlus: 0
          }
      },
      zIndex: 2,
      enableMouseTracking: false,
      turboThreshold: Infinity,
      dataGrouping: {
        enabled: false
      }
    }, { // Data series for the volume information columns
      type: 'column',
      id: 'volume',
      name: 'Volume',
      data: volume,
      yAxis: 'volume',
      turboThreshold: Infinity,
      dataGrouping: {
        groupPixelWidth: 4,
        smoothed: true
      },
      // Custom color override function to produce red and green colors when
      // chart data is grouped due to viewing more points than will fit on
      // screen. This is triggered by the code in './overrides.js'
      colorOverride: function(point) {
        if (typeof point.dataGroup != "undefined") {
          var index = point.dataGroup.start;
          var length = index + point.dataGroup.length;
          var data = [];
          while (++index < length) {
            data.push(point.series.options.data[index]);
          }
          if (_.size(data)) {
            var isUp = _.last(data).close >= _.first(data).open;
            point.color = isUp ? '#6e9270' : '#b54b70';
          }
        }
      }
    }]
  }

  // For each set of indicator results, check to see if there is an options
  // template set, otherwise include the standard line graph settings
  _.each(_results, indicator => {
    _.each(indicator.chart, function(options, index) {
      if ('template' in options)
        require('./indicators/' + options.template)(indicator, index, chartOptions);
      else
        require('./indicators/line')(indicator, index, chartOptions);
    });
  });

  // Because having a space in the middle is just confusing to the eyes!
  Highcharts.setOptions({
    lang: {
      thousandsSep: ''
    }
  });

  return Highcharts.stockChart(chartOptions);
}
