const {program} = require('cpmmander');
const fs = require('fs');
const http = require('http');

program 
.option('-h, --host, <host>', 'адреса сервера')
.option('-p, --port, <port>', 'порт сервера')
.option('-c, --cache, <cache>', 'кешовані файли')
.parse(process.argv);

const options = program.options;

