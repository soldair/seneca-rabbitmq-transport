#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));
if(argv.h || argv.help){
  console.log("USE: ");
  console.log(" -n number of messages to send. (optional) default 1000");
  console.log(" -c number of concurrent messages to send. (optional) default 1");
  process.exit();
}

var cp = require('child_process');

var client = cp.spawn(__dirname+"/perfclient.js",argv)

client.stdout.pipe(process.stdout);
client.stderr.pipe(process.stderr);

var exit;
var killed = false;
client.on('exit',function(code){
  if(killed) return;
  if(code) {
    process.stderr.write("client exited with code ",code);
    exit = code;
  }
  killed = true;
  server.kill();
})

// todo. more than one server.
var server = cp.spawn("node",[__dirname+"/server.js"]);

server.on('exit',function(code){
  if(killed) return;
  if(code){
    process.stderr.write("client exited with code ",code);
    exit = code;   
  }
  client.kill();
})
