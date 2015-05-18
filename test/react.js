
import expect from 'expect.js'
import React from 'react'
import {Flux, fluxify} from '../react'

describe('React', () => {
  it('should throw Error if no flux context', () => {
    @fluxify({})
    class Thing extends React.Component {
      render() {
        return <span>Hi</span>
      }
    }

    expect(React.renderToStaticMarkup.bind(React)).withArgs(<Thing/>).to.throwError(/Flux must come/)
  })

  it('should throw Error if contextTypes has been tampered with', () => {
    @fluxify({})
    class Thing extends React.Component {
      render() {
        return <span>Hi</span>
      }
    }

    let flux = new Flux()

    Thing.contextTypes = {}

    expect(React.renderToStaticMarkup.bind(React))
      .withArgs(flux.wrap(<Thing/>)).to.throwError(/Thing.contextTypes has been modified/)
  })

  describe('should work with events', done => {
    let ThingEl
    let flux

    beforeEach(() => {
      @fluxify({
        events: (props, events) => [
          events('egroup', 'somev', 23)
        ],
        sample: {
          one: {
            thing: 'thing'
          }
        },
        actions: {
          doThing: ['one.thing', 'done']
        }
      })
      class Thing extends React.Component {
        render() {
          return <span>{this.props.thing || '! not defined'}</span>
        }
      }
      ThingEl = Thing

      flux = new Flux()
      flux.addEvents('egroup', {
        somev: num => 'some:' + num,
      })

      flux.addStore('one', () => ({thing: 'undone'}), {
        one: {
          thing(store, val) {
            store.update({thing: {$set: val}}, [
              store.event('egroup', 'somev', 23)
            ])
          }
        }
      })
      flux.addActions('one', {
        thing: true
      })
    })

    it('should render', () => {
      const str = React.renderToStaticMarkup(flux.wrap(<ThingEl/>))
      expect(str).to.eql('<span>undone</span>')
    })

    it('should reflect action change', () => {
      flux.sendAction('one.thing', 'done')
      const str = React.renderToStaticMarkup(flux.wrap(<ThingEl/>))
      expect(str).to.eql('<span>done</span>')
    })

  })

  describe('with lots of things setup', () => {
    let ThingEl
    let flux
    beforeEach(() => {
      @fluxify({
        data: {
          one: {
            thing: 'thing'
          }
        },
        actions: {
          doThing: ['one.thing', 'done']
        }
      })
      class Thing extends React.Component {
        render() {
          return <span>{this.props.thing}</span>
        }
      }
      ThingEl = Thing

      flux = new Flux()
      flux.addStore('one', () => ({thing: 'undone'}), {
        one: {
          thing(store, val) {
            store.update({thing: {$set: val}})
          }
        }
      })
      flux.addActions('one', {
        thing: true
      })
    })

    it('should render', () => {
      const str = React.renderToStaticMarkup(flux.wrap(<ThingEl/>))
      expect(str).to.eql('<span>undone</span>')
    })

    it('should reflect action change', () => {
      flux.sendAction('one.thing', 'done')
      const str = React.renderToStaticMarkup(flux.wrap(<ThingEl/>))
      expect(str).to.eql('<span>done</span>')
    })
  })
})

