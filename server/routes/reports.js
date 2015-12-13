var Utils = require('../../utils.js');
var _ = require('underscore');
var path = require('path');
var fs = require('fs');
var config = require('../../config');
var Promise = require('bluebird');
var express = require('express');
var router = express.Router();
var models = require('../models');
var db = require ('../../db');
var filesLoader = require ('../../files_loader');
var dbLoader = require ('../../dbLoader');
var CSVWriter = require ('../../CSVWriter');
var fetcher = require("../../fetcher.common");
var dirs = require('../../dirs');


function whereFromRequest(req){
	var where = {};
	
	if (req.query.fund){
		where.fund = req.query.fund
	}
	if (req.query.report_year){
		where.report_year = req.query.report_year
	}
	if (req.query.report_quarter){
		where.report_quarter = req.query.report_quarter
	}
	if (req.query.managing_body){
		where.managing_body = req.query.managing_body
	}
	if (req.query.id){
		where.id = req.query.id
	}

	return where;
}

function getExcelFullPath(filename){
	return path.join(dirs.excel,filename);
}

function getCsvFullPath(filename){
	return path.join(dirs.csv,filename);
}

function getExcelUrl(filename){
	return path.join('/xl/', filename);
}

function getCsvUrl(filename){
	return path.join('/csv/', filename);
}

/**
 * Get CSV file if exists or undefined otherwise
 *
 */
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
		return undefined;
	}

}

function checkExcelFile(fund){
	var fullFilenameXLS = Utils.filename(dirs.excel, fund, '.xls');
	var fullFilenameXLSX = Utils.filename(dirs.excel, fund, '.xlsx');

	try{
	
		fs.statSync(fullFilenameXLS);
	
		var baseFilename = path.basename(fullFilenameXLS);
		var url = '/xl/' + baseFilename;

		return {
			fullpath: fullFilenameXLS,
			filename: baseFilename,
			url: url
		};
	}
	catch(e){
	}

	try{

		fs.statSync(fullFilenameXLSX);
		
		var baseFilename = path.basename(fullFilenameXLSX);
		var url = '/xl/' + baseFilename;

		return {
			fullpath: fullFilenameXLSX,
			filename: baseFilename,
			url: url
		};

	}
	catch(e){
		return undefined;
	}

}

//get reports
router.get('/', function(req, res) {
	
	var where = whereFromRequest(req);

	models.Report.findAll({
		where : where,
		order :[ 
			"managing_body",
			"report_year",
			"report_quarter",
			"fund"
		]
	})
	.then(function(reports){
		res.json(reports);
	})
});


router.put('/:id', function(req, res) {
	console.log(req.body);
	console.log("lll")
	console.log(req.params);
	var data = {
		managing_body : req.body.managing_body.toLowerCase(),
		fund : Number(req.body.fund),
		report_year: req.body.report_year,
		report_quarter: req.body.report_quarter,
		url : req.body.url
	}

	var options = {
		where : {
			id: req.body.id
		}
	}


	models.Report.update(data, options)
	.then(function(data){
		res.json(data);
	})

});


//refresh totalSumInDB
router.get('/totalSumInDB', function(req, res) {
	
	var where = whereFromRequest(req);

	models.Report.findAll({
		
		where: where

	})
	.each(function(report) {
		db.getFundValue(report.managing_body, report.report_year, report.report_quarter, report.fund, config.table)
		.then(function(queryResult){
			return report.updateAttributes({
		      sum_in_db: parseInt(Number(queryResult.rows[0].sum))
		    })
		})
	    .then(function(){
	    	res.json(report);
	    });

	});
});

/**
 * refresh totalSumInFile
 *
 * Re-Calculate sum in file, if file not present, convert from XLS
 * if XLS not present, and report has URL, try to download 
 */

