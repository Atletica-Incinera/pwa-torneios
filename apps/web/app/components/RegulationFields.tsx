'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { DisciplineRule } from '../lib/repositories/browser-repository';
import { describeCompletion, knockoutMethodLabels, regulationFromRule, tiebreakerLabels, type CompletionRule, type KnockoutMethod, type ScoringAction, type SecondaryAction, type TiebreakerId } from '../lib/regulation';
import { createId } from '../lib/create-id';

const tiebreakerOptions = Object.keys(tiebreakerLabels) as TiebreakerId[];

function slug(label: string) {
  return label.toLocaleLowerCase('pt-BR').replace(/\s+/g, '-') || createId('acao');
}

/**
 * Edição do regulamento esportivo da modalidade: pontuação por ação, condição
 * de encerramento, eventos válidos, elenco, tabela e desempate. É o que faz o
 * placar e a classificação se comportarem de acordo com cada esporte.
 */
export function RegulationFields({ discipline, rule, onChange }: { discipline: string; rule: DisciplineRule; onChange: (next: DisciplineRule) => void }) {
  const regulation = regulationFromRule(discipline, rule);
  const { completion, roster, standings, knockout, walkover } = regulation;

  function patch(next: Partial<DisciplineRule>) {
    onChange({ ...rule, ...next });
  }

  function setScoring(scoring: ScoringAction[]) {
    patch({ scoring, scoringEvent: scoring[0]?.label ?? rule.scoringEvent });
  }

  function setSecondary(secondary: SecondaryAction[]) {
    patch({ secondary, secondaryEvents: [secondary[0]?.label ?? '', secondary[1]?.label ?? ''] as [string, string] });
  }

  function setCompletion(next: CompletionRule) {
    patch({ completion: next });
  }

  function changeMode(mode: CompletionRule['mode']) {
    if (mode === 'sets') setCompletion({ mode, setsToWin: 3, pointsToWinSet: 25, pointsToWinDecidingSet: 15, minAdvantage: 2 });
    else if (mode === 'board') setCompletion({ mode, allowDraw: true, winPoints: 1, drawPoints: 0.5 });
    else if (mode === 'result') setCompletion({ mode, allowDraw: false });
    else setCompletion({ mode: 'periods', allowDraw: true, overtimePeriods: 0, overtimeDurationMinutes: 0 });
  }

  function moveTiebreaker(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= standings.tiebreakers.length) return;
    const tiebreakers = [...standings.tiebreakers];
    [tiebreakers[index], tiebreakers[target]] = [tiebreakers[target], tiebreakers[index]];
    patch({ standings: { ...standings, tiebreakers } });
  }

  return <>
    <div className="form-contract-note"><p><strong>{describeCompletion(regulation)}</strong><br />Estas regras valem para novos jogos da modalidade. Partidas já criadas mantêm o regulamento com que foram agendadas.</p></div>

    <fieldset className="regulation-group">
      <legend>Pontuação por ação</legend>
      <p className="form-hint">Cada botão do placar soma os pontos definidos aqui — é o que diferencia uma cesta de 3 de um gol.</p>
      {regulation.scoring.map((action, index) => (
        <div className="regulation-row" key={`${action.id}-${index}`}>
          <label><span>Ação</span><input value={action.label} onChange={(event) => setScoring(regulation.scoring.map((item, position) => position === index ? { ...item, label: event.target.value, id: slug(event.target.value) } : item))} /></label>
          <label><span>Pontos</span><input type="number" min="1" max="20" value={action.points} onChange={(event) => setScoring(regulation.scoring.map((item, position) => position === index ? { ...item, points: Math.max(1, Number(event.target.value)) } : item))} /></label>
          <button type="button" onClick={() => setScoring(regulation.scoring.filter((_, position) => position !== index))} disabled={regulation.scoring.length <= 1} aria-label={`Remover ${action.label}`}><Trash2 size={16} /></button>
        </div>
      ))}
      <button type="button" className="secondary-button" onClick={() => setScoring([...regulation.scoring, { id: `acao-${regulation.scoring.length + 1}`, label: 'Nova ação', points: 1 }])}><Plus size={16} /> Adicionar ação de placar</button>
    </fieldset>

    <fieldset className="regulation-group">
      <legend>Eventos válidos da partida</legend>
      <p className="form-hint">Só aparecem no placar da partida os eventos declarados aqui — falta, cartão, tempo técnico.</p>
      <p className="form-hint" id="peso-disciplinar-ajuda">
        <strong>Peso disciplinar</strong> é penalidade, não bonificação: cada registro do evento acumula esse valor <em>contra</em> a equipe, e quanto mais acumulado, pior a colocação. O que decide a tabela é a diferença de peso entre os eventos (falta 1, cartão 3); o mesmo peso em todos equivale a não ponderar. 0 = o evento não penaliza.
      </p>
      {regulation.secondary.map((action, index) => (
        <div className="regulation-event-row" key={`${action.id}-${index}`}>
          <div className="regulation-event-head">
            <label><span>Evento</span><input value={action.label} onChange={(event) => setSecondary(regulation.secondary.map((item, position) => position === index ? { ...item, label: event.target.value, id: slug(event.target.value) } : item))} /></label>
            <button type="button" className="regulation-event-remove" onClick={() => setSecondary(regulation.secondary.filter((_, position) => position !== index))} aria-label={`Remover ${action.label}`} title="Remover evento"><Trash2 size={16} aria-hidden="true" /></button>
          </div>
          <div className="checkbox-pair">
            {/* Desmarcar zera o peso junto: sem equipe atribuída o acumulador
                de fair play descarta o evento, e um valor guardado ali seria
                configuração que nunca surte efeito. */}
            <label className="checkbox-field"><input type="checkbox" checked={action.requiresSide} onChange={(event) => setSecondary(regulation.secondary.map((item, position) => position === index ? { ...item, requiresSide: event.target.checked, fairPlayPoints: event.target.checked ? item.fairPlayPoints : 0 } : item))} /><span>Registrar por equipe</span></label>
            <label className="checkbox-field"><input type="checkbox" checked={action.allowedWhenStopped} onChange={(event) => setSecondary(regulation.secondary.map((item, position) => position === index ? { ...item, allowedWhenStopped: event.target.checked } : item))} /><span>Vale com o cronômetro parado</span></label>
          </div>
          <label className="regulation-event-weight"><span>Peso disciplinar</span><input type="number" min="0" max="10" value={action.requiresSide ? action.fairPlayPoints : 0} onChange={(event) => setSecondary(regulation.secondary.map((item, position) => position === index ? { ...item, fairPlayPoints: Math.max(0, Number(event.target.value)) } : item))} disabled={!action.requiresSide} aria-describedby="peso-disciplinar-ajuda" /></label>
          {!action.requiresSide ? <small>Evento sem equipe: o placar mostra um botão neutro e não há a quem atribuir a penalidade.</small> : null}
        </div>
      ))}
      {/* Peso configurado sem o critério que o consome é trabalho perdido, e nada
          na tela dizia isso — no preset de Xadrez acontece de fábrica. */}
      {!standings.tiebreakers.includes('fair-play') && regulation.secondary.some((item) => item.requiresSide && item.fairPlayPoints > 0)
        ? <p className="form-feedback" role="status">Nenhum peso disciplinar será aplicado: &quot;Fair play&quot; não está na ordem de desempate do bloco Classificação.</p>
        : null}
      <button type="button" className="secondary-button" onClick={() => setSecondary([...regulation.secondary, { id: `evento-${regulation.secondary.length + 1}`, label: 'Novo evento', requiresSide: true, allowedWhenStopped: true, scorePoints: 0, fairPlayPoints: 0 }])}><Plus size={16} aria-hidden="true" /> Adicionar evento</button>
    </fieldset>

    <fieldset className="regulation-group">
      <legend>Como a partida termina</legend>
      <label><span>Condição de encerramento</span><select value={completion.mode} onChange={(event) => changeMode(event.target.value as CompletionRule['mode'])}>
        <option value="periods">Por tempos / períodos</option>
        <option value="sets">Por sets</option>
        <option value="board">Resultado da mesa ou rodada</option>
        <option value="result">Resultado único da prova</option>
      </select></label>
      {completion.mode === 'periods' ? <>
        <label className="checkbox-field"><input type="checkbox" checked={completion.allowDraw} onChange={(event) => setCompletion({ ...completion, allowDraw: event.target.checked })} /><span>Permite terminar empatado</span></label>
        <p className="form-hint">Desligado, todo jogo empatado exige registrar um desempate ao encerrar — inclusive fora do mata-mata, onde o desempate é sempre obrigatório.</p>
        <div className="rule-fields two-columns">
          <label><span>Períodos de prorrogação</span><input type="number" min="0" max="5" value={completion.overtimePeriods} onChange={(event) => setCompletion({ ...completion, overtimePeriods: Math.max(0, Number(event.target.value)) })} /></label>
          <label><span>Minutos por prorrogação</span><input type="number" min="0" max="30" value={completion.overtimeDurationMinutes} onChange={(event) => setCompletion({ ...completion, overtimeDurationMinutes: Math.max(0, Number(event.target.value)) })} /></label>
        </div>
        <p className="form-hint">A prorrogação só entra em jogo quando o empate não é permitido: são as etapas extras que o mesário ganha no placar.</p>
      </> : null}
      {completion.mode === 'sets' ? <>
        <div className="rule-fields two-columns">
          <label><span>Sets para vencer</span><input type="number" min="1" max="5" value={completion.setsToWin} onChange={(event) => setCompletion({ ...completion, setsToWin: Math.max(1, Number(event.target.value)) })} /></label>
          <label><span>Pontos por set</span><input type="number" min="1" max="99" value={completion.pointsToWinSet} onChange={(event) => setCompletion({ ...completion, pointsToWinSet: Math.max(1, Number(event.target.value)) })} /></label>
          <label><span>Pontos no set decisivo</span><input type="number" min="1" max="99" value={completion.pointsToWinDecidingSet} onChange={(event) => setCompletion({ ...completion, pointsToWinDecidingSet: Math.max(1, Number(event.target.value)) })} /></label>
          <label><span>Vantagem mínima</span><input type="number" min="1" max="10" value={completion.minAdvantage} onChange={(event) => setCompletion({ ...completion, minAdvantage: Math.max(1, Number(event.target.value)) })} /></label>
        </div>
        <p className="form-hint">A partida tem no máximo {completion.setsToWin * 2 - 1} sets. O alvo menor do set decisivo vale só no último possível, e o app recusa encerrar um set sem a vantagem mínima.</p>
      </> : null}
      {completion.mode === 'board' ? <>
        <div className="rule-fields two-columns">
          <label className="checkbox-field"><input type="checkbox" checked={completion.allowDraw} onChange={(event) => setCompletion({ ...completion, allowDraw: event.target.checked })} /><span>Permite terminar empatado</span></label>
          {/* "Pontos da vitória" aqui e "Pontos por vitória" no bloco Classificação
              são coisas diferentes e diferiam por uma preposição: no Xadrez os dois
              pares coexistem com valores parecidos (1 / 0.5) e o admin editava o
              campo errado sem nenhum sinal. */}
          <label><span>Placar gravado na vitória</span><input type="number" min="0.5" step="0.5" value={completion.winPoints} onChange={(event) => setCompletion({ ...completion, winPoints: Number(event.target.value) })} /></label>
          <label><span>Placar gravado no empate</span><input type="number" min="0" step="0.5" value={completion.drawPoints} onChange={(event) => setCompletion({ ...completion, drawPoints: Number(event.target.value) })} /></label>
        </div>
        <p className="form-hint">É o resultado que fica na súmula da mesa ou rodada — não é a pontuação da tabela, que se configura em Classificação.</p>
      </> : null}
      {completion.mode === 'result' ? <label className="checkbox-field"><input type="checkbox" checked={completion.allowDraw} onChange={(event) => setCompletion({ ...completion, allowDraw: event.target.checked })} /><span>Admite empate na prova</span></label> : null}
    </fieldset>

    <fieldset className="regulation-group">
      <legend>Elenco exigido</legend>
      <label className="checkbox-field"><input type="checkbox" checked={roster.required} onChange={(event) => patch({ roster: { ...roster, required: event.target.checked } })} /><span>A modalidade exige elenco inscrito</span></label>
      <div className="rule-fields">
        <label><span>Mínimo de atletas</span><input type="number" min="0" max="50" value={roster.min} onChange={(event) => patch({ roster: { ...roster, min: Math.max(0, Number(event.target.value)) } })} disabled={!roster.required} /></label>
        <label><span>Máximo de atletas</span><input type="number" min="1" max="99" value={roster.max} onChange={(event) => patch({ roster: { ...roster, max: Math.max(1, Number(event.target.value)) } })} disabled={!roster.required} /></label>
        <label><span>Bloquear alteração de elenco a partir de</span><select value={roster.lock} onChange={(event) => patch({ roster: { ...roster, lock: event.target.value as typeof roster.lock } })}>
          <option value="never">Nunca trava</option>
          <option value="discipline-start">Início da modalidade</option>
          <option value="knockout">Início do mata-mata</option>
        </select></label>
      </div>
      <p className="form-hint">Elenco fora da faixa é <strong>aviso</strong> ao agendar, não impedimento — o jogo acontece. Já o bloqueio é impedimento: a partir do momento escolhido, ninguém entra nem sai do elenco desta modalidade.</p>
    </fieldset>

    <fieldset className="regulation-group">
      <legend>Classificação</legend>
      <div className="rule-fields">
        <label><span>Pontos na tabela por vitória</span><input type="number" step="0.5" value={standings.win} onChange={(event) => patch({ standings: { ...standings, win: Number(event.target.value) } })} /></label>
        <label><span>Pontos na tabela por empate</span><input type="number" step="0.5" value={standings.draw} onChange={(event) => patch({ standings: { ...standings, draw: Number(event.target.value) } })} /></label>
        <label><span>Pontos na tabela por derrota</span><input type="number" step="0.5" value={standings.loss} onChange={(event) => patch({ standings: { ...standings, loss: Number(event.target.value) } })} /></label>
      </div>
      <p className="form-hint">Somados na coluna PTS da classificação da categoria.</p>
      <p className="form-hint">Ordem dos critérios de desempate. O primeiro que separar as equipes é o registrado na tabela.</p>
      <ol className="tiebreaker-list">
        {standings.tiebreakers.map((item, index) => (
          <li key={item}>
            <span>{tiebreakerLabels[item]}</span>
            <button type="button" onClick={() => moveTiebreaker(index, -1)} disabled={index === 0} aria-label={`Subir ${tiebreakerLabels[item]}`}><ArrowUp size={15} /></button>
            <button type="button" onClick={() => moveTiebreaker(index, 1)} disabled={index === standings.tiebreakers.length - 1} aria-label={`Descer ${tiebreakerLabels[item]}`}><ArrowDown size={15} /></button>
            <button type="button" onClick={() => patch({ standings: { ...standings, tiebreakers: standings.tiebreakers.filter((_, position) => position !== index) } })} aria-label={`Remover ${tiebreakerLabels[item]}`}><Trash2 size={15} /></button>
          </li>
        ))}
      </ol>
      <label><span>Adicionar critério</span><select value="" onChange={(event) => { if (event.target.value) patch({ standings: { ...standings, tiebreakers: [...standings.tiebreakers, event.target.value as TiebreakerId] } }); }}>
        <option value="">Selecione</option>
        {tiebreakerOptions.filter((item) => !standings.tiebreakers.includes(item)).map((item) => <option key={item} value={item}>{tiebreakerLabels[item]}</option>)}
      </select></label>
    </fieldset>

    <fieldset className="regulation-group">
      <legend>Mata-mata e W.O.</legend>
      <label><span>Desempate obrigatório na eliminatória</span><select value={knockout.method} onChange={(event) => patch({ knockout: { ...knockout, method: event.target.value as KnockoutMethod, label: knockoutMethodLabels[event.target.value as KnockoutMethod] } })}>{Object.entries(knockoutMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="checkbox-field"><input type="checkbox" checked={knockout.thirdPlaceMatch} onChange={(event) => patch({ knockout: { ...knockout, thirdPlaceMatch: event.target.checked } })} /><span>Sugerir disputa de terceiro lugar em novas categorias</span></label>
      <p className="form-hint">Vale como padrão ao criar uma categoria desta modalidade. A geração efetiva é ligada na própria categoria, em Critério de avanço.</p>
      <div className="rule-fields two-columns">
        <label><span>Placar do vencedor no W.O.</span><input type="number" min="0" value={walkover.winnerScore} onChange={(event) => patch({ walkover: { ...walkover, winnerScore: Math.max(0, Number(event.target.value)) } })} /></label>
        <label><span>Placar do ausente no W.O.</span><input type="number" min="0" value={walkover.loserScore} onChange={(event) => patch({ walkover: { ...walkover, loserScore: Math.max(0, Number(event.target.value)) } })} /></label>
      </div>
    </fieldset>
  </>;
}
