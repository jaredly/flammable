
import Flux from '..'
import Promise from 'bluebird'

class MyActions {
  setNum(num) {
    return num
  }

  inc() {
    return true
  }

  setVal(name, value) {
    return {name, value}
  }

  doLater(name, value) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({name, value})
      }, 10)
    })
  }
}

const f = new Flux()

f.addStore('mystore', () => {
  return {
    mynum: 10,
    mymap: {},
  }
}, {
  myactions: {
    setNum(val, update) {
      update({mynum: {$set: val}})
    },
    inc(_, update, state) {
      update({mynum: {$set: state.mynum + 1}})
    },
    setVal({name, value}, update) {
      update({mymap: {[name]: {$set: value}}})
    },
    doLater({name, value}, update) {
      update({mymap: {[name]: {$set: value}}})
    }
  }
})

f.addActions('myactions', new MyActions())

f.subscribe({
  mystore: {
    mynum: 'num',
    mymap: {
      one: 'one',
    }
  }
}, {
  num: (val) => {
    console.log('change num', val)
  },
  one: (val) => {
    console.log('change one', val)
  }
})

f.sendAction('myactions.inc')
f.sendAction('myactions.setNum', 2)
f.sendAction('myactions.inc')
f.sendAction(['myactions.setVal', 'one'], '45')
f.sendAction('myactions.doLater', 'one', '10')

