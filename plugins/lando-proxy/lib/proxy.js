/**
 * This does the proxying
 *
 * @name proxy
 */

'use strict';

// Modules
var _ = require('lodash');
var url = require('url');

/*
 * Helper to extract ports from inspect data
 */
exports.pp = function(data, preferredHttp, preferredHttps) {

  // Paths
  var httpPath = 'NetworkSettings.Ports.80/tcp[0].HostPort';
  var httpsPath = 'NetworkSettings.Ports.443/tcp[0].HostPort';

  // Return
  return {
    http: _.get(data, httpPath, preferredHttp),
    https: _.get(data, httpsPath, preferredHttps)
  };

};

/*
 * Returns the proxy compose object
 */
exports.compose = function(file, project) {
  return {
    compose: [file],
    project: project,
    opts: {
      services: ['proxy']
    }
  };
};

/*
 * Create the proxy service object
 */
exports.build = function(domain, proxyDash, http, https) {

  // Get some stuff for our things
  var certs = ['/certs/cert.crt', '/certs/cert.key'].join(',');
  var cmd = [
    '/entrypoint.sh',
    '--defaultEntryPoints=https,http',
    '--docker',
    '--docker.domain=' + domain,
    '--entryPoints="Name:http Address::80"',
    '--entrypoints="Name:https Address::443 TLS:' + certs + '"',
    '--logLevel=DEBUG',
    '--web',
  ].join(' ');

  // Proxy service
  var proxy = {
    image: 'traefik:1.3-alpine',
    entrypoint: '/lando-entrypoint.sh',
    command: cmd,
    labels: {
      'io.lando.container': 'TRUE',
      'io.lando.service-container': 'TRUE'
    },
    environment: {
      LANDO_SERVICE_TYPE: 'proxy'
    },
    networks: ['edge'],
    ports: [
      [http, '80'].join(':'),
      [https, '443'].join(':'),
      [proxyDash, 8080].join(':')
    ],
    volumes: [
      '/var/run/docker.sock:/var/run/docker.sock',
      '/dev/null:/traefik.toml',
      '$LANDO_ENGINE_SCRIPTS_DIR/lando-entrypoint.sh:/lando-entrypoint.sh',
      '$LANDO_ENGINE_SCRIPTS_DIR/add-cert.sh:/scripts/add-cert.sh'
    ],
    restart: 'on-failure'
  };

  // Get the new proxy service
  return {
    version: '3.2',
    services: {proxy: proxy},
    networks: {edge: {driver: 'bridge'}}
  };

};

/*
 * Create the proxy service object
 */
exports.getUrls = function(hosts, secure, suffix) {

  // Protocol
  var protocol = (secure) ? 'https://' : 'http://';

  // Collect all urls to scan
  return _.map(hosts, function(port) {
    return protocol + [suffix, port].join(':');
  });

};

/*
 * Get the available port from scanned urls
 */
exports.getPort = function(data) {

  // Get the first available URL
  var u = _.first(_.filter(data, function(datum) {
    return datum.status === false;
  }));

  // Return port
  return url.parse(u.url).port;

};
