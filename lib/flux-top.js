
import React from 'react/addons'

const PT = React.PropTypes

function walkChildren(children, extra) {
  if (React.Children.count(children) === 1) {
    return React.addons.cloneWithProps(children, extra,
        children && children.props &&
        children.props.children ?
          walkChildren(children.props.children, extra) :
          null)
  }
  return React.Children.map(children, child =>
    React.addons.cloneWithProps(child, extra,
        child && child.props &&
        child.props.children ?
          walkChildren(child.props.children, extra) :
          null))
}

export default class FluxTop extends React.Component {
  static childContextTypes = {
    flux: PT.object,
  }

  getChildContext() {
    return {flux: this.props.flux}
  }

  render() {
    const children = walkChildren(this.props.children, {flux: this.props.flux})
    if (React.Children.count(this.props.children) === 1) {
      return <span>hello{children}</span>
    }
    return <span>friends{children}</span>
  }
}

