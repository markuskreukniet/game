export function createElement(element, parent) {
  const e = document.createElement(element)
  parent.appendChild(e)
  return e
}

export function createPxSize(size) {
  return `${size}px`
}
