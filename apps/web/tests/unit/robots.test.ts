import assert from 'node:assert/strict';
import { test } from 'node:test';

import { construirRobots } from '../../app/robots.ts';

test('robots libera a area publica do InterEng e aponta para o sitemap', () => {
  const robots = construirRobots('/intereng');
  const rules = robots.rules as {
    userAgent?: string;
    allow?: string[];
    disallow?: string[];
  };

  assert.equal(rules.userAgent, '*');
  assert.deepEqual(rules.allow, ['/intereng/', '/intereng/public/']);
  assert.ok(rules.disallow?.includes('/intereng/login/'));
  assert.ok(rules.disallow?.includes('/intereng/dashboard/'));
  assert.equal(robots.sitemap, 'https://incinera.cin.ufpe.br/intereng/sitemap.xml');
  assert.equal(robots.host, 'https://incinera.cin.ufpe.br');
});

test('robots acompanha ambientes sem basePath', () => {
  const robots = construirRobots('');
  const rules = robots.rules as {
    allow?: string[];
    disallow?: string[];
  };

  assert.deepEqual(rules.allow, ['/', '/public/']);
  assert.ok(rules.disallow?.includes('/login/'));
  assert.equal(robots.sitemap, 'https://incinera.cin.ufpe.br/sitemap.xml');
});
