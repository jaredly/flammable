
import React from 'react'

const PT = React.PropTypes

export default class FluxTop extends React.Component {
  static childContextTypes = {
    flux: PT.object,
  }

  getChildContext() {
    return {flux: this.props.flux}
  }

  render() {
    return this.props.children
  }
}

