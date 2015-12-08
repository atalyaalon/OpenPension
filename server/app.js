'use strict';

var express = require('express');
var http = require('http');
var path = require('path');
var config = require ('../config');
var bodyParser = require('body-parser');
var basicAuth = require('basic-auth-connect');
var cors = require('cors'); 

// init express
var app = express();

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(bodyParser.json({limit: '5mb'}));

app.use(cors());

app.set('port', process.env.PORT || 5000);

app.set('view engine', 'handlebars');
app.set('views', __dirname + '../app/scripts/views');

// set logging
app.use(function(req, res, next){
  console.log('%s %s', req.method, req.url);
  next();
});

// mount static
app.use(express.static( path.join( __dirname, '../app') ));

// route index.html
app.get('/', function(req, res){
  res.sendfile( path.join( __dirname, '../app/index.html' ) );
});

app.use('/xl', express.static('../res'));
app.use('/csv', express.static('../tmp'));

// start server
//app.use(basicAuth('username', 'password'));
http.createServer(app).listen(app.get('port'), function(){
    console.log('Express App started!');
});

// Create server 



var reports = require('./routes/reports');
app.use('/reports', reports);
app.get('/api/config', function(req, res){
	res.json({a:1});
})