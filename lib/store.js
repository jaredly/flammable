
import React from 'react'

export default class Store {
  constructor(flux) {
    this.flux = flux
    this.listen(flux)
    this.update = this.update.bind(this)
  }

  listen(flux) {
    if (!this.listeners) return
    for (let actions in this.listeners) {
      for (let event in this.listeners[actions]) {
        flux.onAction(actions, event, this.onAction.bind(this, actions, event))
      }
    }
  }

  // update({count: {$set: 5}})
  update(how) {
    const updates = getUpdates(how)
    this.state = React.addons.update(this.state, how)
    this.flux.enqueueUpdates(updates)
  }

  onAction(actions, event, value, tid, tstatus) {
    if (arguments.length === 3) {
      this.listeners[actions][event].call(null, value, this.update, this.state)
    } else {
      this.listeners[actions][event][tstatus].call(null, tid, value, this.update, this.state)
    }
  }
}

