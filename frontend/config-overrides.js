const webpack = require('webpack');

const override = function override(config, env) {
  // Add polyfills for Node.js modules in browser
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer"),
    "util": require.resolve("util"),
    "url": require.resolve("url"),
    "assert": require.resolve("assert"),
    "http": false,
    "https": false,
    "os": false,
    "zlib": false
  };

  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer'],
    })
  );

  // Fix for axios and other packages that expect process
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false,
    }
  });

  return config;
};

const overrideDevServer = function overrideDevServer(devServerConfig) {
  return function configuredDevServer(proxy, allowedHost) {
    const config = devServerConfig(proxy, allowedHost);
    config.client = config.client || {};
    config.client.overlay = {
      ...(config.client.overlay || {}),
      runtimeErrors: false
    };

    return config;
  };
};

module.exports = override;
module.exports.devServer = overrideDevServer;
