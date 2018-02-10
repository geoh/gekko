var _ = require('lodash');
var log = require('../core/log');
var util = require('../core/util');
var CandleBatcher = require('../core/candleBatcher');
var RollingCandleBatcher = require('../plugins/tradingAdvisor/rollingCandleBatcher');

var highcharts = require('./tools/highchartsIndicatorLibrary')();

// Let's create our own strat
var strat = {};

// Prepare everything our method needs
strat.init = function() {
  // Initialise charts
  highcharts.init(this);

  this.count = 0;
  this.currentAdvice = 'short';
  this.currentDate = null;
  this.requiredHistory = this.tradingAdvisor.historySize;

  // TO GET BEST CHART VIEW WITH THESE SETTINGS - JUST BACKTEST 12 HOURS OF DATA

  // Quick and easy, updates once a minute with data from a single candle
  // The second (candleHistory) and third (updateFrequency) parameters default to 1
  highcharts.tulipBbands({optInTimePeriod: 16, optInNbStdDevs: 4}/*, 1, 1 */);

  // Custom indicator name, access with: this.tulipIndicators.my_macd
  // Set to update every minute but includes the previous 30 minutes candle data
  highcharts.tulipMacd({optInFastPeriod: 12, optInSlowPeriod: 26, optInSignalPeriod: 9}, 30, 1, 'my_macd');

  // Options overrides parameter defaults to the yAxis ID if passed a string
  // Set to update every minute and include the previous 5 minutes worth of data
  highcharts.tulipAroon({optInTimePeriod: 12}, 5, 1, 'aroon', 'second');

  // Option overrides applied to all series plots for the indicator
  // Set to update every 15 minutes but include data for the previous thirty
  highcharts.tulipAdx({optInTimePeriod: 12}, 30, 15, 'adx', {color: '#FF0000', yAxis: 'third'});

  // Custom option applied to only a single series plot for the indicator
  highcharts.tulipDi({optInTimePeriod: 12}, 30, 15, 'di', 'third', {diMinus: {dashStyle: 'Dash'}});

  // Add indicator without using the library if you want to...
  // This indicator updates every 10 minutes using 10 minutes worth of data, but
  // only draws markers on the plot. All options are passed directly to highcharts
  this.addTulipIndicator('custom_adx', 'adx', {optInTimePeriod: 12}, 10, 10, {
    result: { template: 'markers', name: 'Custom ADX', yAxis: 'third', color: '#000000', marker: {radius: 6} }
  });
}

// What happens on every new candle?
strat.update = function(candle) {
  // Manually send the Volume Weighted Price to the UI
  this.emitIndicatorDataToUI({
    name: 'VWP',
    date: candle.start,
    result: { result: candle.vwp },
    chart: { result: { name: 'VWP', yAxis: 'primary', color: '#44bc36', zIndex: 2 } }
  });

  this.count++;
  this.currentDate = candle.start;
}

// For debugging purposes.
strat.log = function() {
  
}

// Check if we should profer advice
strat.check = function(candle) {
  var adx = this.tulipIndicators.adx.result.result;
  var diPlus = this.tulipIndicators.di.result.diPlus;
  var diMinus = this.tulipIndicators.di.result.diMinus;

  // Your strategy here...
  if (this.count == 240) {
    this.buy(`Purchased because the count is: ${this.count}`);
  }

  if (this.count == 480) {
    this.sell(`Sold because the count is: ${this.count}`);
  }
}

strat.buy = function(report = 'Purchase') {
  if (this.isShort()) {
    this.advice('long');

    this.emitIndicatorDataToUI({
      name: 'trade',
      date: this.currentDate,
      result: { result: 'B', fillColor: '#8dff00', text: report },
      chart: { result: { template: 'flags', name: 'Trade' } }
    });

    this.currentAdvice = 'long';
  }
}

strat.sell = function(report = 'Sale') {
  if (this.isLong()) {
    this.advice('short');

    this.emitIndicatorDataToUI({
      name: 'trade',
      date: this.currentDate,
      result: { result: 'S', fillColor: '#f6011a', text: report },
      chart: { result: { template: 'flags', name: 'Trade' } }
    });

    this.currentAdvice = 'short';
  }
}

strat.isLong = function() {
  return this.currentAdvice === 'long';
}

strat.isShort = function() {
  return this.currentAdvice === 'short';
}

module.exports = strat;
