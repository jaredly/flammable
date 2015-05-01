
import React from 'react'
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
    onChange: 'myactions.nameChange',
  }
})
class Thing extends React.Component {
  render() {
    return <div>
      {this.props.name}
      <button onClick={() => this.props.onChange(this.props.name + '+')}>Change the Name</button>
    </div>
  }
}

@fluxify({})
class App extends React.Component {
  render() {
    return <div>
      <h1>Hitlabs Image Facer</h1>
      <ul>
        {[1,2,3].map(name =>
          <li key={name}>
            <Thing
              key={name}
              name={name}/>
          </li>)}
      </ul>
    </div>
  }
}

var div = document.createElement('div')
document.body.appendChild(div)
React.render(flux.wrap(<App/>), div)

