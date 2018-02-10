// listen to all messages and internally queue
// all candles and trades, when done report them
// all back at once

var _ = require('lodash');

module.exports = done => {
  var trades = [];
  var roundtrips = []
  var candles = [];
  var report = false;
  var indicatorResults = {};

  return {
    message: message => {

      if(message.type === 'candle')
        candles.push(message.candle);

      else if(message.type === 'trade')
        trades.push(message.trade);

      else if(message.type === 'roundtrip')
        roundtrips.push(message.roundtrip);

      else if(message.type === 'report')
        report = message.report;

      else if(message.log)
        console.log(message.log);

      else if(message.type === 'indicatorResult') {
        var name = message.indicatorResult.name;

        if(!_.has(indicatorResults, name))
          indicatorResults[name] = { results: {} };

        // Remove date and result values, but pass everything else to the ui
        _.each(message.indicatorResult, function(val, key) {
          if(!_.contains(['date', 'result'], key))
            indicatorResults[name][key] = val;
        });

        indicatorResults[name]['results'][message.indicatorResult.date] = message.indicatorResult.result;
      }
    },
    exit: status => {

      if(status !== 0)
        done('Child process has died.');
      else
        done(null, {
          trades,
          candles,
          report,
          roundtrips,
          indicatorResults
        });
    }
  }
}
