var _ = require("underscore");
var validUrl = require("valid-url");
var	Quarter = require("./quarter");
var fetcher = require('./fetcher');
var Sequelize = require('sequelize');
var config = require ('./config');
var Utils = require('./utils')
var dirs = require('./dirs')
var path = require('path');
var fs = require('fs');

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

function checkCsvFile(fund){
	var fullFilename = Utils.filename(dirs.csv, fund, '.csv');
	var baseFilename = path.basename(fullFilename);
	var url = '/csv/' + baseFilename;

	try{
		fs.statSync(fullFilename);
		return {
			fullpath: fullFilename,
			filename: baseFilename,
			url: url
		};
	}
	catch(e){
		console.log(e);
		return undefined;
	}

}


models.Report.findAll
	(
		{
			where : {
				report_year : '2015',
				report_quarter : '2'
			}
		}
	)
	.each(function(report) {


		console.log(report.fund);
	
		// var fund = Utils.getFundObj(report.managing_body, report.report_year, report.report_quarter, report.fund, report.url);
		// var fullFilename = Utils.filename(dirs.csv, fund, '.csv');
		// var csvFile = checkCsvFile(fund);

		console.log(report.excel_filename);
		// console.log('fullFilename:'+fullFilename);
		// console.log(csvFile);
	});

return;