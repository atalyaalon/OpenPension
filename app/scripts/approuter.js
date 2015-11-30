define([
	'backbone',
	'backbone.marionette'
],

function(Backbone, Marionette) {
  'use strict';
	var Router = Backbone.Marionette.AppRouter.extend({
	  appRoutes: {
	    "": "home",
	    "home": "home",
	    "reports" : "reports",
	    "editReports" : "editReports"
	  }
	});
  return Router;
});
