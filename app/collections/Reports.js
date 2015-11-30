define(function(require) {
  'use strict';
  var Backbone = require('backbone');
  var Report = require('/models/Report.js');

  var Reports = Backbone.Collection.extend({

    model: Report,
    url : '/reports'

  });

  return Reports;

});
