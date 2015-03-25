/* Copyright (c) 2014 Richard Rodger, MIT License */
"use strict";

var buffer = require('buffer')
var util   = require('util')
var net    = require('net')
var stream = require('stream')
var uuid = require('node-uuid')

var _    = require('underscore')
var amqp = require('amqplib/callback_api')

module.exports = function( options ) {

  var seneca = this
  var plugin = 'rabbitmq-transport'

  var so = seneca.options()

  options = seneca.util.deepextend(
    {
      // pass default options.
      rabbitmq:{
        url:"amqp://localhost",
        options:{}, // optional socket options.
        queue_options:{} // optional queue options. 
      }
    },
    so.transport,
    options)

  var tu = seneca.export('transport/utils')

  seneca.add({role:'transport',hook:'listen',type:'rabbitmq'}, hook_listen_rabbitmq)
  seneca.add({role:'transport',hook:'client',type:'rabbitmq'}, hook_client_rabbitmq)



  function hook_listen_rabbitmq( args, done ) {
    var seneca         = this
    var type           = args.type
    var listen_options = seneca.util.clean(_.extend({},options[type],args))
    var sock_options = listen_options.options||{};

    // honor listen_options.port like other transports.
    if(listen_options.port){
      // this rabbitmq lib expects to parse custom ports from the url via url.parse
      // https://github.com/squaremo/amqp.node/blob/master/lib/connect.js#L101
      // if port is already provided as part of the url the port that is part of the url wins.
      // this library doesnt use the parsed url.path so its safe to blindly concat the port on the end.
      listen_options.url += ":"+listen_options.port
    }

    amqp.connect(listen_options.url, sock_options , function (error, connection) {
      if (error) return done(error)

      // TODO
      // this gets called whenever the conection to rabbit is closed.
      // its real easy to reproduce with `sudo rabbitmqctl stop_app && sudo rabbitmqctl start_app`
      // I need to reconnect here.
      //
      //connection.on('error',function(){
      /// TODO !!
      //})

      connection.createChannel(function (error, channel) {
        if (error) return done(error);

        channel.on('error', done);

        tu.listen_topics(seneca, args, listen_options, function ( topic ) {
          var acttopic = topic+'_act'

          seneca.log.debug('listen', 'subscribe', acttopic, listen_options, seneca)

          channel.assertQueue(acttopic, {durable: false})

          // Subscribe
          channel.consume(acttopic, on_message,{noAck:true});

          function on_message ( message ) {

            var content = message.content ? message.content.toString() : undefined
            var data = tu.parseJSON( seneca, 'listen-'+type, content )

            // Publish
            tu.handle_request( seneca, data, listen_options, function(out){


              if( null == out ) return;
              var outstr = tu.stringifyJSON( seneca, 'listen-'+type, out )

              //console.log('[server] sending rpc response',outstr,message.properties);

              channel.sendToQueue(message.properties.replyTo, new Buffer(outstr),{correlationId: message.properties.correlationId});
            })
          }
        });


        seneca.add('role:seneca,cmd:close',function( close_args, done ) {
          var closer = this
          channel.close()
          connection.close()
          closer.prior(close_args,done)
        })


        seneca.log.info('listen', 'open', listen_options, seneca)

        done()
      })
    })
  }


  function hook_client_rabbitmq( args, done ) {
    var seneca         = this
    var type           = args.type
    var client_options = seneca.util.clean(_.extend({},options[type],args))
    var sock_options = client_options.options||{};

    var correlationId = uuid.v4()


    if(client_options.port){
      client_options.url += ":"+client_options.port
    }

    amqp.connect(client_options.url, sock_options, function (error, connection) {
      if (error) return done(error)

      connection.createChannel(function (error, channel) {
        if (error) return done(error);

        tu.make_client( seneca, make_send, client_options, done )

        function make_send( spec, topic, send_done ) {
          var acttopic = topic+'_act'

          // TODO this error could happen if the connection is broken somehow
          // is send_done for this? should't the client end?
          channel.on('error', send_done);

          channel.assertQueue('', {exclusive: true}, function(error, res) {
            if (error) return done(err);

            var queue = res.queue;
            channel.consume(queue, subscribe, {noAck:true});

            // Publish
            send_done( null, function ( args, done ) {
              var outmsg = tu.prepare_request( this, args, done )
              var outstr = tu.stringifyJSON( seneca, 'client-rabbitmq', outmsg )

              //console.log('[client] sending rpc.',outstr);

              channel.sendToQueue(acttopic, new Buffer(outstr), {
                replyTo: queue, correlationId: correlationId
              });
            })

          });

          // Subscribe
          function subscribe( message ) {

            //console.log('[client] got rpc response.',message.content.toString(),message.properties);

            if (message.properties.correlationId != correlationId) return;
            
            var content = message.content ? message.content.toString() : undefined
            var input = tu.parseJSON(seneca,'client-'+type,content)

            tu.handle_response( seneca, input, client_options )
          }

          seneca.add('role:seneca,cmd:close',function( close_args, done ) {
            var closer = this
            channel.close();
            connection.close();
            closer.prior(close_args,done)
          })

        }
      })
    })
  }

  return {
    name: plugin,
  }
}
