var _ = require('lodash');
var fs = require('fs');
var util = require('../../core/util');
var config = util.getConfig();
var dirs = util.dirs();
var log = require(dirs.core + 'log');
var cp = require(dirs.core + 'cp');
var CandleBatcher = require('../../core/candleBatcher');
var CandlePropsCache = require('./candlePropsCache');
var RollingCandleBatcher = require('./rollingCandleBatcher');

var ENV = util.gekkoEnv();
var mode = util.gekkoMode();
var startTime = util.getStartTime();

var talib = require(dirs.core + 'talib');
if(talib == null) {
  log.warn('TALIB indicators could not be loaded, they will be unavailable.');
}

var tulind = require(dirs.core + 'tulind');
if(tulind == null) {
  log.warn('TULIP indicators could not be loaded, they will be unavailable.');
}

var indicatorsPath = dirs.methods + 'indicators/';
var indicatorFiles = fs.readdirSync(indicatorsPath);
var Indicators = {};

_.each(indicatorFiles, function(indicator) {
  const indicatorName = indicator.split(".")[0];
  if (indicatorName[0] != "_")
    try {
      Indicators[indicatorName] = require(indicatorsPath + indicator);
    } catch (e) {
      log.error("Failed to load indicator", indicatorName);
    }
});

var allowedIndicators = _.keys(Indicators);
var allowedTalibIndicators = _.keys(talib);
var allowedTulipIndicators = _.keys(tulind);

var Base = function(settings) {
  _.bindAll(this);

  // properties
  this.age = 0;
  this.processedTicks = 0;
  this.setup = false;
  this.settings = settings;
  this.tradingAdvisor = config.tradingAdvisor;
  // defaults
  this.requiredHistory = 0;
  this.priceValue = 'close';
  this.indicators = {};
  this.talibIndicators = {};
  this.tulipIndicators = {};
  this.asyncTick = false;
  this.candlePropsCaches = {};
  this.candleBatchers = {};
  this.rollingCandleBatchers = {};
  this.deferredTicks = [];

  this._prevAdvice;

  // make sure we have all methods
  _.each(['init', 'check'], function(fn) {
    if(!this[fn])
      util.die('No ' + fn + ' function in this trading method found.')
  }, this);

  if(!this.update)
    this.update = function() {};

  if(!this.end)
    this.end = function() {};

  if(!this.onTrade)
    this.onTrade = function() {};

  // let's run the implemented starting point
  this.init();

  if(!config.debug || !this.log)
    this.log = function() {};

  this.setup = true;

  if(_.size(this.talibIndicators) || _.size(this.tulipIndicators))
    this.asyncTick = true;

  if(_.size(this.indicators))
    this.hasSyncIndicators = true;
}

// teach our base trading method events
util.makeEventEmitter(Base);

// Useful method to use a cached CandleBatcher within a strategy
Base.prototype.getCandleBatcher = function(candleSize) {
  if (!(candleSize in this.candleBatchers))
    this.candleBatchers[candleSize] = new CandleBatcher(candleSize);

  return this.candleBatchers[candleSize];
}

// Useful method to use a cached RollingCandleBatcher within a strategy
Base.prototype.getRollingCandleBatcher = function(candleHistory, updateFrequency, allowPartialFirst) {
  var cacheKey = `${candleHistory}_${updateFrequency}`;
  if (!(cacheKey in this.rollingCandleBatchers))
    this.rollingCandleBatchers[cacheKey] = new RollingCandleBatcher(candleHistory, updateFrequency, allowPartialFirst);

  return this.rollingCandleBatchers[cacheKey];
}

