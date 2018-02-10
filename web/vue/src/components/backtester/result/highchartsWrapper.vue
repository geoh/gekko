<template lang='jade'>
#resultHighchart
</template>

<script>

import chart from '../../../highcharts/chart'

const MIN_CANDLES = 4;

export default {
  props: ['data', 'height'],

  data: () => {
    return {}
  },

  watch: {
    data: function() { this.render() },
  },

  created: function() {
    setTimeout( this.render, 100);
  },

  methods: {
    render: function() {
      if(_.size(this.data.candles) < MIN_CANDLES) {
        alert('Not enough data to spawn chart');
      } else {
        this.chart = chart(this.data.candles, this.data.trades, this.data.report, this.data.indicatorResults, this.height);
      }
    },
  }
}
</script>

<style>
</style>
