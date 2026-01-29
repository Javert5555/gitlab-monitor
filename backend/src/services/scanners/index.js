const semgrepScanner = require('./semgrepScanner');
const checkovScanner = require('./checkovScanner');
const gitleaksScanner = require('./gitleaksScanner');
const trivyScanner = require('./trivyScanner');
const trivyDockerScanner = require('./trivyDockerScanner');

module.exports = {
  semgrepScanner,
  checkovScanner,
  gitleaksScanner,
  trivyScanner,
  trivyDockerScanner
};