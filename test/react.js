
import React from 'react'
// import Flux from '../react'
import {Flux, fluxify, FluxTop} from '../react'

const flux = new Flux()

flux.addStore('mystore', () => ({name: 'jared'}), {
  myactions: {
    nameChange(val, update) {
      update({name: {$set: val}})
    }
  }
})

flux.addActions('myactions', {
  nameChange(newName) {
    return newName
  }
})

@fluxify({
  data: {
    mystore: {name: 'name'}
  },
  actions: {
    onChange: ['myactions.changeName', 'julie']
  }
})
class App extends React.Component {
  render() {
    return <div>
      {this.props.name}
      <button onClick={this.props.onChange}>Change the Name</button>
    </div>
  }
}

console.log(
  React.renderToString(<App flux={flux}/>))

