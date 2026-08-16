import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthError, sessionDurationMs, sessionFromLogin } from '../../app/lib/repositories/auth-adapter.ts';

/**
 * O tradutor entre a resposta de login/renovação e a sessão que o app guarda.
 * É função pura: não precisa de navegador, de storage nem de servidor.
 */

test('aceita o formato do mock do contrato: token e user', () => {
  const session = sessionFromLogin({ token: 'abc', expiresAt: '2026-10-20T12:00:00.000Z', user: { email: 'ana@ufpe.br', name: 'Ana Coordenadora', role: 'EDITION_ADMIN' } }, false);

  assert.equal(session.token, 'abc');
  assert.equal(session.email, 'ana@ufpe.br');
  assert.equal(session.role, 'EDITION_ADMIN');
  assert.equal(session.expiresAt, '2026-10-20T12:00:00.000Z');
});

test('aceita o formato da API: accessToken e staff', () => {
  const session = sessionFromLogin({ accessToken: 'xyz', refreshToken: 'renova', staff: { email: 'bruno@ufpe.br', name: 'Bruno Gestor', role: 'DISCIPLINE_MANAGER', scope: 'Futsal' } }, true);

  assert.equal(session.token, 'xyz');
  assert.equal(session.refreshToken, 'renova');
  assert.equal(session.role, 'DISCIPLINE_MANAGER');
  assert.equal(session.scope, 'Futsal');
  assert.equal(session.remembered, true);
});

test('token e user vencem accessToken e staff quando os dois vêm juntos', () => {
  const session = sessionFromLogin({
    token: 'do-contrato',
    accessToken: 'da-api',
    user: { email: 'ana@ufpe.br', name: 'Ana', role: 'EDITION_ADMIN' },
    staff: { email: 'outro@ufpe.br', name: 'Outro', role: 'DISCIPLINE_MANAGER' },
  }, false);

  assert.equal(session.token, 'do-contrato');
  assert.equal(session.email, 'ana@ufpe.br');
});

test('expiresIn em segundos vira o instante em que o acesso vence', () => {
  const antes = Date.now();
  const session = sessionFromLogin({ accessToken: 'xyz', expiresIn: 900, staff: { email: 'ana@ufpe.br', name: 'Ana', role: 'EDITION_ADMIN' } }, false);
  const acesso = Date.parse(session.accessExpiresAt ?? '');

  assert.ok(acesso >= antes + 900_000, 'o prazo do acesso precisa ser absoluto, não a duração');
  assert.ok(acesso <= Date.now() + 900_000);
});

test('accessExpiresAt informado dispensa a conversão de expiresIn', () => {
  const session = sessionFromLogin({ accessToken: 'xyz', expiresIn: 900, accessExpiresAt: '2026-10-20T12:15:00.000Z', staff: { email: 'ana@ufpe.br', name: 'Ana', role: 'EDITION_ADMIN' } }, false);

  assert.equal(session.accessExpiresAt, '2026-10-20T12:15:00.000Z');
});

test('sem prazo informado, a sessão dura o horizonte do app e o acesso fica sem prazo próprio', () => {
  // São dois horizontes diferentes: o do acesso é curto e renovável; o da
  // sessão é o que decide se ainda dá para continuar sem novo login.
  const antes = Date.now();
  const session = sessionFromLogin({ token: 'abc', user: { email: 'ana@ufpe.br', name: 'Ana', role: 'EDITION_ADMIN' } }, false);

  assert.equal(session.accessExpiresAt, undefined);
  assert.ok(Date.parse(session.expiresAt) >= antes + sessionDurationMs);
});

test('recusa entrar sem token de acesso', () => {
  assert.throws(
    () => sessionFromLogin({ user: { email: 'ana@ufpe.br', name: 'Ana', role: 'EDITION_ADMIN' } }, false),
    (caught: unknown) => caught instanceof AuthError && /token de acesso/i.test(caught.message),
  );
});

test('recusa entrar sem papel em vez de adivinhar um', () => {
  // Decisão de segurança: na API o papel é por edição, e a guarda de navegação
  // decide a rota antes de qualquer snapshot carregar. Chutar aqui seria
  // conceder acesso que o servidor vai negar depois.
  assert.throws(
    () => sessionFromLogin({ token: 'abc', staff: { email: 'ana@ufpe.br', name: 'Ana' } }, false),
    (caught: unknown) => caught instanceof AuthError && /papel do usuário/i.test(caught.message),
  );
});

test('recusa entrar sem nenhum dado de usuário', () => {
  assert.throws(
    () => sessionFromLogin({ token: 'abc' }, false),
    (caught: unknown) => caught instanceof AuthError && /papel do usuário/i.test(caught.message),
  );
});

test('o corpo vazio para no token, antes de perguntar pelo papel', () => {
  assert.throws(
    () => sessionFromLogin({}, false),
    (caught: unknown) => caught instanceof AuthError && /token de acesso/i.test(caught.message),
  );
});
