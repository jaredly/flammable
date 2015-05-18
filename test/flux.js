
import expect from 'expect.js'
import Flux from '..'
import * as utils from '../lib/utils'

describe('things', () => {
  it('should be ok', () => {
  })
})

describe('Flux', () => {
  let flux
  beforeEach(() => {
    flux = new Flux()
  })
  describe('addStore', () => {
    it('should work with simplest case', () => {
      flux.addStore('one', {})
      expect(flux.stores.one).to.eql({})
    })

    it('should work with const init', () => {
      flux.addStore('one', 10, {})
      expect(flux.stores.one).to.eql(10)
    })

    it('should work with fn init', () => {
      flux.addStore('one', () => 34, {})
      expect(flux.stores.one).to.eql(34)
    })
  })

  describe('with some actions', () => {
    beforeEach(() => {
      flux.addActions('one', {
        doit() {return 10},
        pass: true,
      })
    })

    describe('.getActionMap', () => {
      it('should work', () => {
        const map = flux.getActionMap({
          first: 'one.doit',
          second: 'one.pass',
        })
        expect(map.first).to.be.a('function')
        expect(map.second).to.be.a('function')
      })

      it('should fail for missing group', () => {
        expect(flux.getActionMap.bind(flux)).withArgs({
          first: 'nogroup.thing'
        }).to.throwError()
      })

      it('should fail for missing action', () => {
        expect(flux.getActionMap.bind(flux)).withArgs({
          first: 'one.noaction'
        }).to.throwError()
      })
    })
  })
})

describe('async actions', () => {
  it('should work (both success and failure)', (done) => {
    let flux = new Flux()
    flux.addStore('async', {
      async: {
        call: {
          start(store, tid, args) {
            store.update({
              called: {$set: args},
              tid: {$set: tid},
              done: {$set: null}
            })
          },
          error(store, tid, {error, args}) {
            expect(tid).to.equal(store.state.tid)
            store.update({error: {$set: {args, error}}})
          },
          done(store, tid, {args, result}) {
            expect(tid).to.equal(store.state.tid)
            store.update({done: {$set: {args, result}}})
          },
          result(store, tid, result) {
            expect(tid).to.equal(store.state.tid)
            store.update({result: {$set: result}})
          }
        }
      }
    })

    flux.addActions('async', {
      call(value) {
        return new Promise((resolve, reject) => {
          if (value === 'fail') reject(value)
          else resolve('yes ' + value)
        })
      }
    })

    flux.sendAction('async.call', 'hello')
    setTimeout(() => {
      expect(flux.stores.async.called).to.eql(['hello'])
      expect(flux.stores.async.done).to.eql({
        args: ['hello'],
        result: 'yes hello'
      })
      flux.sendAction('async.call', 'fail')
      setTimeout(() => {
        expect(flux.stores.async.called).to.eql(['fail'])
        expect(flux.stores.async.done).to.not.be.ok()
        expect(flux.stores.async.error).to.eql({
          args: ['fail'],
          error: 'fail'
        })
        done()
      }, 10)
    }, 10)
  })
})

describe('Flux Basic Setup', () => {
  it('should work', () => {
    let flux = new Flux()
    flux.addStore('one', 10, {
      one: {
        inc(store, val) {
          store.update({$set: store.state + 1})
        },
        set(store, val) {
          store.update({$set: val})
        },
      }
    })

    flux.addActions('one', {
      inc: true,
      set: true,
    })
    flux.sendAction('one.inc')
    expect(flux.stores.one).to.eql(11)

    flux.sendAction('one.set', 2)
    expect(flux.stores.one).to.eql(2)
  })
})

describe('Full walkthrough', () => {
  it('should work', () => {
    let flux = new Flux()
    flux.addStore('one', 10, {
      one: {
        inc(store, val) {
          store.update({$set: store.state + 1})
        },

        set(store, val) {
          store.update({$set: val})
        },
      }
    })

    flux.addActions('one', {
      inc: true,
      set: true,
    })
  })
})


