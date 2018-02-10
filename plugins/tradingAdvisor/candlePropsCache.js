/**
 * Both Tulip and Talib indicators require a large number of historical values
 * inserted on each calculation, for indicators that use the same settings we
 * can share this cache of properties.
 *
 * @var candleHistory int @see RollingCandleBatcher
 * @var updateFrequency int @see RollingCandleBatcher
 * @var cacheSize int The maximum length of each array of property values
 *
 * @type CandlePropsCache
 */

var _ = require('lodash');
var util = require('../../core/util');
var RollingCandleBatcher = require('./rollingCandleBatcher');

var CandlePropsCache = function(candleHistory, updateFrequency, cacheSize = 1000) {
  this.candleHistory = candleHistory;
  this.updateFrequency = updateFrequency ? updateFrequency : candleHistory;
  this.candlePropsCacheSize = cacheSize;

  if (this.candleHistory > 1) {
    var cache = this;
    this.batcher = new RollingCandleBatcher(candleHistory, this.updateFrequency);
    this.batcher.on('candle', function(candle) {
      cache.update(candle);
      cache.emit('candle', candle);
    });
  }

  this.reset();

  _.bindAll(this);
}

util.makeEventEmitter(CandlePropsCache);

CandlePropsCache.prototype.reset = function() {
  this.age = 0;
  this.candleProps = {
    open: [],
    high: [],
    low: [],
    close: [],
    volume: [],
    vwp: [],
    trades: []
  };
}

CandlePropsCache.prototype.write = function(candles) {
  if(!_.isArray(candles))
    throw 'candles is not an array';

  if (this.candleHistory > 1) {
    this.batcher.write(candles);
  } else {
    _.each(candles, function(candle) {
      this.update(candle);
      this.emit('candle', candle);
    }, this);
  }
}

CandlePropsCache.prototype.update = function(candle) {
  this.age++;

  this.candleProps.open.push(candle.open);
  this.candleProps.high.push(candle.high);
  this.candleProps.low.push(candle.low);
  this.candleProps.close.push(candle.close);
  this.candleProps.volume.push(candle.volume);
  this.candleProps.vwp.push(candle.vwp);
  this.candleProps.trades.push(candle.trades);

  if (this.age > this.candlePropsCacheSize) {
    this.candleProps.open.shift();
    this.candleProps.high.shift();
    this.candleProps.low.shift();
    this.candleProps.close.shift();
    this.candleProps.volume.shift();
    this.candleProps.vwp.shift();
    this.candleProps.trades.shift();
  }
}

module.exports = CandlePropsCache;
