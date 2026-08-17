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

/**
 * Multi-escopo: na API o papel é por edição, e quem os lista é `GET /auth/me`.
 * O adaptador HTTP junta as duas respostas antes de chegar aqui.
 */

test('os papéis por edição viram a lista de acessos da sessão', () => {
  const session = sessionFromLogin({
    accessToken: 'xyz',
    staff: { email: 'ana@ufpe.br', name: 'Ana Coordenadora' },
    editionRoles: [
      { editionId: 'intereng-2026', editionName: 'InterEng 2026', disciplineId: 'futsal', disciplineName: 'Futsal', role: 'DISCIPLINE_MANAGER' },
      { editionId: 'intereng-2025', editionName: 'InterEng 2025', disciplineId: null, disciplineName: null, role: 'EDITION_ADMIN' },
    ],
  }, false);

  assert.equal(session.scopes?.length, 2);
  // O mais amplo primeiro: entrar com menos acesso do que se tem é surpresa
  // maior do que entrar com o de sempre.
  assert.equal(session.role, 'EDITION_ADMIN');
  assert.equal(session.scope, 'InterEng 2025');
  assert.equal(session.activeScopeId, session.scopes?.[0].id);
  assert.deepEqual(session.scopes?.map((scope) => scope.role), ['EDITION_ADMIN', 'DISCIPLINE_MANAGER']);
});

test('o gestor leva o nome da modalidade, que é por onde as telas comparam', () => {
  const session = sessionFromLogin({
    accessToken: 'xyz',
    staff: { email: 'bruno@ufpe.br', name: 'Bruno Martins' },
    editionRoles: [{ editionId: 'intereng-2026', editionName: 'InterEng 2026', disciplineId: 'futsal', disciplineName: 'Futsal', role: 'DISCIPLINE_MANAGER' }],
  }, false);

  assert.equal(session.role, 'DISCIPLINE_MANAGER');
  assert.equal(session.scope, 'Futsal');
  assert.equal(session.scopes?.[0].disciplineId, 'futsal');
});

test('super admin é um acesso à parte, e não aparece em editionRoles', () => {
  const session = sessionFromLogin({
    accessToken: 'xyz',
    staff: { email: 'super@intereng.com', name: 'Super Admin', isSuperAdmin: true },
    editionRoles: [{ editionId: 'intereng-2026', editionName: 'InterEng 2026', disciplineId: 'futsal', disciplineName: 'Futsal', role: 'DISCIPLINE_MANAGER' }],
  }, false);

  assert.equal(session.role, 'SUPER_ADMIN');
  assert.deepEqual(session.scopes?.map((scope) => scope.role), ['SUPER_ADMIN', 'DISCIPLINE_MANAGER']);
});

test('o mesmo papel repetido não vira dois acessos', () => {
  // A API devolve uma linha por registro de staff, e nada impede duas linhas
  // iguais. Duas entradas idênticas no seletor não significariam nada.
  const session = sessionFromLogin({
    accessToken: 'xyz',
    staff: { email: 'bruno@ufpe.br', name: 'Bruno' },
    editionRoles: [
      { editionId: 'intereng-2026', editionName: 'InterEng 2026', disciplineId: 'futsal', disciplineName: 'Futsal', role: 'DISCIPLINE_MANAGER' },
      { editionId: 'intereng-2026', editionName: 'InterEng 2026', disciplineId: 'futsal', disciplineName: 'Futsal', role: 'DISCIPLINE_MANAGER' },
    ],
  }, false);

  assert.equal(session.scopes?.length, 1);
});

test('duas modalidades na mesma edição são dois acessos distintos', () => {
  const session = sessionFromLogin({
    accessToken: 'xyz',
    staff: { email: 'bruno@ufpe.br', name: 'Bruno' },
    editionRoles: [
      { editionId: 'intereng-2026', editionName: 'InterEng 2026', disciplineId: 'futsal', disciplineName: 'Futsal', role: 'DISCIPLINE_MANAGER' },
      { editionId: 'intereng-2026', editionName: 'InterEng 2026', disciplineId: 'volei', disciplineName: 'Vôlei', role: 'DISCIPLINE_MANAGER' },
    ],
  }, false);

  assert.equal(session.scopes?.length, 2);
  assert.notEqual(session.scopes?.[0].id, session.scopes?.[1].id);
});

test('conta sem papel em nenhuma edição não entra', () => {
  // É o caso de quem tem login mas nenhum registro em edition_staff_roles: a
  // guarda de navegação decide a rota antes de qualquer dado carregar.
  assert.throws(
    () => sessionFromLogin({ accessToken: 'xyz', staff: { email: 'ninguem@ufpe.br', name: 'Ninguém' }, editionRoles: [] }, false),
    (caught: unknown) => caught instanceof AuthError && /papel do usuário/i.test(caught.message),
  );
});

test('a renovação preserva a lista de acessos que o login montou', () => {
  // `runRenewal` reinjeta a sessão guardada como `user`, e o corpo da renovação
  // não traz papel nenhum. Sem preservar, renovar rebaixaria quem tem dois
  // acessos ao único que o login devolve — nenhum.
  const guardada = sessionFromLogin({
    accessToken: 'primeiro',
    staff: { email: 'ana@ufpe.br', name: 'Ana' },
    editionRoles: [
      { editionId: 'intereng-2025', editionName: 'InterEng 2025', disciplineId: null, disciplineName: null, role: 'EDITION_ADMIN' },
      { editionId: 'intereng-2026', editionName: 'InterEng 2026', disciplineId: 'futsal', disciplineName: 'Futsal', role: 'DISCIPLINE_MANAGER' },
    ],
  }, true);

  const renovada = sessionFromLogin({ accessToken: 'segundo', user: guardada, staff: { email: 'ana@ufpe.br', name: 'Ana' } }, true);

  assert.equal(renovada.token, 'segundo');
  assert.deepEqual(renovada.scopes?.map((scope) => scope.id), guardada.scopes?.map((scope) => scope.id));
});
