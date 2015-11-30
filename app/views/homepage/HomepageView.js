define(function(require) {
  'use strict';
  
  var Backbone = require('backbone');
  var Marionette = require('backbone.marionette');
  var homepage = require('hbs!/templates/homepage');
  var HomepageHeaderView = require('../../views/homepage/HomepageHeaderView');
  var HomepageContentView = require('../../views/homepage/HomepageContentView');
  


  return Backbone.Marionette.LayoutView.extend({
    template: homepage,
    regions: {
  		header: '#homepage-header',
  		content: '#homepage-content',
  		footer: 'footer'
  	},
  	onBeforeShow: function() {
    		this.showChildView('header', new HomepageHeaderView());
    		this.showChildView('content', new HomepageContentView());
  	},
    onShow: function(){
    },
    events: {
    }
  
  });

});