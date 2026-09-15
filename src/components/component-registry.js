/**
 * Cross-Component Registry
 * Provides a decoupled way for components to access each other without
 * leaking instances onto the global `window` object.
 */

const registry = new Map();

export function registerComponent(name, instance) {
  registry.set(name, instance);
}

export function unregisterComponent(name) {
  registry.delete(name);
}

export function getComponent(name) {
  return registry.get(name) ?? null;
}

export function hasComponent(name) {
  return registry.has(name);
}