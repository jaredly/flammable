
import React from 'react/addons'
import {subShape, walkShape, walkTree, diffShape} from './utils'

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
    this._sendUpdates = this._sendUpdates.bind(this)
    this.listentree = {}
    this.actionListeners = {}
    this.stores = {}
    this.actions = {}
  }

  /**
   * Update a store, enqueing appropriate updates.
   *
   * store: str
   * how: an `update` object, as expected by `React.addons.update`
   */
  update(store, how) {
    const updates = getUpdates(store, how)
    this.stores[store] = React.addons.update(this.stores[store], how)
    this._enqueueUpdates(updates)
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
      this.stores[name] = init()
    }
    for (let actions in listeners) {
      for (let event in listeners[actions]) {
        this.registerActionListener(actions, event, this._handleAction.bind(this, name, listeners[actions][event]))
      }
    }
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
    const data = {}
    unsubShape(shape, this.stores, this.listentree, data, listeners)
    return data
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
    let res = this.actions[actions][event].apply(null, args)
    if (!res || !res.then || !res.catch) {
      return this._emit(actions, event, res)
    }
    const tid = parseInt(Math.random() * 100000)
    // TODO optimistic update
    res.then(val => this._emit(actions, event, val, tid, 'done'))
      .catch(err => this._emit(actions, event, err, tid, 'error'))
  }

  _sendUpdates() {
    console.log('Updating', this.updating)
    const updated = new Set()
    for (let update of this.updating.values()) {
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
    this.updating = null
  }

  _emit(actions, event, val, tid, tstatus) {
    // console.log('emit', actions, event, val, tid, tstatus)
    if (!this.actionListeners[actions]) return
    if (!this.actionListeners[actions][event]) return
    if (arguments.length === 3) {
      return this.actionListeners[actions][event].forEach(fn => fn(val))
    }
    this.actionListeners[actions][event].forEach(fn => fn(val, tid, tstatus))
  }

  _enqueueUpdates(updates) {
    if (!this.updating) {
      this.raf()
      this.updating = new Set()
    }
    updates.forEach(update => this.updating.add(update.join(SEP)))
  }

  _handleAction(store, fn, val, tid, tstatus) {
    console.log('> action', store, val, tid, tstatus)
    if (arguments.length === 3) {
      fn(val, this.update.bind(this, store), this.stores[store])
    } else {
      if ('function' === typeof fn && tstatus === 'done') {
        fn(val, this.update.bind(this, store), this.stores[store])
      } else if (fn[tstatus]) {
        fn[tstatus](tid, val, this.update.bind(this, store), this.stores[store])
      }
    }
  }

  // TODO is requestAnimationFrame better for this, or do I just want "batch
  // sync ops"?
  raf() {
    if (typeof window !== 'undefined' && window.setImmediate) {
      window.setImmediate(this._sendUpdates)
    } else {
      setTimeout(this._sendUpdates, 0)
    }
    // window.requestAnimationFrame(this._sendUpdates)
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

const SEP = '\ufdd0'