router.get('/totalSumInFile', function(req, res) {
	
	var where = whereFromRequest(req);

	models.Report.findAll({
		
		where: where

	})
	.map(function(report) {

		//TODO: check for XL file, if not exist, download
		//check for CSV file, if not exist, convert from XL
		//count

		var fund = Utils.getFundObj(report.managing_body, report.report_year, report.report_quarter, report.fund, report.url);

		var csvFile = report.getCsvFileIfExists();
		var excelFile = report.getExcelFileIfExists();

		var p = new Promise.resolve();

		if (!csvFile){ //CSV file not found
			p = p
				.then(function(){
						if (!excelFile){
							throw "Excel file not found";
						}
						return require('../../genericImporter').parseXls(getExcelFullPath(excelFile))
					}
				)
				.then(
					function(result){
						CSVWriter.writeParsedResult(fund.body, fund.number, fund.year, fund.quarter, result);
					}
				);
				
		}

		return p
		.then(function(){
				return filesLoader.countFileValues(dirs.csv, report.managing_body, report.report_year, report.report_quarter, report.fund)
			}
		)
		.then(function(totalSumInFile){
			report.updateAttributes({
		      sum_in_data_file: parseInt(Number(totalSumInFile))
		    })
		})
	    .then(function(){
	    	// res.json(report);
    		return report;
	    })
	    .catch(function(err){
	    	return {
	    		code: 10,
	    		msg: err
	    	};
	    });

	})
	.then(function(all){
		res.json(all);
	})
});

//Get CSV file URL if it exists
router.get('/csvFile', function(req, res){

	var where = whereFromRequest(req);

	models.Report.findOne({
		
		where: where

	})
	.then(function(report) {

		var csv_file = report.getCsvFileIfExists()

		if (csv_file){
			var url = getCsvUrl(csv_file);

			res.json({
				file: csv_file,
				url: url
			});
		}
		else{
			res.json({
				error:{
					msg:'File not found'
				}
			});
		}
	})
});


//Download CSV file URL if it exists
router.get('/downloadCsvFile', function(req, res){

	var where = whereFromRequest(req);

	models.Report.findOne({
		
		where: where

	})
	.then(function(report) {

		var csv_file = report.getCsvFileIfExists()

		if (csv_file){
		   res.writeHead(200, {
				'Content-Type': 'text/csv; charset=utf8',
				'Content-Disposition' : 'attachment; filename="'+csv_file+'"'
		    });

		    var readStream = fs.createReadStream('../tmp/'+csv_file);
		    // We replaced all the event handlers with a simple call to readStream.pipe()
		    readStream.pipe(res);
		}
		else{
			res.json({
				error:{
					msg:'File not found'
				}
			});
		}
	})
});







//Get EXCEL file info if it exists
router.get('/excelFile', function(req, res){

	var where = whereFromRequest(req);

	models.Report.findOne({
		
		where: where

	})
	.then(function(report) {

		var excel_file = report.getExcelFileIfExists()

		if (excel_file){

			var url = getExcelUrl(excel_file);

			res.json({
				file: excel_file,
				url: url
			});
		}
		else{
			res.json({
				error:{
					msg:'File not found'
				}
			});
		}

	});
});

//Refresh EXCEL file, download from URL 
router.get('/refreshExcelFile', function(req, res){

	var where = whereFromRequest(req);

	models.Report.findAll({
		
		where: where

	})
	.map(function(report){
		var fund = Utils.getFundObj(report.managing_body, report.report_year, report.report_quarter, report.fund, report.url);

		var fileData = checkExcelFile(fund);

		//DELETE FILE IF EXISTS? maybe only if report has URL

		//TODO: replace all fund OBJ with report OBJ
		if (report.url){
			return fetcher.downloadFundFile(fund)
					.then(function(filenameFullPath){
						console.log(filenameFullPath);
						var baseFilename = path.basename(filenameFullPath);
						var url = getExcelUrl(baseFilename);
						return {
							report_id :report.id,
							excel_file: {
								file: baseFilename,
								url: url
							}
						};
					});
		}
		else{
			return "no url for fund";
		}
	})
	.then(function(reports){
		console.log(reports);
		// report.excel_file = excelFile;
		res.json(reports)
	})
	.catch(function(err){
		console.log(err);
		res.status(500).json({
			error:{
				msg:err
			}
		});
	});
});


/**
 * Upload Repord Data to Database
 * If EXCEL file is missing, download it
 * If CSV file is missing, convert EXCEL to CSV
 * Accepts mutliple Report Ids
 *
 */
