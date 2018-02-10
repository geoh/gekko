'use strict';
(function(factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory;
    } else {
        factory(Highcharts);
    }
}(function(Highcharts) {
    (function(H) {

        var Series = H.Series;

        Highcharts.seriesTypes.column.prototype.updateColors = function() {
            if (typeof this.options.colorOverride != "undefined") {
                var i,
                    total = 0,
                    points = this.points,
                    len = points.length,
                    point;

                for (i = 0; i < len; i++) {
                    point = points[i];
                    this.options.colorOverride(point);
                }
            }
        }

        Highcharts.seriesTypes.column.prototype.generatePoints = function() {
            Series.prototype.generatePoints.call(this);
            this.updateColors();
        }


    }(Highcharts));
}));
