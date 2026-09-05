import { describe, expect, it } from 'vitest';
import { allDisciplinesOption, resolveSelectedDiscipline } from '../../app/components/DisciplineSelector';

describe('resolveSelectedDiscipline', () => {
  const optionsWithAll = [allDisciplinesOption, 'Basquete', 'Futsal', 'Vôlei'];
  const optionsWithoutAll = ['Handebol'];

  it('retorna a modalidade requisitada quando ela está presente nas opções', () => {
    expect(resolveSelectedDiscipline(optionsWithAll, 'Vôlei', 'Futsal')).toBe('Vôlei');
    expect(resolveSelectedDiscipline(optionsWithAll, 'Basquete', 'Futsal')).toBe('Basquete');
  });

  it('retorna "Todas as modalidades" por padrão quando a opção está disponível e não há filtro requisitado', () => {
    // Mesmo que o usuário tenha uma preferência salva (ex: Futsal), abrir a tela geral de jogos sem parâmetro seleciona "Todas as modalidades"
    expect(resolveSelectedDiscipline(optionsWithAll, '', 'Futsal')).toBe(allDisciplinesOption);
    expect(resolveSelectedDiscipline(optionsWithAll, '', undefined)).toBe(allDisciplinesOption);
  });

  it('respeita o escopo do gestor quando "Todas as modalidades" não está nas opções', () => {
    expect(resolveSelectedDiscipline(optionsWithoutAll, '', 'Futsal', 'Handebol')).toBe('Handebol');
  });

  it('recorre à primeira opção se nada for correspondido', () => {
    expect(resolveSelectedDiscipline(['Tênis de Mesa'], 'Inexistente')).toBe('Tênis de Mesa');
  });
});
