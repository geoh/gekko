# Exchanges

*This is a technical document about adding a new exchange to Gekko.*

Gekko arranges all communication about when assets need to be bought or sold between the *strategy* and the *portfolio manager*. Exchanges are implemented by the portfolio manager, all differences between the different API's are abstracted away just below the portfolio manager. This document describes all requirements for adding a new exchange to Gekko.

## Gekko's expectations

When you add a new exchange to Gekko you need to expose an object that has methods to query the exchange. This exchange file needs to reside in `gekko/exchanges` and the filename is the slug of the exchange name + `.js`. So for example the exchange for Bitstamp is explained in `gekko/exchanges/bitstamp.js`.

It is advised to use a npm module to query an exchange. This will seperate the abstract API calls from the Gekko specific stuff (In the case of Bitstamp there was no module yet, so I [created one](https://www.npmjs.com/package/bitstamp)).

Finally Gekko needs to know how it can interact with the exchange, so add a static method `getCapabilities()` that returns it's properties. The meaning of the properties are described in the Capabilities section in this document.

## Portfolio manager's expectations

*If this documentation is not clear it please look at the examples in `gekko/exchanges/`.*

The portfolio manager implements an exchange like so:

    var Exchange = require('./exchanges/' + [exchange slug]);
    this.exchange = new Exchange({key: '', secret: '', username: ''});

It will run the following methods on the exchange object:

### getTicker

    this.exchange.getTicker(callback)

The callback needs to have the parameters of `err` and `ticker`. Ticker needs to be an object with atleast the `bid` and `ask` property in float.

### getFee

    this.exchange.getFee(callback)

The callback needs to have the parameters of `err` and `fee`. Fee is a float that represents the amount the exchange takes out of the orders Gekko places. If an exchange has a fee of 0.2% this should be `0.0002`.

### getPortfolio

    this.exchange.getPortfolio(callback)

The callback needs to have the parameters of `err` and `portfolio`. Portfolio needs to be an array of all currencies and assets combined in the form of objects, an example object looks like `{name: 'BTC', amount: 1.42131}` (name needs to be an uppercase string, amount needs to be a float).

### getLotSize

    this.exchange.getLotSize(tradeType, amount, size, callback)

The callback needs to have the parameters of `err` and `lot`. Lot needs to be an object with `amount` and `purchase` size appropriately for the exchange. In the event that the lot is too small, return 0 to both fields and this will generate a lot size warning in the portfolioManager.

Note: This function is currently optional. If not implemented `portfolioManager` will fallback to basic lot sizing mechanism it uses internally. However exchanges are not all the same in how rounding and lot sizing work, it is recommend to implement this function.

### buy

    this.exchange.buy(amount, price, callback);

*Note that this function is a critical function, retry handlers should abort quickly if attemps to dispatch this to the exchange API fail so we don't post out of date orders to the books.*

### sell

    this.exchange.sell(amount, price, callback);

This should create a buy / sell order at the exchange for [amount] of [asset] at [price] per 1 asset. If you have set `direct` to `true` the price will be `false`. The callback needs to have the parameters `err` and `order`. The order needs to be something that can be fed back to the exchange to see wether the order has been filled or not.

*Note that this function is a critical function, retry handlers should abort quickly if attemps to dispatch this to the exchange API fail so we don't post out of date orders to the books.*

### getOrder

    this.exchange.getOrder(order, callback);

The order will be something that the manager previously received via the `sell` or `buy` methods. The callback should have the parameters `err` and `order`. Order is an object with properties `price`, `amount` and `date`. Price is the (volume weighted) average price of all trades necesarry to execute the order. Amount is the amount of currency traded and Date is a moment object of the last trade part of this order.

### checkOrder

    this.exchange.checkOrder(order, callback);

The order will be something that the manager previously received via the `sell` or `buy` methods. The callback should have the parameters `err` and `filled`. Filled is a boolean that is true when the order is already filled and false when it is not. Currently partially filled orders should be treated as not filled.

### cancelOrder

    this.exchange.cancelOrder(order, callback);

The order will be something that the manager previously received via the `sell` or `buy` methods. The callback should have the parameterer `err`.

## Trading method's expectations

The trading method analyzes exchange data to determine what to do. The trading method will also implement an exchange and run one method to fetch data:

### getTrades

    this.watcher.getTrades(since, callback, descending);


If since is truthy, Gekko requests as much trades as the exchange can give (up to ~10,000 trades, if the exchange supports more you can [create an importer](../features/importing.md)).

The callback expects an error and a `trades` object. Trades is an array of trade objects in chronological order (0 is older trade, 1 is newer trade). Each trade object needs to have:

- a `date` property (unix timestamp in either string or int)
- a `price` property (float) which represents the price in [currency] per 1 [asset]. `
- an `amount` proprty (float) which represent the amount of [asset].
- a `tid` property (float) which represents the tradeID.


### Recompiling Gekko UI

Once you added your exchange you can use it with Gekko! However if you want the new exchange to show up in the web interface you need to recompile the frontend (so your updated `exchanges.js` file is used by the webapp). [Read here](https://gekko.wizb.it/docs/internals/gekko_ui.html#Developing-for-the-Gekko-UI-frontend) how to do that.

## Capabilities

Each exchange *must* provide a `getCapabilities()` static method that returns an object with these parameters:

- `name`: Proper name of the exchange
- `slug`: slug name of the exchange (needs to match filename in `gekko/exchanges/`)
- `currencies`: all the currencies supported by the exchange implementation in gekko.
- `assets`: all the assets supported by the exchange implementation in gekko.
- `pairs`: all allowed currency / asset combinations that form a market
- `maxHistoryFetch`: the parameter fed to the getTrades call to get the max history.
- `providesHistory`: If the getTrades can be fed a since parameter that Gekko can use to get historical data, set this to:
    - `date`: When Gekko can pass in a starting point in time to start returning data from.
    - `tid`: When Gekko needs to pass in a trade id to act as a starting point in time.
    - `false`: When the exchange does not support to give back historical data at all.
- `fetchTimespan`: if the timespan between first and last trade per fetch is fixed, set it here in minutes.
- `tradable`: if gekko supports automatic trading on this exchange.
- `requires`: if gekko supports automatic trading, this is an array of required api credentials gekko needs to pass into the constructor.
- `forceReorderDelay`: if after canceling an order a new one can't be created straight away since the balance is not updated fast enough, set this to true (only required for exchanges where Gekko can trade).

Below is a real-case example how `bistamp` exchange provides its `getCapabilities()` method:

```
Trader.getCapabilities = function () {
  return {
    name: 'Bitstamp',
    slug: 'bitstamp',
    currencies: ['USD', 'EUR'],
    assets: ['BTC', 'EUR'],
    maxTradesAge: 60,
    maxHistoryFetch: null,
    markets: [
      { pair: ['USD', 'BTC'], minimalOrder: { amount: 1, unit: 'currency' } },
      { pair: ['EUR', 'BTC'], minimalOrder: { amount: 1, unit: 'currency' } },
      { pair: ['USD', 'EUR'], minimalOrder: { amount: 1, unit: 'currency' } }
    ],
    requires: ['key', 'secret', 'username'],
    fetchTimespan: 60,
    tid: 'tid'
  };
}
```

## Error Handling

The various system in Gekko which call exchange functions, ie: the portfolio manager, the paper trader, the importer (if supported) assume that calls to exchange functions will always succeed. Currently, any error returns by an exchange call is treated as an irrecoverable condition and execution of Gekko stops.

In reality calls to web APIs are inherently unreliable, as so it is important to implement a proper error handling and retry system in the exchange to ensure reliable execution and recovery from network conditions.

Refer to the Kraken Exchange implementation for a reference on how to ideally handle retries.

### How to get yourself banned from an exchange

Most exchanges implement ratelimits on their APIs, retrying an API function too quickly or too much is an effective way to have your IP banned from an exchange API. For this reason it is recommended to use a backoff on subsequent retries, and limit retries to a reasonable timeperiod or number of attempts before failing completely.

Gekko itself is quite conservative and won't query the exchange a lot, so retries are the only place where this is likely to be a problem.

### Recoverable Errors

In general, any networking error generated by the underlying network socket, transport will be considered a retryable error. In some special cases like with Kraken (or any exchange normally facing stability issues) HTTP errors may also be considered retryable. Try to limit retries to errors that are known to be associated with load and stability problems, and avoid including error that are associated with incorrect API calls (ie: HTTP Response 500 should probably never be retried).

On detection of a recoverable error, return a `new RetryError(message)` through the error parameter of the callback and the retry handler will schedule the retry according to settings.

### Irrecoverable Errors

Irrecoverable errors are generally any error from a successful HTTP response, ie: Invalid API Keys, bad data formats, insufficient funds, etc. In this case retrying the request is not likely to yield a different results so to prevent spamming the API and irrecoverable error is returned and execution of the Gekko is terminated.

On detection of an irrecoverable error you can simply return the original JavaScript `Error` object, or return a `new AbortError(message)` through the error parameter of the callback and the retry handler will pass that error to the callers handler.