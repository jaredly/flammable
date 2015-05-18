
import React from 'react/addons'
import {subShape, unsubShape, walkShape, walkTree, diffShape} from './utils'

function shapeToState(shape, state) {
  const result = {}
  walkThat(shape, state, result)
  return result
}

function walkThat(shape, obj, result) {
  if (!obj) throw Error('no obj:' + obj)
  Object.keys(shape).forEach(attr => {
    if (!obj[attr]) return
    if ('string' === typeof shape[attr]) {
      result[shape[attr]] = obj[attr]
    } else {
      walkThat(shape[attr], obj[attr], result)
    }
  })
}

/**
 * # Our main flux controller!
 *
 * This is generally *not* subclassed. You make an
 * instance, and then add stores and actions to it.
 * 
 * # Usage:
 * ```
 * const flux = new Flux()
 * flux.addStore('storename', storeListeners)
 * flux.addActions('actiongroup', actionFns)
 * ```
 *
 * For usage with React components, you want
 *
 * ```
 * import {Flux} from 'flammable/react'
 * const flux = new Flux()
 * // add stores and actions
 *
 * React.render(flux.wrap(<App/>), document.body)
 * ```
 *
 * flux.wrap then enables that component and subcomponents to use the
 * `fluxify` decorator for seamless integration with React components.
 */
export default class Flux {
  constructor() {
    this._sendQueue = this._sendQueue.bind(this)
    this.listentree = {}
    this.actionListeners = {}
    this.eventListeners = {}
    this.events = {}
    this.stores = {}
    this.actions = {}
  }

  /**
   * Update a store, enqueing appropriate updates.
   *
   * store: str
   * how: an `update` object, as expected by `React.addons.update`
   */
  update(store, how, events) {
    const updates = getUpdates(store, how)
    this.stores[store] = React.addons.update(this.stores[store], how)
    this._enqueueUpdates(updates)
    if (events && events.length) {
      this._enqueueEvents(events)
    }
  }

  /**
   * name: str
   * init: (optional) a function that returns the innital state of the store
   * listeners: obj like {
   *   actiongroup: {
   *     actionname(data, update, state) {
   *       data: the (resolved) value returned by the action creator
   *       update: fn(how), where how is an object expected by
   *         `React.addons.update`. `update` here is flux.update.bind(flux, storename)
   *       state: the current state of the store, should you need it. DO NOT MODIFY
   *     }
   *     // if you want to do error handling and optimistic updates for an
   *     // async action, provide this map instead. `tid` is a "transaction id"
   *     // which can be used to line up "error/done" calls to the
   *     // corresponding "start" call.
   *     otheraction: {
   *       start(tid, data, update, state) {
   *       },
   *       error(tid, data, update, state) {
   *       },
   *       done(tid, data, update, state) {
   *       }
   *     }
   *   }
   * }
   */
  addStore(name, init, listeners) {
    if (arguments.length === 2) {
      listeners = init
      this.stores[name] = {}
    } else {
      if ('function' === typeof init) {
        this.stores[name] = init()
      } else {
        this.stores[name] = init
      }
    }
    for (let actions in listeners) {
      for (let event in listeners[actions]) {
        this.registerActionListener(actions, event, this._handleAction.bind(this, name, listeners[actions][event]))
      }
    }
  }

  addEvents(group, events) {
    this.events[group] = events
  }

  /**
   * name: str
   * actions: obj like {
   *   someaction(args, that, I, want) {
   *     // do things
   *     return somevalue
   *   }
   * }
   *
   * If the return value of an action is a promise, then it is
   * resolved/caught, and listening stores are notified accordingly.
   */
  addActions(name, actions) {
    this.actions[name] = actions
  }

  /**
   * Simple action listener
   *
   * only called once an action has successfully completed
   *
   * group(str): the action group
   * event(str): the specific action
   * handler: fn(value)
   */
  onAction(group, event, handler) {
    this.registerActionListener(group, event, (value, tid, status) => {
      if (!status) return handler(value)
      else if (status === 'done') return handler(value.result)
    })
  }

  /**
   * group(str): the action group
   * event(str): the specific action
   * handler: fn(value) if the action is sync, otherwise
   *    fn(value, tid, tstatus) where tstatus E ('start', 'error', 'done')
   */
  registerActionListener(group, event, handler) {
    if (!this.actionListeners[group]) {
      return this.actionListeners[group] = {[event]: [handler]}
    }
    if (!this.actionListeners[group][event]) {
      return this.actionListeners[group][event] = [handler]
    }
    this.actionListeners[group][event].push(handler)
  }

