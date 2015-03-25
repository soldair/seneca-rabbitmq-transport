#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));
if(argv.h || argv.help){
  console.log("USE: ");
  console.log(" -n number of messages to send. (optional) default 1000");
  //console.log(" -c number of concurrent messages to process. (optional) default 1");
  process.exit();
}

var seneca = require('seneca')()
  .use('..')
  .client({type:'rabbitmq'})

var c = 0;
var tries = argv.n||1000;
var start;
var samples = [];
var sum = 0;

var started = 0;
var concur = 0;

console.log('starting');
//make one call to season things.
seneca.act('foo:1,zed:10',function(err){
  if(err) throw err;

  start = Date.now();
  var jobs = 1;//argv.c||1;
  while(jobs--) {
    console.log('started worker')
    act();
  }
});

function act(){
  started++;
  (function fn(skip){
    if(++c === tries) return done();
    var t = Date.now();
    seneca.act('foo:1,zed:10',function(err){
      if(!skip){
        samples.push(Date.now()-t);
        sum += samples[samples.length-1];
      }
      if(err) throw err;
      fn();
    });
  })(true);
}

function done(){
  var end = Date.now();
  var elapsed = end-start;

  if(!concur) concur = started;
  if(--started) return;

  var mean = sum/tries;
  var max = 0, min = Infinity, dsum=0;
  samples.forEach(function(v){
    if(v < min) min = v;
    if(v > max) max = v;
    dsum += Math.pow(mean-v,2);
  });

  var stddev = Math.sqrt(dsum/tries);
  var distribution = {};

  samples.forEach(function(v){
    absv = Math.abs(v-mean);

    var dist = Math.floor(absv/stddev);
    if(v < mean) dist = dist*-1;
    if(!distribution[dist]) distribution[dist] = {c:0,ms:0};
    distribution[dist].c++;
    distribution[dist].ms += v;
  });

  Object.keys(distribution).forEach(function(k){
    distribution[k]['%'] = +((distribution[k].c/tries*100)+'').substr(0,5);
    distribution[k].ms_per = +((distribution[k].ms/distribution[k].c)+'').substr(0,5);
  })

  
  
  console.log("\nHI! you just ran a perf test!")
  console.log("calls: "+tries);
  console.log("time: "+elapsed);
  console.log("ms/calls: "+elapsed/tries);
  console.log("concurrency: "+concur);
  console.log("slowest call: "+max);
  console.log("fastest call: "+min);
  console.log("stddev: "+stddev);
  console.log("value distribution by deviations from the mean %:");
  console.log(distribution);

  seneca.close();
}

