/**
 * Some convenient functions to easily add indicator results to the highcharts
 * chart in ui.
 *
 * @type {}
 */

var _ = require('lodash');

module.exports = function() {
  var charts = {};

  charts.init = function(strategy) {
    this.strategy = strategy;
  }

  charts.mergeConfig = function(config, override) {
    if (_.isObject(override)) {
      if (_.first(_.keys(override)) in config) {
        _.each(override, function(result, key) {
          _.assign(config[key], result);
        })
      } else {
        _.each(config, function(result) {
          _.assign(result, override);
        });
      }
    } else if (_.isString(override)) {
      _.each(config, function(item) {
        item.yAxis = override;
      })
    }

    return config;
  }

  charts.tulipAdx = function(options, candleSize = 1, updateFrequency = 1, name='adx', override) {
    charts.strategy.addTulipIndicator(name, 'adx', options, candleSize, updateFrequency, charts.mergeConfig({
      result: { name: 'ADX', yAxis: 'first', color: '#333333' }
    }, override));
  }

  charts.tulipAroon = function(options, candleSize = 1, updateFrequency = 1, name='aroon', override) {
    charts.strategy.addTulipIndicator(name, 'aroon', options, candleSize, updateFrequency, charts.mergeConfig({
      aroonUp: { name: 'Aroon Up', yAxis: 'first', color: '#6e9270' },
      aroonDown: { name: 'Aroon Down', yAxis: 'first', color: '#b54b70' }
    }, override));
  }

  charts.tulipBbands = function(options, candleSize = 1, updateFrequency = 1, name='bbands', override) {
    charts.strategy.addTulipIndicator(name, 'bbands', options, candleSize, updateFrequency, charts.mergeConfig({
      bbandsUpper: { name: 'Bollinger Upper', yAxis: 'primary', color: '#f700ff' },
      bbandsMiddle: { name: 'Bollinger Middle', yAxis: 'primary', color: '#f700ff', dashStyle: 'Dot' },
      bbandsLower: { name: 'Bollinger Lower', yAxis: 'primary', color: '#f700ff' }
    }, override));
  }

  charts.tulipDi = function(options, candleSize = 1, updateFrequency = 1, name='di', override) {
    charts.strategy.addTulipIndicator(name, 'di', options, candleSize, updateFrequency, charts.mergeConfig({
      diPlus: { name: 'DI+', yAxis: 'first', color: '#6e9270' },
      diMinus: { name: 'DI-', yAxis: 'first', color: '#b54b70' }
    }, override));
  }

  charts.tulipEma = function(options, candleSize = 1, updateFrequency = 1, name='ema', override) {
    charts.strategy.addTulipIndicator(name, 'ema', options, candleSize, updateFrequency, charts.mergeConfig({
      result: { name: 'EMA', yAxis: 'primary' }
    }, override));
  }

  charts.tulipMacd = function(options, candleSize = 1, updateFrequency = 1, name='macd', override) {
    charts.strategy.addTulipIndicator(name, 'macd', options, candleSize, updateFrequency, charts.mergeConfig({
      macd: { name: 'MACD', yAxis: 'first', color: '#080808', zIndex: 5 },
      macdSignal: { name: 'MACD Signal', yAxis: 'first', color: '#f51b28' },
      //macdHistogram: { name: 'MACD Histogram', yAxis: 'first', color: '#97bcb7' } // border: #525994
    }, override));
  }

  return charts;
}
