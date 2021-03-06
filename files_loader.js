var fs = require("fs"),
	cp = require("child_process"),
	path = require('path'),
	_ = require('underscore'),
	Promise = require('bluebird'),
	genericImporter = require("./genericImporter.js"),
	fse = require("fs-extra"),
	logger = require('./logger.js')(module),
	CSVWriter = require("./CSVWriter.js"),
	Utils = require("./utils.js"),
	CSVParser = Promise.promisify(require('json-2-csv').csv2json);

/**
 * Convert XLS/XLSX files to CSV
 * 
 * @param body - managing body of files to convert
 * @param fund_number - fund of files to convert
 * @param year - year of files to convert
 * @param quarter - quarter of files to convert
 * @param srcdir - path of excel files
 * @param trgdir - path to write csv files
 */
exports.convertFilesCmd = function(body, fund_number, year, quarter, srcdir, trgdir, overwrite){

	logger.info("convertFilesCmd","Converting Excel files in "+srcdir);

	if (srcdir.indexOf(path.sep) != srcdir.length){
		srcdir += path.sep;
	}

	if (!fs.existsSync(srcdir)){
		throw("Unknown directory:" +srcdir);
	}

	if (!fs.existsSync(trgdir)){
		logger.info("convertFilesCmd","Creating directory:" +trgdir);
		fs.mkdirSync(trgdir);
	}

	var xlfiles = fs.readdirSync(srcdir).filter(function(file){
		return file.indexOf(".xlsx") > -1 || file.indexOf(".xls") > -1;
	});

	xlfiles = Utils.filterFiles(xlfiles, body, year, quarter, fund_number);

	return exports.convertFiles(xlfiles, srcdir, trgdir, overwrite)
	.then(function(){
		logger.info("convertFilesCmd","All done");
	})
}

exports.convertFiles = function(xlfiles, srcdir, trgdir, overwrite){
	var total = xlfiles.length;
	var counter = 0;

	return new Promise.each(xlfiles, function(file){

		//process.stdout.cursorTo (0);
		process.stdout.write(++counter+'/'+total + ":"+ file + "\n");

		var xlFilename = path.join(srcdir,file);
		var fund = Utils.getFundFromFile(file);
		var csvFilename = Utils.filename(trgdir, fund, '.csv');

		if (fs.existsSync(csvFilename) && !overwrite){
			console.log("Converted file exists:" + csvFilename);
			logger.warn("Converted file exists:" + csvFilename );
			return;
		}

		return genericImporter.parseXls(xlFilename)
			.then(function(result){
				return CSVWriter.writeParsedResult(fund.body, fund.number, fund.year, fund.quarter, result, trgdir);
			})
			.catch(function(e){
				logger.error("Error converting file: " + file, e.message);

				if (fs.existsSync(csvFilename)){
					fs.unlinkSync(csvFilename);
				}

				//Try to fix by file format
				fixFileFormat(xlFilename)
					.then(genericImporter.parseXls)
					.then(function(result){
						logger.debug("fixed by converting:"+xlFilename);
						return CSVWriter.writeParsedResult(fund.body, fund.number, fund.year, fund.quarter, result, trgdir);
					})
					.catch(function(e){
						logger.error("final: error converting file: " + file);
						// throw({"msg" : "Error converting file " + e});
						return;
					});
			});
	})
}

/**
 * Count sum of fair values in file
 */
exports.countFileValues = function(dir, body, year, quarter, fund_number){

	var fund = Utils.getFundObj(body, year, quarter, fund_number);
	var csvFilename = Utils.filename(dir, fund, '.csv');

	if (!fs.existsSync(csvFilename)){
		logger.warn("csv file does not exist:" + csvFilename );
		return new Promise.resolve(0);
	}

	var csvStr = fs.readFileSync(csvFilename, "utf8");

	return CSVParser(csvStr)
        .then(function(data){

	        var totalValue = _.reduce(data, function(memo, row){

	        	if (row.currency > 0 && row.currency < 13) return memo;
	        	if (row.instrument_id == undefined) return memo;


        		return memo + ( row.market_cap || 0 ) * 1000 +
        						( row.fair_value || 0 ) * 1000;
        	},0);

        	//console.log(totalValue);
        	return totalValue;
        }, function(errorReason){
            console.log(errorReason);
        });
}

//TODO: TOFIX: no need to do ssconvert, just change file to proper format
// ...and test it!

/**
 * Fix file format
 * For cases where XLSX file was downloaded as XLS, or vice-versa
 *
 */
function fixFileFormat(xlFilename){

	return new Promise(function(resolve, reject){

		logger.info("Checking format: " + xlFilename);

		cp.exec("file " + xlFilename, function (err, stdout, stderr) {

			logger.debug("Got file info :"+ stdout);
			//if file is XLSX format, convert to XLSX
			if (!err &&
				(
					stdout.toString().indexOf("CDF V2") !== -1 ||
					stdout.toString().indexOf("Composite Document File V2 Document") !== -1 ||
					stdout.toString().indexOf("Microsoft Excel 2007+") !== -1
				)
			)
			{
				var cmd = "ssconvert --export-type=Gnumeric_Excel:xlsx " + xlFilename;

				logger.debug("converting to XLSX: " + xlFilename );
				cp.exec(cmd, function(err, stdout, stderr) {
					if (err){
						logger.warn("error converting file:" + xlFilename + " err:" + err);
						reject(xlFilename);
					}

//					fs.renameSync(xlFilename, newPath)

					//fs.unlink(xlFilename, function() {

						var fund = Utils.getFundFromFile(xlFilename);
						var xlsxFilename = Utils.filename("",fund,".xlsx");

						logger.debug("converted "+xlFilename+" to XLSX: " + xlsxFilename);

						resolve(xlsxFilename);
	       			//});
				});
			} 
			else if (stdout.toString().indexOf("Zip archive data, at least v2.0 to extract") !== -1) {
				// File is already xlsx, just move it to the right name
				var fund = Utils.getFundFromFile(xlFilename);
				logger.warn("file is actually xlsx: "+xlFilename);

				fse.copySync(xlFilename, path.join('./prob/',xlFilename));
		//		cp.exec("mv -f " + utils.filename('./tmp/', fund, '.xls') + " " + utils.filename('./tmp/', fund, '.xlsx'), function(err, stdout, stderr) {
		//			resolve(utils.filename('./tmp/', fund, '.xlsx'));
		//		});
			} 
			else {
				logger.error("Unknown file format for: "+ xlFilename + " : " + stdout.toString());
//				fs.unlink(xlFilename, function() {
						reject(xlFilename);
  //              });
			}
		});

	});
		
}