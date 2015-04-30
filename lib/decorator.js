
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

/**
 * This is the decorator, generally imported as "fluxify"
 * as in `import {fluxify} from 'flammable/react`.
 *
 * `config` looks like: {
 *  data: obj or fn(props) -> obj
 *     {
 *       storename: {
 *        subkey: {
 *         subsubkey: 'propname'
 *        }
 *       },
 *       otherstore: 'propname2'
 *     }
 *     // so this.props.propname === stores.storename.subkey.subsubkey, and
 *     // this.props.propsname2 === stores.otherstore (full value)
 *  actions: obj or fn(props) -> obj
 *    {
 *      propname: 'group.action',
 *      propname2: ['group2.otheraction', 34],
 *    }
 *    // so this.props.propname(a, b) == create `group.action` with args (a, b)
 *    // and this.props.propname2(baz) == create `group2.otheraction` with args (34, baz)
 * }
 */
export default config => Component => class FluxComponent extends React.Component {
  constructor(props) {
    super(props)
    this.isSetup = false
    if (props.flux) {
      this.setup(props.flux)
    }
  }

  // attach to the main flux object. Could happen in the constructor or in the
  // componentWillMount (from props / context)
  setup(flux) {
    let listeners = config.data
    if (!listeners) return this.isSetup = true
    if ('function' === typeof listeners) {
      listeners = listeners(this.props)
    }
    this.update = this.update.bind(this)
    this._listened = listeners
    this._updaters = {}
    makeListeners(listeners, this.update, this._updaters)
    const state = flux.subscribe(listeners, this._updaters)
    if (!this.state) {
      this.state = state
    } else {
      this.setState(state)
    }
    this.isSetup = true
  }

  componentWillMount() {
    if (!this.isSetup) {
      if (!this.context || !this.context.flux) {
        throw new Error(`Flux must come to this component either through props
                        or through context.  *this might be caused by multiple
                        versions of react on your page*`)
      }
      this.setup(this.context.flux)
    }
  }

  update(name, value) {
    this.setState({[name]: value})
  }

  static decorated = Component

  /* Context stuff */
  static contextTypes = {
    flux: PT.any
  }

  static childContextTypes = {
    flux: PT.any
  }

  getChildContext() {
    return {
      flux: this.context && this.context.flux || this.props.flux
    }
  }

  // recompute listeners, and `diffscribe`
  componentWillReceiveProps(nextProps) {
    if ('function' !== typeof config.data) return
    const listeners = config.data(nextProps)
    makeListeners(listeners, this.update, this._updaters)
    const flux = this.context && this.context.flux || this.props.flux
    const data = flux.diffscribe(this._listened, listeners, this._updaters)
    this._listened = listeners
    this.setState(data)
  }

  // unsubscribe
  componentWillUnmount() {
    const flux = this.context && this.context.flux || this.props.flux
    flux.unsubscribe(this._listened, this._updaters)
  }

  // build actions dict, and render the wrapped component
  render() {
    const actions = {}
    if (config.actions) {
      let ca = config.actions
      if ('function' === typeof ca) ca = ca(this.props)
      const flux = this.context && this.context.flux || this.props.flux
      Object.keys(ca).forEach(name =>
        actions[name] = flux.sendAction.bind(flux, ca[name]))
    }
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

