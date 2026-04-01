const path = require('path');
const serverConfig = require('../config/serverConfig');

const getBackendRoot = () => path.resolve(__dirname, '..', '..');

const getPublicRoot = () => path.join(getBackendRoot(), 'public');

const getPublicAssetPath = (...segments) => path.join(getPublicRoot(), ...segments);

const getUploadRoot = () => {
  const configuredDestination = String(serverConfig.upload.destination || 'uploads').replace(/[\\/]+$/, '');
  return path.resolve(getBackendRoot(), configuredDestination || 'uploads');
};

const getUploadDir = (...segments) => path.join(getUploadRoot(), ...segments);

const resolveManagedUploadPath = (assetPath = '') => {
  const normalizedPath = String(assetPath || '').trim();
  if (!normalizedPath.startsWith('/uploads/')) {
    return '';
  }

  const relativeSegments = normalizedPath
    .replace(/^\/uploads\//, '')
    .split('/')
    .filter(Boolean);

  return path.join(getUploadRoot(), ...relativeSegments);
};

module.exports = {
  getBackendRoot,
  getPublicRoot,
  getPublicAssetPath,
  getUploadRoot,
  getUploadDir,
  resolveManagedUploadPath
};