  /**
   * Get a map of action callers
   *
   * actions: obj like {
   *   someName: 'actiongroup.actionname',
   *   otherName: ['somegroup.othername', arg1, arg2]
   * }
   * returns an object like {
   *   someName: fn() - calls actiongroup.actionname with arguments
   *   otherName: fn() - calls somegroup.othername with (arg1, arg2) as the
   *     first arguments and then other arguments you pass in
   * }
   */
  getActionMap(actions) {
    const map = {}
    Object.keys(actions).forEach(name => {
      let def = actions[name]
      let [group, action] = ('string' === typeof def ? def : def[0]).split('.')
      if (!this.actions[group]) {
        throw new Error(`No action group ${group}`)
      }
      if (!this.actions[group][action]) {
        throw new Error(`No action ${group}.${action}`)
      }
      map[name] = this.sendAction.bind(this, actions[name])
    })
    return map
  }

  /**
   * Subscribe to store updates
   *
   * shape: obj like {
   *   storename: {
   *     attr: {
   *       subattr: keyname
   *     }
   *   }
   * }
   * listeners: obj like {
   *   keyname: fn(newvalue)
   *   ...
   * }
   *
   * So when storename.attr.subattr changes, listeners.keyname will be called
   * with the new value.
   */
  subscribe(shape, listeners) {
    for (let name in shape) {
      if (this.stores[name] === undefined) {
        debugger
        throw new Error(`No such store defined: ${name}`)
      }
    }
    const data = {}
    subShape(shape, this.stores, this.listentree, data, listeners)
    return data
  }

  /**
   * Diff a previous subscription shape with a new one.
   *
   * prevShape and newShape are like `shape` from `.subscribe()`, and
   * `listeners` is expected to have all of the old listeners as well as the
   * new ones.
   */
  diffscribe(prevShape, newShape, listeners) {
    const data = {}
    diffShape(prevShape, newShape, this.stores, this.listentree, data, listeners)
    return data
  }

  /**
   * Unsubscribe from store updates
   *
   * shape and listeners are the same as for `subscribe`
   */
  unsubscribe(shape, listeners) {
    unsubShape(shape, this.listentree, listeners)
  }

  /**
   * Convert a shape definition into a state object
   */
  shapeToState(shape) {
    return shapeToState(shape, this.stores)
  }

  /**
   * Call a callback with updated sample data, every time an event is fired.
   *
   * - events: a list of strings of events to listen to
   * - sample: a nested object with the same format as for `shape` of
   *   `subscribe`
   * - callback: a function called with the new data whenever the events are
   *   fired.
   */
  listenToEvents(events, callback) {
    events.forEach(ev => {
      if (!this.eventListeners[ev]) {
        this.eventListeners[ev] = new Set([callback])
      } else {
        this.eventListeners[ev].add(callback)
      }
    })
  }

  /**
   * Get an event key
   */
  event(group, name, ...args) {
    return name + SEP + this.events[group][name](...args)
  }

  /**
   * Remove event listeners
   */
  unlistenEvents(events, callback) {
    events.forEach(ev => {
      if (!this.eventListeners[ev]) return
      this.eventListeners[ev].delete(callback)
    })
  }

  /**
   * Kick off an action
   *
   * action: str like 'group.actionname'
   * other arguments are passed to the action creator
   */
  sendAction(action, ...args) {
    if (Array.isArray(action)) {
      args = action.slice(1).concat(args)
      action = action[0]
    }
    const [actions, event] = action.split('.')
    if (!this.actions[actions]) {
      throw new Error(`Unknown action group ${actions}`)
    }
    if (!this.actions[actions][event]) {
      throw new Error(`Unknown action ${event}`)
    }
    let res
    if (true === this.actions[actions][event]) {
      // this is a "pass-through" action (first agument is the result)
      res = args[0]
    } else {
      res = this.actions[actions][event].apply(null, args)
    }
    if (!res || !res.then || !res.catch) {
      this._emit(actions, event, res)
      return null
    }
    const tid = Math.random().toString(0x0f).slice(10, 30)
    this._emit(actions, event, args, tid, 'start')
    res.then(val => this._emit(actions, event, {args, result: val}, tid, 'done'))
      .catch(error => this._emit(actions, event, {args, error}, tid, 'error'))
    return tid
  }

