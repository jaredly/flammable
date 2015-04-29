
import React from 'react'

const PT = React.PropTypes

function makeListeners(shape, fn, listeners) {
  for (let name in shape) {
    if ('string' === typeof shape[name]) {
      if (!listeners[shape[name]]) {
        listeners[shape[name]] = fn.bind(null, shape[name])
      }
    } else {
      makeListeners(shape[name], fn, listeners)
    }
  }
}

export default config => Component => class FluxComponent extends React.Component {
  constructor(props) {
    super(props)
    let listeners = config.data
    if ('function' === typeof listeners) {
      listeners = listeners(props)
    }
    this.update = this.update.bind(this)
    this._listened = listeners
    this._updaters = {}
    makeListeners(listeners, this.update, this._updaters)
    const flux = this.context && this.context.flux || this.props.flux
    this.state = flux.subscribe(listeners, this._updaters)
  }

  update(name, value) {
    this.setState({name, value})
  }

  static contextTypes = {
    flux: PT.any
  }

  componentWillReceiveProps(nextProps) {
    if ('function' !== typeof config.data) return
    const listeners = config.data(nextProps)
    makeListeners(listeners, this.update, this._updaters)
    const flux = this.context && this.context.flux || this.props.flux
    const data = flux.diffscribe(this._listened, listeners, this._updaters)
    this._listened = listeners
    this.setState(data)
  }

  componentWillUnmount() {
    const flux = this.context && this.context.flux || this.props.flux
    flux.unsubscribe(this._listened, this._updaters)
  }

  render() {
    const actions = {}
    const flux = this.context && this.context.flux || this.props.flux
    Object.keys(config.actions).forEach(name =>
      actions[name] = flux.sendAction.bind(null, config.actions[name]))
    return <Component {...actions} {...this.props} {...this.state}/>
  }
}

/*
// Example

@flux({
  actions: {
  },
  data: {
    myStore: 'value'
  },
})
class Hello extends React.Component {
}
*/