Base.prototype.tick = function(candle) {

  if(
    this.asyncTick &&
    this.hasSyncIndicators &&
    this.age !== this.processedTicks
  ) {
    // Gekko will call talib and run strat
    // functions when talib is done, but by
    // this time the sync indicators might be
    // updated with future candles.
    //
    // See @link: https://github.com/askmike/gekko/issues/837#issuecomment-316549691
    return this.deferredTicks.push(candle);
  }

  this.age++;

  if(this.asyncTick) {
    _.each(this.candlePropsCaches, function(cache) {
      cache.write([candle]);
    });
  }

  _.each(this.candleBatchers, function(batcher) {
    batcher.write([candle]);
  });

  _.each(this.rollingCandleBatchers, function(batcher) {
    batcher.write([candle]);
  });

  // update the trading method
  if(!this.asyncTick) {
    this.propogateTick(candle);
  } else {

    var next = _.after(
      _.size(this.talibIndicators) + _.size(this.tulipIndicators),
      () => this.propogateTick(candle)
    );

    // handle results from talib and tulip indicators
    this.runAsyncIndicators('TALIB', this.talibIndicators, candle, next);
    this.runAsyncIndicators('TULIP', this.tulipIndicators, candle, next);
  }

  this.propogateCustomCandle(candle);
}

// Standardised method to run all Talib and Tulip indicators
Base.prototype.runAsyncIndicators = function(name, indicators, candle, done) {
  var resultHander = function(err, result) {
    if(err)
      util.die(name + ' ERROR:', err);

    // fn is bound to indicator
    this.result = _.mapValues(result, v => _.last(v));
    done(candle);
  }

  // handle result from indicators
  _.each(
    indicators,
    indicator => indicator.run(
      this.candlePropsCaches[indicator.cacheKey].candleProps,
      resultHander.bind(indicator)
    ),
    this
  );
}

// if this is a child process the parent might
// be interested in the custom candle.
if(ENV !== 'child-process') {
  Base.prototype.propogateCustomCandle = _.noop;
} else {
  Base.prototype.propogateCustomCandle = function(candle) {
    process.send({
      type: 'candle',
      candle: candle
    });
  }
}

Base.prototype.propogateTick = function(candle) {
  this.candle = candle;

  this.update(candle);

  var isAllowedToCheck = this.requiredHistory <= this.age;

  // in live mode we might receive more candles
  // than minimally needed. In that case check
  // whether candle start time is > startTime
  var isPremature;

  if(mode === 'realtime'){
    // Subtract number of minutes in current candle for instant start
    let startTimeMinusCandleSize = startTime.clone();
    startTimeMinusCandleSize.subtract(this.tradingAdvisor.candleSize, "minutes");
    
    isPremature = candle.start < startTimeMinusCandleSize;
  }
  else{
    isPremature = false;
  }

  if(isAllowedToCheck && !isPremature) {
    this.log(candle);
    this.check(candle);
  }
  this.processedTicks++;

  if(
    this.asyncTick &&
    this.hasSyncIndicators &&
    this.deferredTicks.length
  ) {
    return this.tick(this.deferredTicks.shift())
  }

  // emit for UI
  this.emitIndicatorResults(this.indicators, candle);
  this.emitIndicatorResults(this.tulipIndicators, candle);
  this.emitIndicatorResults(this.talibIndicators, candle);

  // are we totally finished?
  var done = this.age === this.processedTicks;
  if(done && this.finishCb)
    this.finishCb();
}

// Process indicator results. Only sending data when the indicator has
// just been updated and has chart settings defined.
Base.prototype.emitIndicatorResults = function(indicators, candle) {
  _.each(
    indicators,
    (indicator, name) => {
      if (!_.isEmpty(indicator.chart) && indicator.lastUpdate == candle.start) {
        this.emitIndicatorDataToUI({
          name,
          date: candle.start,
          result: indicator.result,
          type: indicator.type,
          chart: indicator.chart
        });
      }
    },
    this
  );
}

// Useful function to send custom strategy data to the UI
Base.prototype.emitIndicatorDataToUI = function(data) {
  cp.indicatorResult(data);
}

Base.prototype.processTrade = function(trade) {
  this.onTrade(trade);
}

