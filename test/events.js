
import expect from 'expect.js'
import Flux from '..'
import * as utils from '../lib/utils'

describe('Flux', () => {
  let flux
  beforeEach(() => {
    flux = new Flux()
  })

  it('needs too work with events', done => {
    flux.addStore('thing', {one: 2}, {
      some: {
        doit(store, val) {
          console.log('awesomething', store, val)
          store.update({one: {$set: val}}, [
            store.event('other', 'evt', 'hello')
          ])
        }
      }
    })

    flux.addActions('some', {
      doit: true
    })

    flux.addEvents('other', {
      evt: thing => 'thing->' + thing,
    })

    flux.listenToEvents([flux.event('other', 'evt', 'hello')], () => {
      done()
    })

    flux.sendAction('some.doit', 100)
  })
})

