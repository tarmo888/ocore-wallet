'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var CliUtils = require('../bin/cli-utils');

describe('CliUtils', function() {
  describe('#parseMN', function() {
    it('should successfully parse m & n', function() {
      var texts = {
        '1-1': [1, 1],
        '1-of-1': [1, 1],
        '1of1': [1, 1],
        '1-OF-2': [1, 2],
        '1OF2': [1, 2],
        ' 2-2': [2, 2],
        '2-3 ': [2, 3],
        '10-10': [10, 10],
        '10-of-10': [10, 10],
      };
      _.each(texts, function(expected, text) {
        var result = CliUtils.parseMN(text);
        result.should.deep.equal(expected);
      });
    });
    it('should fail to parse incorrect m & n', function() {
      var texts = [
        '',
        ' ',
        '1',
        'x-1',
        '1-x',
        'of-1-1',
        '2-2-of',
        '1-1-1',
        ' 1_1 ',
        '2-1',
        '2-of-1',
        '-1-2',
        '1--2',
        'x-of-2',
      ];
      _.each(texts, function(text) {
        var valid = true;
        try {
          CliUtils.parseMN(text);
        } catch (e) {
          valid = false;
        }
        valid.should.be.false;
      });
    });
  });
});
