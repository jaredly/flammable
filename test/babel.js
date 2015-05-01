
var m = require('babel-core/register')

m({stage: 0})

module.exports = function () {
  return m({stage: 0})
}

