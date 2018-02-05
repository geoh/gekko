var _ = require('lodash');
var util = require('./util');
var CandleBatcher = require('./candleBatcher');

var CandleDynamicBatcher = function(candleSize, requiredHistory) {
  if(!_.isNumber(candleSize))
    throw 'candleSize is not a number';

  this.candleSize = candleSize;
  this.requiredHistory = requiredHistory ? requiredHistory : 0;

  this.setup = false;
  this.age = 0;
  this.smallCandles = [];
  this.smallCandleCacheSize = 20160; // Two weeks

  this.batcher = new CandleBatcher(this.candleSize);

  _.bindAll(this);
}

util.makeEventEmitter(CandleDynamicBatcher);

CandleDynamicBatcher.prototype.init = function() {
  if (!this.setup) {
    this.batcher.on('candle', this.saveCandle);
    this.setup = true;
  }
}

CandleDynamicBatcher.prototype.write = function(candles) {
  if(!_.isArray(candles))
    throw 'candles is not an array';

  _.each(candles, function(candle) {
    this.age++;
    this.smallCandles.push(candle);
    if (this.age > this.smallCandleCacheSize)
      this.smallCandles.shift();
    if (this.age > this.requiredHistory)
      this.process();
  }, this);
}

CandleDynamicBatcher.prototype.process = function(candle) {
  this.init();

  this.emit('reset');
  this.batcher.smallCandles = [];
  this.candles = [];

  var remainder = _.size(this.smallCandles) % this.candleSize;
  var inputCandles = _.rest(this.smallCandles, remainder);

  _.each(inputCandles, function(c) {
    this.batcher.write([c]);
  }, this);
}

CandleDynamicBatcher.prototype.saveCandle = function(candle) {
  this.emit('candle', candle);
}

module.exports = CandleDynamicBatcher;
