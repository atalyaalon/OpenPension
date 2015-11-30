define(function(require) {
  'use strict';
  var Backbone = require('backbone');
  var ManagingBody = require('/models/ManagingBody.js');
  var ManagingBodies = Backbone.Collection.extend({

    model: ManagingBody,
    url : 'http://mytest2.com:4000/api/managing_bodies'

  });

  return ManagingBodies;

});