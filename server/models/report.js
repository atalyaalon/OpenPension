var Utils = require('../../utils');
var dirs = require('../../dirs');
var fs = require('fs');
var path = require('path');

module.exports = function (sequelize, DataTypes) {

	return sequelize.define('Report', {
	  managing_body: {
	  	type : DataTypes.STRING(20),
	  	allowNull : false
	  },
	  report_year: {
	  	type : DataTypes.INTEGER,
	  	allowNull : false
	  },
	  report_quarter: {
	  	type : DataTypes.INTEGER,
	  	allowNull : false
	  },
	  fund: {
	  	type : DataTypes.INTEGER,
	  	allowNull : false
	  },
	  url: {
	  	type : DataTypes.TEXT,
	  	allowNull : false
	  },
	  data_file_format: {
	  	type : DataTypes.STRING(10),
	  	allowNull : true
	  },
	  sum_in_data_file: {
	  	type : DataTypes.DECIMAL,
	  	allowNull : true
	  },
	  sum_reported:  {
	  	type : DataTypes.DECIMAL,
	  	allowNull : true
	  },
	  sum_in_db: {
	  	type : DataTypes.DECIMAL,
	  	allowNull : true
	  }
	  // ,
  // 	  excel_file: {
		// type: DataTypes.VIRTUAL(DataTypes.BOOLEAN),
		// 	get: function () {
		// 		var fund = Utils.getFundObj(this.managing_body, this.report_year, this.report_quarter, this.fund, this.url);
		// 		var fullFilenameXls = Utils.filename(dirs.excel, fund, '.xls');
		// 		var fullFilenameXlsx = Utils.filename(dirs.excel, fund, '.xlsx');

		// 		if( fs.existsSync(fullFilenameXls) ){
		// 			return path.basename(fullFilenameXls);
		// 		}
		// 		else if (fs.existsSync(fullFilenameXlsx)){
		// 			return path.basename(fullFilenameXlsx);
		// 		}

		// 		return;
		// 	}
  //     },
	 //  csv_file: {
		// type: DataTypes.VIRTUAL(DataTypes.BOOLEAN),
		// 	get: function () {
		// 		var fund = Utils.getFundObj(this.managing_body, this.report_year, this.report_quarter, this.fund, this.url);
		// 		var fullFilename = Utils.filename(dirs.csv, fund, '.csv');

		// 		if( fs.existsSync(fullFilename) ){
		// 			return path.basename(fullFilename);
		// 		}

		// 		return;
		// 	}
	 //  }
	},
	{
		tableName: 'reports',
		instanceMethods: {
	        getCsvFilename: function(){

	            return [
	                this.managing_body,
	                this.report_year,
	                this.report_quarter,
	                this.fund
	            ].join('_').concat('.csv');
	            
	        },
	        getExcelFileIfExists: function(){
				var fund = Utils.getFundObj(this.managing_body, this.report_year, this.report_quarter, this.fund, this.url);
				var fullFilenameXls = Utils.filename(dirs.excel, fund, '.xls');
				var fullFilenameXlsx = Utils.filename(dirs.excel, fund, '.xlsx');

				if( fs.existsSync(fullFilenameXls) ){
					return path.basename(fullFilenameXls);
				}
				else if (fs.existsSync(fullFilenameXlsx)){
					return path.basename(fullFilenameXlsx);
				}

				return;
	        },
	        getCsvFileIfExists: function(){
				var fund = Utils.getFundObj(this.managing_body, this.report_year, this.report_quarter, this.fund, this.url);
				var fullFilename = Utils.filename(dirs.csv, fund, '.csv');

				if( fs.existsSync(fullFilename) ){
					return path.basename(fullFilename);
				}

				return;
	        }
	    }
	})
}
