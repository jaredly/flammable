
import expect from 'expect.js'
import * as utils from '../lib/utils'


describe('utils', () => {
  let shape, obj, listentree, result, fn, morefn
  beforeEach(() => {
    shape = {
      one: {
        two: {
          three: 'four'
        }
      }
    }
    obj = {
      one: {
        two: {
          three: 4
        }
      }
    }
    listentree = {}
    result = {}
    fn = {
      four: () => 'four'
    }
  })

  it('subShape normal', () => {

    utils.subShape(shape, obj, listentree, result, fn)

    expect(unset(listentree)).to.eql(unset({one: {two: {three: {
            $listeners: new Set([fn.four])
    }}}}))
    expect(result).to.eql({four: 4})

  })

  it('subShape idempotent', () => {
    utils.subShape(shape, obj, listentree, result, fn)
    utils.subShape(shape, obj, listentree, result, fn)

    expect(unset(listentree)).to.eql(unset({one: {two: {three: {
            $listeners: new Set([fn.four])
    }}}}))
    expect(result).to.eql({four: 4})
  })

  it('sub twice', () => {

    utils.subShape(shape, obj, listentree, result, fn)

    let morefn = {
      four: () => 'more'
    }
    utils.subShape(shape, obj, listentree, result, morefn)

    expect(unset(listentree)).to.eql(unset({one: {two: {three: {
            $listeners: new Set([fn.four, morefn.four])
    }}}}))
    expect(result).to.eql({four: 4})
  })

  it('unsubShape', () => {
    utils.subShape(shape, obj, listentree, result, fn)

    let morefn = {
      four: () => 'more'
    }
    utils.subShape(shape, obj, listentree, result, morefn)

    utils.unsubShape(shape, obj, listentree, morefn)

    expect(listentree).to.eql({one: {two: {three: {
            $listeners: new Set([fn.four])
    }}}})
  })

  it('diffShape', () => {
    const shape = {
      one: 'two',
      three: {
        four: 'five'
      }
    }
    const shape2 = {
      one: 'two',
      three: {
        seven: 's7'
      }
    }
    const shape3 = {
      three: {
        four: 'six'
      }
    }
    const fns = {
      two: () => 'two',
      five: () => 'five',
      six: () => 'six',
      s7: () => 's7',
    }
    const obj = {
      one: 2,
      three: {
        four: 10,
        seven: 8
      }
    }
    let result = {}
    utils.subShape(shape, obj, listentree, result, fns)
    expect(result).to.eql({
      two: 2,
      five: 10,
    })

    expect(unset(listentree)).to.eql(unset({
      one: {
        $listeners: new Set([fns.two])
      },
      three: {
        four: {
          $listeners: new Set([fns.five])
        }
      }
    }))

    result = {}
    utils.diffShape(shape, shape2, obj, listentree, result, fns)
    expect(result).to.eql({
      s7: 8
    })

    expect(unset(listentree)).to.eql(unset({
      one: {
        $listeners: new Set([fns.two])
      },
      three: {
        four: {
          $listeners: new Set([])
        },
        seven: {
          $listeners: new Set([fns.s7])
        }
      }
    }))

  })

})

function unset(obj) {
  let res = {}
  for (let name in obj) {
    if (obj[name] instanceof Set) {
      res[name] = {}
      for (let item of obj[name]) {
        res[name][item + ''] = item
      }
    } else if ('object' === typeof obj[name]) {
      res[name] = unset(obj[name])
    } else {
      res[name] = obj[name]
    }
  }
  return res
}

