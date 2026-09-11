'use strict';

export function locationKey(item) {
  if (item?.id !== undefined && item?.id !== null) return String(item.id);
  return `${Number(item?.latitude).toFixed(4)}:${Number(item?.longitude).toFixed(4)}`;
}

export function sameLocation(first, second) {
  return locationKey(first) === locationKey(second);
}

export function withLocation(collection, item) {
  const index = collection.findIndex(location => sameLocation(location, item));
  if (index < 0) return [...collection, item];
  return collection.map((location, locationIndex) => locationIndex === index ? item : location);
}

export function replacingLocation(collection, current, replacement) {
  const currentIndex = collection.findIndex(item => sameLocation(item, current));
  const replacementIndex = collection.findIndex(item => sameLocation(item, replacement));
  if (currentIndex < 0) return withLocation(collection, replacement);
  return collection
    .map((item, index) => index === currentIndex ? replacement : item)
    .filter((item, index) => index === currentIndex || index !== replacementIndex);
}
