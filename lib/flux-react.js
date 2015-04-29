
import React from 'react'
import FluxTop from './flux-top'
import Flux from './flux'

export default class FluxReact extends Flux {
  wrap(app) {
    return <FluxTop flux={this}>{app}</FluxTop>
  }
}

