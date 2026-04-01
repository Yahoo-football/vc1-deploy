const toFiniteCoordinate = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const buildDestinationText = (location = {}) => {
  return [
    location.name,
    location.address,
    location.city,
    location.province,
    location.country
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
};

export const buildGoogleMapsLocationUrl = (location = {}) => {
  const latitude = toFiniteCoordinate(location.latitude);
  const longitude = toFiniteCoordinate(location.longitude);

  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');

  if (latitude !== null && longitude !== null) {
    url.searchParams.set('query', `${latitude},${longitude}`);
    return url.toString();
  }

  const destinationText = buildDestinationText(location);
  if (!destinationText) return null;

  url.searchParams.set('query', destinationText);
  return url.toString();
};

export const buildLocationLabel = (location = {}) => {
  return [location.address, location.city, location.province, location.country]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
};
