define(function(require) {

  'use strict';

  var Backbone = require('backbone');
  var Marionette = require('backbone.marionette');
  var HomepageView = require('../views/homepage/HomepageView');
  var ReportsView = require('../views/reports/ReportsView');
  var EditReportsView = require('../views/edit_reports/EditReportsView');

  var Controller = Backbone.Marionette.Controller.extend({

    		region: undefined,

        initialize : function(options) {
        	console.log("init");

          this.region = options.region;
       	},

        start: function() {
        	console.log("start");
            //TODO: code to start
        },

        /**
         * Initialized on start, without hash
         * @method
         */
       	home :  function () {
     			this.region.show(new HomepageView());
        },

        about: function(){
          this.region.show(new AboutView());
        },

        reports: function(){
          this.region.show(new ReportsView());
        },
        
        editReports: function(){
          this.region.show(new EditReportsView());
        }
    });

    return Controller;
});