  _sendQueue() {
    if (!this.queue) return
    if (this.queue.updates) this._sendUpdates()
    if (this.queue.events) this._sendEvents()
    this.queue = null
  }

  _sendUpdates() {
    const updated = new Set()
    for (let update of this.queue.updates.values()) {
      const parts = update.split(SEP)
      let tree = this.listentree
      let obj = this.stores
      let quit = parts.some(part => {
        if (!tree[part]) return true
        tree = tree[part]
        obj = obj ? obj[part] : null
        if (!tree.$listeners) return
        tree.$listeners.forEach(fn => {
          if (updated.has(fn)) return
          updated.add(fn)
          fn(obj)
        })
      })
      if (quit) continue
      walkTree(tree, obj, updated)
    }
    this.queue.updates = null
  }

  // propagate the events that have been enqueued
  _sendEvents() {
    const updated = new Set()
    for (let event of this.queue.events.values()) {
      if (!this.eventListeners[event]) continue;
      this.eventListeners[event].forEach(fn => {
        if (updated.has(fn)) return
        updated.add(fn)
        fn()
      })
    }
    this.queue.events = null
  }

  _emit(actions, event, val, tid, tstatus) {
    if (!this.actionListeners[actions]) return
    if (!this.actionListeners[actions][event]) return
    if (arguments.length === 3) {
      return this.actionListeners[actions][event].forEach(fn => fn(val))
    }
    this.actionListeners[actions][event].forEach(fn => fn(val, tid, tstatus))
  }

  _enqueueUpdates(updates) {
    if (!this.queue) {
      this.raf()
      this.queue = {updates: new Set(), events: null}
    } else if (!this.queue.updates) {
      this.queue.updates = new Set()
    }
    updates.forEach(update => this.queue.updates.add(update.join(SEP)))
  }

  _enqueueEvents(events) {
    if (!this.queue) {
      this.raf()
      this.queue = {updates: null, events: new Set()}
    } else if (!this.queue.events) {
      this.queue.events = new Set()
    }
    events.forEach(event => this.queue.events.add(event))
  }

  _handleAction(store, fn, val, tid, tstatus) {
    const storeObj = {
      update: this.update.bind(this, store),
      state: this.stores[store],
      sendAction: this.sendAction.bind(this),
      // events: this.events,
      event: this.event.bind(this),
    }

    if (arguments.length === 3) {
      // console.log('> action', store, val)
      fn(storeObj, val)
      // fn(val, , this.stores[store], this.sendAction.bind(this))
    } else {
      // console.log('> action (async)', store, val, tid, tstatus)
      if ('function' === typeof fn && tstatus === 'done') {
        fn(storeObj, val.result)
        // fn(val.result, this.update.bind(this, store), this.stores[store], this.sendAction.bind(this))
        return
      }
      if (tstatus === 'done' && fn.result) {
        fn.result(storeObj, tid, val.result)
        // fn.result(tid, val.result, this.update.bind(this, store), this.stores[store], this.sendAction.bind(this))
      }
      if (fn[tstatus]) {
        fn[tstatus](storeObj, tid, val)
        // fn[tstatus](tid, val, this.update.bind(this, store), this.stores[store], this.sendAction.bind(this))
      } else if (tstatus === 'error') {
        console.warn('Unhandled error event', val)
        debugger
      }
    }
  }

  // TODO is requestAnimationFrame better for this, or do I just want "batch
  // sync ops"?
  raf() {
    if (typeof window !== 'undefined' && window.setImmediate) {
      window.setImmediate(this._sendQueue)
    } else {
      setTimeout(this._sendQueue, 0)
    }
    // window.requestAnimationFrame(this._sendQueue)
  }
}

function getUpdates(store, how) {
  const updates = []
  crawlUpdates(how, [store], updates)
  return updates
}

function crawlUpdates(how, path, updates) {
  if (!how || typeof how !== 'object') return
  let added = false
  Object.keys(how).forEach(name => {
    if (name[0] === '$') {
      if (!added) {
        updates.push(path)
        added = true
      }
    } else {
      crawlUpdates(how[name], path.concat([name]), updates)
    }
  })
}

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

const SEP = '\ufdd0'