router.get('/uploadToDb', function(req, res){

	var where = whereFromRequest(req);

	models.Report.findAll({
		
		where: where

	})
	.each(function(report){ //Download excel file if not exists

		//check that EXCEL file exist
		var fund = Utils.getFundObj(report.managing_body, report.report_year, report.report_quarter, report.fund, report.url);
		var xlFileInfo = checkExcelFile(fund);
		var p = new Promise.resolve();

		if (!xlFileInfo){ //EXCEL file not found
			if(!fund.url){
				console.log("no URL for fund");
			}
			else{
				p = p.then(function(){
					console.log("Excel file missing, Downloading")
					return fetcher.downloadFundFile(fund);
				});

			}
		}
		else{
			console.log("Found excel file");
		}

		p.then(function(){
			return report;
		});


		return p;
	})
	.each(function(report){
		//check that CSV file exist

		var fund = Utils.getFundObj(report.managing_body, report.report_year, report.report_quarter, report.fund, report.url);

		var csvFileInfo = checkCsvFile(fund);
		var xlFileInfo = checkExcelFile(fund);

		var p = new Promise.resolve();

		if (!csvFileInfo){ //CSV file not found

			p = p.then(
				function(){

					console.log("CSV file missing, Converting " + JSON.stringify(fund));
					if (!xlFileInfo){
						//report.error = "error message";
						//return report;
						console.log("EXCEL file missing! cannot convert:" + JSON.stringify(fund));
					}

					return require('../../genericImporter').parseXls(xlFileInfo.fullpath)
				})
				.then(
					function(result){
						CSVWriter.writeParsedResult(fund.body, fund.number, fund.year, fund.quarter, result);
					}
				);

		}
		else{
			console.log("Found CSV file");
		}

		p.then(function(){
			return report;
		});

		return p;
	})
	/*
	.map(function(report){

		console.log(report);

		return dbLoader.importFile('../tmp', report.getCsvFilename(),config.table);

		//TODO: ?? upate sum_in_db in report objects
		//
		// .then(function(){
		// 	return db.getFundValue(report.managing_body, report.report_year, report.report_quarter, report.fund, config.table)
		// })
		// .then(function(queryResult){
		// 	return report.updateAttributes({
		//       sum_in_db: parseInt(Number(queryResult.rows[0].sum))
		//     })
		// })
	})
	*/
	.then(function(reports){

		//load files to DB
		var files = _.map(reports, function(report){ return report.getCsvFilename(); });

		dbLoader.importFiles(dirs.csv, files, config.table);

		return reports;
	})
	.then(function(k){
		// console.log(k);
		res.json(k);
	})
	.catch(function(e){
		console.log(e);
		res.status(500).json({
			err: e
		});
	});

});


//Delete report from Database
router.get('/deleteFromDb', function(req, res){

	var where = whereFromRequest(req);

	models.Report.findAll({
		
		where: where

	})
	.map(function(report){
		
		return db.deleteFundValues(report.managing_body, report.report_year, report.report_quarter, report.fund, config.table)
		.then(function(queryResult){
			return report.updateAttributes({
		      sum_in_db: parseInt(Number(0))
		    })
		})
	})
	.then(function(results){
		console.log(results);
		res.json(results);
	})
	.catch(function(e){
		console.log(e.stack);
	});

});

//upload EXCEL file
router.post('/excelFile', function(req, res){

	console.log(req)

	console.log(req.files)
	require('fs').rename(
		req.files.report.path,
		'./res/' + req.files.report.name,
		function(error) {
			if(error) {
				res.send({
					err: 'Ah crap! Something bad happened'
				});
				return;
			}
			res.send({
				path: serverPath
			});
		}
	);
});

//count rows of fund in DB
router.get('/countRows', function(req, res){

	return db.countFundRows(req.query.managing_body, req.query.report_year, req.query.report_quarter, req.query.fund, config.table)
	.then(function(result){
		console.log(result);
		
		res.json( {
			count: result.rows[0].count
		});
	})
	.catch(function(e){
		console.log(e.stack);
	});

});


router.get('/config', function(req,res){

	res.json({
		table: config.table
	});
});



module.exports = router;