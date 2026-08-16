import test from 'node:test';
import assert from 'node:assert/strict';
import { roleFromStaffLabel, staffRoleLabels } from '@atletica-incinera/intereng-contract/rules';
import { demoUsers, seedStaff } from '@atletica-incinera/intereng-contract/seed';

test('cada rótulo de convite vira o papel que a sessão carrega', () => {
  assert.equal(roleFromStaffLabel('Admin da edição'), 'EDITION_ADMIN');
  assert.equal(roleFromStaffLabel('Gestor de modalidade'), 'DISCIPLINE_MANAGER');
});

test('nenhum convite concede super admin', () => {
  assert.equal(staffRoleLabels.some((label) => roleFromStaffLabel(label) === 'SUPER_ADMIN'), false);
});

test('rótulo ausente ou desconhecido cai no papel mais restrito', () => {
  assert.equal(roleFromStaffLabel(undefined), 'DISCIPLINE_MANAGER');
  assert.equal(roleFromStaffLabel('Dono do ginásio'), 'DISCIPLINE_MANAGER');
});

test('o staff da edição de exemplo só usa rótulos que o contrato traduz', () => {
  for (const member of Object.values(seedStaff)) {
    assert.equal(staffRoleLabels.includes(member.role), true, `${member.role} não é um rótulo de convite`);
  }
});

test('os acessos de demonstração cobrem os três papéis da sessão', () => {
  assert.deepEqual([...new Set(demoUsers.map((user) => user.role))].sort(), ['DISCIPLINE_MANAGER', 'EDITION_ADMIN', 'SUPER_ADMIN']);
  // Gestor sem escopo entra e não consegue operar modalidade nenhuma.
  assert.equal(demoUsers.every((user) => user.role !== 'DISCIPLINE_MANAGER' || Boolean(user.scope)), true);
});
