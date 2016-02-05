var Promise = require('bluebird');
var fsep = require('fs-extra-promise');
var config = require('./config');
var throat = require('throat')
var path = require('path');
var fs = require('fs');
var logger = require('./logger');
var Utils = require('./utils');
var _ = require('underscore');
var db = require('./db');
var CSVParser = Promise.promisify(require('json-2-csv').csv2json);
var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
    host: 'localhost:9200',
    log: 'trace',
    apiVersion: '2.1'
});

module.exports.importFilesCmd = function(parentDir, body, year, quarter, fund_number, tableName, concurrency){
    return fsep.readdirAsync(parentDir)
        .then(function(files) {

            files = Utils.filterFiles(files, body, year, quarter, fund_number);
            return module.exports.importFiles(parentDir, files, tableName, concurrency);
        })
        .then(function(res){
            fsep.writeFile("errors.log", res['errors']);
        })
        .catch(function(err){
            logger.error("error:" + err)
        })
}


module.exports.importFileCmd = function(filePath, tableName){

    var filename =  filePath.replace(/^.*(\\|\/|\:)/, '');
    var parentDir = filePath.substr(0, filePath.length - filename.length);

    //process.stdout.cursorTo (0);
    process.stdout.write("Importing: "+filename + "\n");

    return module.exports.importFile(parentDir, filename, tableName)
        .then(function(res){
            if (!res){
                logger.info("Not imported")
            }
            else{
                logger.info("Done importing.")
            }
        })
        .catch(function(err){
            logger.error("error:" +err);
        })
}



/**
 * Import files to db, concurrently --> resolves to
 *
 *
 * result['done'] = [filenames...]
 * result['errors'] = [filenames...]
 */
module.exports.importFiles = function(parentDir, files, tableName, concurrency){

    if ( concurrency == undefined) concurrency = 4;
    var total = files.length;
    var counter = 0;

    return Promise.all(files.map(throat(concurrency, function(filename){

            //process.stdout.cursorTo (0);
            process.stdout.write(++counter+'/'+total + ":"+ filename + "\n");

            if ( filename.substr(-4) !== '.csv' ){
                return;
            }

            return module.exports.importFile(parentDir, filename, tableName);

        })))
        .then(function(resArr){

            //resArr - array of booleans,
            //represents success/fail of corresponding file index

            var result = {}
            result['errors'] = [];
            result['done'] = [];

            for (i in resArr){
                if(resArr[i] === true){
                    result['done'].push(files[i]);
                }
                else if (resArr[i] === false){
                    result['errors'].push(files[i]);
                }
            }

            return result;
        });
}

//import file to elastic --> resolves to boolean
module.exports.importFile = function(parentDir, filename, tableName){

        var csvFilePath = path.join(parentDir, filename);

        if (!fs.existsSync(csvFilePath)){
            var absolutePath = path.resolve(csvFilePath);
            console.log("File not found " + absolutePath);
        }

        //Check if file already loaded to DB
        var year = filename.split('_')[1];
        var quarter = filename.split('_')[2];
        var fund = filename.split('_')[3].split('.')[0];
        var managing_body = filename.split('_')[0];

    client.count({
            index: 'production',
            body: {
                query: {
                    filtered: {
                        filter: {
                            and:[
                                    {
                                        term: {
                                            managing_body: managing_body
                                        }
                                    },
                                    {
                                        term: {
                                            report_year: year
                                        }
                                    },
                                    {
                                        term: {
                                            report_qurater: quarter
                                        }
                                    },
                                    {
                                        term: {
                                            fund: fund
                                        }
                                    }
                                ]
                        }
                    }
                }
            }
        })
        .then(function(response){

            return new Promise(function(resolve,reject){

                        var count = response.count;

                        if (count > 0){ //fund in DB, skip file
                            logger.info([managing_body, year, quarter, fund].join("_") + " file already loaded to Elastic	")
                            resolve();
                            return;
                        }

                        //File not in DB, copy to table
                        var csvStr = fs.readFileSync(csvFilePath, "utf8");

                        return CSVParser(csvStr)
                            .then(function(data){

                                var body  = [];
                                for (var i = 0; i < data.length; i++){
                                    body.push({ index:  { _index: 'production', _type: 'investment' } });
                                    body.push(data[i]);
                                }

                                client.bulk({
                                    body: body
                                }, function (err, resp) {
                                    // ...
                                    //console.log(error)
                                    console.log(response)
                                });

                            });

                    });
            });

}



module.exports.copyDbColumnToEs = function(fieldName){

    var tableName = "pension_data_all";
    var sql = "SELECT distinct("+fieldName+") FROM "+ tableName ;

    return db.query(sql)
        .then(function(data){


                var body  = [];
                for (var i = 0; i < data.length; i++){
                    body.push({ index:  { _index: 'production', _type: fieldName } });
                    body.push(data[i]);
                }


                return body;
        })
        .then(function(body){
            return client.bulk({
                body: body
            }, function (err, resp) {
                // ...
                console.log(err)
                console.log(resp)
            });
        })


}



module.exports.searchInIndex = function(type, term){

    return client.search({
            index: 'production',
            type: type,
            body:
            {
                "query": {
                    "query_string": {
                        "query": "*"+term+"*",
                    }
                }
            }
        })
    .then(function(result){
        var result = result.hits.hits;
        result = _.map(result, function(r){return r._source});
        return result;
    });

}

module.exports.deleteIndex = function(){
    return client.indices.delete({
        index:'production'

    }).then(function(result){
        //console.log(JSON.stringify(result));
    }).catch(function(err){
        console.log(JSON.stringify(err));
    });
}

module.exports.createIndex = function(){
    return client.indices.create({
        index: 'production',
        body:{
            //mappings: {
            //    "investment": {
            //        "properties": {
            //            "fair_value": {
            //                "type": "double"
            //            }
            //        }
            //    }
            //}
        }
    }).then(function(result){
        //console.log(JSON.stringify(result));
    }).catch(function(err){
        console.log(JSON.stringify(err));
    });
}

module.exports.recreateIndices = function(){

    module.exports.deleteIndex()
        .then(module.exports.createIndex())
        .then(module.exports.copyDbColumnToEs('fund_name'))
        .then(module.exports.copyDbColumnToEs('instrument_name'))
        .then(module.exports.copyDbColumnToEs('instrument_id'));

}