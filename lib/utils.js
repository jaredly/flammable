
export {subShape, unsubShape, walkShape, walkTree, diffShape}

function subShape(shape, obj, listentree, result, fn) {
  Object.keys(shape).forEach(name => {
    if (!listentree[name]) {
      listentree[name] = {}
    }
    if ('string' === typeof shape[name]) {
      result[shape[name]] = obj ? obj[name] : null
      if (!listentree[name].$listeners) {
        listentree[name].$listeners = new Set([fn[shape[name]]])
      } else {
        listentree[name].$listeners.add(fn[shape[name]])
      }
    } else {
      subShape(shape[name], obj ? obj[name] : null, listentree[name], result, fn)
    }
  })
}

function unsubShape(shape, obj, listentree, fn) {
  Object.keys(shape).forEach(name => {
    if (!listentree[name]) {
      return
    }
    if ('string' === typeof shape[name]) {
      if (listentree[name].$listeners) {
        listentree[name].$listeners.delete(fn[shape[name]])
      }
    } else {
      unsubShape(shape[name], obj ? obj[name] : null, listentree[name], fn)
    }
  })
}

function walkShape(shape, other, obj, listentree, fn) {
  Object.keys(shape).forEach(name => {
    if (!listentree[name]) {
      listentree[name] = {}
    }
    if ('string' === typeof shape[name]) {
      if (!listentree[name].$listeners) {
        listentree[name].$listeners = new Set()
      }
      fn(shape[name],
         other ? other[name] : null,
         obj ? obj[name] : null,
         listentree[name].$listeners)
    } else {
      walkShape(shape[name],
                other ? other[name] : null,
                obj ? obj[name] : null,
                listentree[name], fn)
    }
  })
}

function diffShape(prev, shape, obj, listentree, result, fn) {
  walkShape(prev, shape, obj, listentree, (attr, other, data, listeners) => {
    if (!other) {
      listeners.delete(fn[attr])
    }
  })

  walkShape(shape, prev, obj, listentree, (attr, other, data, listeners) => {
    if (!other) {
      if (!fn[attr]) {
        throw new Error(`no handler for ${attr}`)
      }
      listeners.add(fn[attr])
      result[attr] = data
    }
  })
}

function walkTree(tree, obj, updated) {
  Object.keys(tree).forEach(name => {
    if (name === '$listeners') return
    const val = obj ? obj[name] : null
    if (tree[name].$listeners) {
      tree[name].$listeners.forEach(fn => {
        if (updated.has(fn)) return
        updated.add(fn)
        fn(val)
      })
    }
    walkTree(tree[name], val, updated)
  })
}

