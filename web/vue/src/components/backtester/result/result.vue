<template lang='jade'>
  div
    .hr.contain
    div.contain
      h3 Backtest result
    result-summary(:report='result.report')
    .hr.contain
    highchart(:data='result', height='960')
    .hr.contain
    roundtripTable(:roundtrips='result.roundtrips')
</template>

<script>
import resultSummary from './summary.vue'
import highchart from './highchartsWrapper.vue'
import roundtripTable from './roundtripTable.vue'

export default {
  props: ['result'],
  data: () => {
    return {}
  },
  methods: {},
  components: {
    roundtripTable,
    resultSummary,
    highchart
  }
}
</script>

<style>
</style>
