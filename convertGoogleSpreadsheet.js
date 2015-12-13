var _ = require("underscore");
var validUrl = require("valid-url");
var	Quarter = require("./quarter");
var fetcher = require('./fetcher');
var Sequelize = require('sequelize');
var config = require ('./config');
var Utils = require('./utils')

var sequelize = new Sequelize('op', config.user, config.password, {
  host: config.db,
  dialect: 'postgres',

  pool: {
    max: 5,
    min: 0,
    idle: 10000
  }

});

var models = require('./server/models');

sequelize.sync().then(function() {

  fetcher.readGoogleDocsFundsFile()
  	.then(function(funds){
  		funds = Utils.filterFunds(funds, null, 2015, 3, null);
  		return funds;
  	})
	.each(function(fund){
		var data = {
			managing_body : fund.body.toLowerCase(),
			fund : Number(fund.number),
			report_year: fund.year,
			report_quarter: fund.quarter,
			url : fund.url
		}

		// models.Report.upsert(data);

		models.Report.create(data);

		console.log(data);
		
	});
});
