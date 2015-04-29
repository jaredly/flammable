
import React from 'react/addons'
import {crawlShape, walkShape, walkTree, diffShape} from './utils'

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

export default class Flux {
  constructor() {
    this.sendUpdates = this.sendUpdates.bind(this)
    this.listentree = {}
    this.actionListeners = {}
    this.stores = {}
    this.actions = {}
  }

  update(store, how) {
    const updates = getUpdates(store, how)
    this.stores[store] = React.addons.update(this.stores[store], how)
    this.enqueueUpdates(updates)
  }

  addStore(name, init, listeners) {
    this.stores[name] = init()
    for (let actions in listeners) {
      for (let event in listeners[actions]) {
        this.onAction(actions, event, this.handleAction.bind(this, name, listeners[actions][event]))
      }
    }
  }

  addActions(name, actions) {
    this.actions[name] = actions
  }

  handleAction(store, fn, val, tid, tstatus) {
    if (arguments.length === 3) {
      fn(val, this.update.bind(this, store), this.stores[store])
    } else {
      if (fn[tstatus]) {
        fn[tstatus](tid, val, this.update.bind(this, store), this.stores[store])
      }
    }
  }

  subscribe(shape, listener) {
    const data = {}
    crawlShape(shape, this.stores, this.listentree, data, listener)
    return data
  }

  diffscribe(prev, shape, listener) {
    const data = {}
    diffShape(prev, shape, this.stores, this.listentree, data, listener)
    return data
  }

  sendUpdates() {
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

  onAction(actions, event, fn) {
    if (!this.actionListeners[actions]) {
      return this.actionListeners[actions] = {[event]: [fn]}
    }
    if (!this.actionListeners[actions][event]) {
      return this.actionListeners[actions][event] = [fn]
    }
    this.actionListeners[actions][event].push(fn)
  }

  emit(actions, event, val, tid, tstatus) {
    if (!this.actionListeners[actions]) return
    if (!this.actionListeners[actions][event]) return
    if (arguments.length === 3) {
      return this.actionListeners[actions][event].forEach(fn => fn(val))
    }
    this.actionListeners[actions][event].forEach(fn => fn(val, tid, tstatus))
  }

  sendAction(action, ...args) {
    if (Array.isArray(action)) {
      args = action.slice(1).concat(args)
      action = action[0]
    }
    const [actions, event] = action.split('.')
    let res = this.actions[actions][event].apply(null, args)
    if (!res || !res.then || !res.catch) {
      return this.emit(actions, event, res)
    }
    // TODO optimistic update
    res.then(val => this.emit(actions, event, val, 'done'))
      .catch(err => this.emit(actions, event, err, 'error'))
  }

  enqueueUpdates(updates) {
    if (!this.updating) {
      this.raf()
      this.updating = new Set()
    }
    updates.forEach(update => this.updating.add(update.join(SEP)))
  }

  /*
  onUpdate(subscription, callee) {
    let evt = ''
    for (let i=0; i<subscription.length; i++) {
      evt += subscription[i]
      this.prefixes[evt] = callee
      evt += SEP
    }
  }
  */

  off(evt, name) {
    return this.removeListener(evt, name)
  }

  raf() {
    if (typeof window !== 'undefined' && window.setImmediate) {
      window.setImmediate(this.sendUpdates)
    } else {
      setTimeout(this.sendUpdates, 0)
    }
    // window.requestAnimationFrame(this.sendUpdates)
  }
}

