define(function(require) {
  'use strict';
  var Backbone = require('backbone');
  var Fund = require('/models/Fund.js');
  var Funds = Backbone.Collection.extend({

    model: Fund,
    url : 'http://mytest2.com:4000/api/funds'

  });

  return Funds;

});