Base.prototype.createIndicatorPropsCache = function(indicator, candleHistory, updateFrequency) {
  if (!(indicator.cacheKey in this.candlePropsCaches))
    this.candlePropsCaches[indicator.cacheKey] = new CandlePropsCache(candleHistory, updateFrequency);

  // This allows us to only emit newly calculated results to avoid stepped chart lines
  this.candlePropsCaches[indicator.cacheKey].on('candle', candle => {
    indicator.lastUpdate = 'created' in candle ? candle.created : candle.start;
  });
}

Base.prototype.addTalibIndicator = function(name, type, parameters, candleHistory = 1, updateFrequency = 1, chart = {}) {
  if(!talib)
    util.die('Talib is not enabled');

  if(!_.contains(allowedTalibIndicators, type))
    util.die('I do not know the talib indicator ' + type);

  if(this.setup)
    util.die('Can only add talib indicators in the init method!');

  indicator = {
    run: talib[type].create(parameters),
    name: name,
    type: 'talib-' + type,
    chart: chart,
    cacheKey: `${candleHistory}_${updateFrequency}`,
    lastUpdate: undefined,
    result: NaN
  }

  this.createIndicatorPropsCache(indicator, candleHistory, updateFrequency);

  this.talibIndicators[name] = indicator;
}

Base.prototype.addTulipIndicator = function(name, type, parameters, candleHistory = 1, updateFrequency = 1, chart = {}) {
  if(!tulind)
  util.die('Tulip indicators is not enabled');

  if(!_.contains(allowedTulipIndicators, type))
    util.die('I do not know the tulip indicator ' + type);

  if(this.setup)
    util.die('Can only add tulip indicators in the init method!');

  indicator = {
    run: tulind[type].create(parameters),
    name: name,
    type: 'tulip-' + type,
    chart: chart,
    cacheKey: `${candleHistory}_${updateFrequency}`,
    lastUpdate: undefined,
    result: NaN
  }

  this.createIndicatorPropsCache(indicator, candleHistory, updateFrequency);

  this.tulipIndicators[name] = indicator;
}

Base.prototype.addIndicator = function(name, type, parameters, candleHistory = 1, updateFrequency = 1, chart = {}) {
  if(!_.contains(allowedIndicators, type))
    util.die('I do not know the indicator ' + type);

  if(this.setup)
    util.die('Can only add indicators in the init method!');

  var indicator = _.assign(new Indicators[type](parameters), {
    name: name,
    type: type,
    chart: {},
    cacheKey: `${candleHistory}_${updateFrequency}`,
    lastUpdate: undefined
  });

  this.createIndicatorPropsCache(indicator, candleHistory, updateFrequency);

  var cache = this.candlePropsCaches[indicator.cacheKey];

  // We can automatically update these indicators using events.
  // Some indicators need a price stream, others need full candles
  if (indicator.input == 'price')
    cache.on('candle', candle => {
      indicator.update(candle[this.priceValue]);
    });
  if (indicator.input == 'candle')
    cache.on('candle', candle => {
      indicator.update(candle);
    });

  this.indicators[name] = indicator;
}

Base.prototype.advice = function(newPosition, _candle) {
  // ignore soft advice coming from legacy
  // strategies.
  if(!newPosition)
    return;

  // ignore if advice equals previous advice
  if(newPosition === this._prevAdvice)
    return;

  // cache the candle this advice is based on
  if(_candle)
    var candle = _candle;
  else
    var candle = this.candle;

  this._prevAdvice = newPosition;

  _.defer(function() {
    this.emit('advice', {
      recommendation: newPosition,
      portfolio: 1,
      candle
    });
  }.bind(this));
}

// Because the trading method might be async we need
// to be sure we only stop after all candles are
// processed.
Base.prototype.finish = function(done) {
  if(!this.asyncTick) {
    this.end();
    return done();
  }

  if(this.age === this.processedTicks) {
    this.end();
    return done();
  }

  // we are not done, register cb
  // and call after we are..
  this.finishCb = done;
}

module.exports = Base;
