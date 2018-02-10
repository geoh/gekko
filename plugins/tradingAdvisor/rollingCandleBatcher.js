/**
 * Due to limitations in the number of time periods that Tulip and Talib
 * indicators can process without error, if we wish to run strategies at a one
 * minute tick then it is useful to have a more flexible method of batching up
 * candles.
 *
 * @var candleHistory int Number of cached small candles used to create new candle
 * @var updateFrequency int Frequency at which to emit newly created candles
 *
 * Examples:
 *  - History: 1, Frequency: 1 = Create a new candle upon each candle written,
 *    using the last candle that was written, eg: no change.
 *  - History: 60, Frequency: 60 = Create a new candle every hour, using the
 *    latest 60 small candles information. Minics CandleBatcher(60) behavour.
 *  - History: 5, Frequency: 30 = Create a new candle every half hour that has
 *    only five candles / minutes of information in it. Possibly not useful.
 *  - History: 10, Frequency: 1 = Create a new candle every minute, using the
 *    information from the latest 10 candles, rolling forwards minute by minute.
 *  - History: 60 * 24, Frequency: 60 = Create candles containing a days worth
 *    of information every hour - allowing more frequent updates for trade data
 *    that spans longer time periods. This is the key purpose.
 *
 * @type RollingCandleBatcher
 */

var _ = require('lodash');
var util = require('../../core/util');
var log = require('../../core/log.js');

var RollingCandleBatcher = function(candleHistory, updateFrequency = 1, allowPartialFirst = true) {
  if(!_.isNumber(candleHistory))
    throw 'candleHistory is not a number';

  this.candleHistory = candleHistory;
  this.updateFrequency = updateFrequency;
  this.requiredHistory = allowPartialFirst ? 0 : candleHistory;

  this.age = 0;
  this.smallCandles = [];

  _.bindAll(this);
}

util.makeEventEmitter(RollingCandleBatcher);

RollingCandleBatcher.prototype.write = function(candles) {
  if(!_.isArray(candles))
    throw 'candles is not an array';

  _.each(candles, function(candle) {
    this.age++;

    this.smallCandles.push(candle);

    if (this.age > this.candleHistory)
      this.smallCandles.shift();

    if (this.age > this.requiredHistory && this.age % this.updateFrequency == 0)
      this.calculate();
  }, this);
}

RollingCandleBatcher.prototype.calculate = function() {
  var total = _.size(this.smallCandles);
  var remainder = total % this.candleHistory;
  var loops = (total - remainder) / this.candleHistory;

  for (var i = 0; i < loops; i++) {
    var start = i * this.candleHistory;
    var end = start + this.candleHistory;
    this.makeCandle(start, end);
  }

  if (remainder) {
    var start = total - remainder;
    this.makeCandle(start, total);
  }
}

RollingCandleBatcher.prototype.makeCandle = function(start, end) {
  var candle = {
    start: this.smallCandles[start].start,
    open: this.smallCandles[start].open,
    vwp: 0,
    volume: 0,
    trades: 0,
    created: null
  };

  for (var i = start; i < end; i++) {
    var c = this.smallCandles[i];
    candle.high = _.max([candle.high, c.high]);
    candle.low = _.min([candle.low, c.low]);
    candle.close = c.close;
    candle.volume += c.volume;
    candle.vwp += c.vwp * c.volume;
    candle.trades += c.trades;
    candle.created = c.start;
  }

  if (candle.volume)
    candle.vwp /= candle.volume;
  else
    candle.vwp = candle.open;

  this.emit('candle', candle);
}

module.exports = RollingCandleBatcher;
