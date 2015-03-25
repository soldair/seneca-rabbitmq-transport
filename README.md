seneca-rabbitmq-transport
======================

Seneca micro-services message transport over RabbitMQ messaging.


Seneca Rabbitmq Transport Plugin
--------------------------------

This plugin provides an rpc channel for micro-service messages using [rabbitmq](https://www.rabbitmq.com/)

Example
-------

```js
var seneca = require('seneca')()
  .use('rabbitmq-transport')
  .add('foo:two',function(args,done){ done(null,{bar:args.bar}) })
  .client( {type:'rabbitmq',pin:'foo:one,bar:*'} )
  .listen( {type:'rabbitmq',pin:'foo:two,bar:*'} )

seneca.act("foo:two,bar:taco",function(error,data){
  console.log(data);// prints {bar:taco}
});

```

Details
-------

A single server from the pool of available servers will be given a message. and the response will be sent to the client who requested it. these messages are not persistant and do not expect acks with the default configuration.

ALSO READ: The [seneca-transport](http://github.com/rjrodger/seneca-transport) readme has lots of introductory material about message transports. Start there if you have not used a message transport before.

[![Build Status](https://travis-ci.org/rjrodger/seneca-transport.png?branch=master)](https://travis-ci.org/rjrodger/seneca-transport)

For a gentle introduction to Seneca itself, see the
[senecajs.org](http://senecajs.org) site.


Install
-------

```sh
npm install seneca-rabbitmq-transport
```

You'll also need [rabbitmq](https://www.rabbitmq.com/download.html).

### ubuntu / apt-get

```
apt-get install rabbitmq-server
```

Testing
-------
tests are in mocha. run `npm test`

there are some example scripts on the test directory as well as a performace test.

to run the performance test `npm run test-perf` or `./tests/perf.js`. ill avoid posting my numbers here.


Support
-------

If you're using this module, feel free to contact me on Twitter if you
have any questions! :) [@rjrodger](http://twitter.com/rjrodger)

Current Version: 0.3.0

Tested on: Node 0.12.0, Seneca 0.6.1



