define(function(require) {
  'use strict';
  
  var Backbone = require('backbone');
  var Marionette = require('backbone.marionette');
  var content = require('hbs!/templates/homepage-content');
  var config = require('json!config');

  return Marionette.ItemView.extend({
    template: content,
    events: {
      "click #login" : function(){
        location.href = "/#reports"        
      }
  	}

  });
});