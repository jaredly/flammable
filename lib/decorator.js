
import React from 'react'

function assign(a, b) {
  for (let c in b) {
    a[c] = b[c]
  }
  return a
}

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
 * # Example:
 * ```
 * import {fluxify} from 'flammable/react'
 *
 * @fluxify({
 *   data: {
 *     people: 'people',
 *   },
 *   actions: {
 *     fetchPeople: 'people.fetch',
 *     updatePerson: 'people.update',
 *     remove10People: ['people.remove', 10],
 *   }
 * })
 * class PeopleViewer extends React.Component {
 *   componentWillMount() {
 *     if (!this.props.people) {
 *       this.props.fetchPeople()
 *     }
 *   }
 *   render() {
 *     if (!this.props.people) return <span>Loading</span>
 *     return <div>
 *       {this.props.people.map(person => <Person data={person}/>)}
 *     </div>
 *   }
 * }
 *
 * # Arguments:
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
 *  events: list or fn(props, events) -> list
 *    The list of events to listen for, and then get the data described in
 *    `sample`
 *  sample: obj or fn(props) -> obj
 *    This looks the same as the `data` argument, but state is *not* updated
 *    whenever these things change, but rather when an `event` is fired.
 *    
 * }
 */
export default config => Component => class FluxComponent extends React.Component {
  constructor(props) {
    super(props)
    this.isSetup = false
    if (props.flux) {
      this.setup(props.flux)
    }
    if (!this.constructor.contextTypes.flux) {
      throw new Error(`${Component.name}.contextTypes has been modified! It must contain "flux"`)
    }
  }

  // attach to the main flux object. Could happen in the constructor or in the
  // componentWillMount (from props / context)
  setup(flux) {
    let listeners = config.data
    let state

    if (listeners) {
      if ('function' === typeof listeners) {
        listeners = listeners(this.props)
      }
      this.update = this.update.bind(this)
      this._listened = listeners
      this._updaters = {}
      makeListeners(listeners, this.update, this._updaters)
      state = flux.subscribe(listeners, this._updaters)
    }

    if ((config.events && !config.sample) || (config.sample && !config.events)) {
      throw new Error('Flammable configuration error; need both `sample` and `events` or neither.')
    } else if (config.sample && config.events) {
      state = {}
      var callback = state => {
        this.onSampled(flux.shapeToState(config.sample))
      }
      this._eventListener = callback
      const events = config.events(this.props, flux.event.bind(flux))
      this._eventsListened = events
      flux.listenToEvents(events, callback)

      assign(state, flux.shapeToState(config.sample))
    }
    this.isSetup = true
    if (!state) return
    if (!this.state) {
      this.state = state
    } else {
      this.setState(state)
    }
  }

  componentWillMount() {
    if (!this.isSetup) {
      if (!this.context || !this.context.flux) {
        throw new Error(noContextError(Component))
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
    if (!this._listened || !this._updaters) return
    const flux = this.context && this.context.flux || this.props.flux
    flux.unsubscribe(this._listened, this._updaters)
    if (this._eventsListened) {
      flux.unlistenEvents(this._eventListener, this._eventsListened)
    }
  }

  // build actions dict, and render the wrapped component
  render() {
    let actionMap = {}
    if (config.actions) {
      let actions = config.actions
      if ('function' === typeof actions) actions = actions(this.props)
      const flux = this.context && this.context.flux || this.props.flux
      actionMap = flux.getActionMap(actions)
    }
    return <Component {...actionMap} {...this.props} {...this.state}/>
  }
}

function noContextError(component) {
  return `Flux must come to this component either through props or through context.
  Possible causes:
  - you have overriden the "contextTypes" static attr on "${component.name}"
  - there are multiple versions of React on your page`
}

