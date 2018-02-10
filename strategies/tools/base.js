module.exports = function(emitter) {
  var check = {};

  emitter.on('init', function(strategy) {
    if ('init' in check)
      check.init(strategy);
  });

  emitter.on('update', function(candle) {
    if ('update' in check)
      check.update(candle);
  });

  return check;
}
