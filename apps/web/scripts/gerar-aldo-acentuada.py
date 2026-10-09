#!/usr/bin/env python3
"""
Gera `app/fonts/aldo-the-apache.ttf` a partir do `AldotheApache.ttf` publico.

POR QUE EXISTE
  O guia da marca (docs/marca/tipografia-e-cores-copa-halterada.pdf) pede a
  Aldo the Apache como fonte principal -- "modificada". A versao publica do
  DaFont (AJ Paglia) tem so ASCII: nenhuma letra acentuada, nenhum travessao,
  nenhum ponto medio. Em portugues isso aparece em "EDICAO", "CLASSIFICACAO",
  "NOTIFICACOES"... e a letra sem glifo cai em outra fonte no meio da palavra.

  Este script COMPOE as letras acentuadas: cada uma e a letra-base da propria
  fonte com um acento desenhado no mesmo estilo quadrado. E uma ponte -- se o
  designer do guia entregar a versao modificada, ela substitui o arquivo de
  saida diretamente e este script deixa de ser necessario.

USO (precisa de fontTools: `pip install fonttools`)
  python scripts/gerar-aldo-acentuada.py caminho/AldotheApache.ttf app/fonts/aldo-the-apache.ttf

Todas as medidas estao em unidades da fonte (UPM 2048). A fonte e toda em caixa
alta: maiusculas e minusculas medem 1446 de altura, e o acento grave que ela ja
traz ocupa y 1550..1834 -- os demais acentos usam a mesma faixa.
"""
import sys
from fontTools.agl import UV2AGL
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

entrada, saida = sys.argv[1], sys.argv[2]
f = TTFont(entrada)
glyf, hmtx, cmap = f['glyf'], f['hmtx'], f.getBestCmap()
ordem = list(f.getGlyphOrder())

# Marcas, desenhadas com o centro em x=286,5 (o do grave original) e em sentido
# horario (contorno externo do TrueType). Faixa vertical: 1550..1834.
MARCAS = {
    'acute': [(96, 1550), (227, 1834), (477, 1834), (279, 1550)],
    'circumflex': [(96, 1550), (286, 1834), (477, 1550), (330, 1550), (286, 1615), (243, 1550)],
    'tilde': [(96, 1550), (96, 1720), (253, 1720), (253, 1834), (477, 1834), (477, 1664), (320, 1664), (320, 1550)],
    'dieresis_esq': [(96, 1620), (96, 1780), (256, 1780), (256, 1620)],
    'dieresis_dir': [(317, 1620), (317, 1780), (477, 1780), (477, 1620)],
}
CENTRO_MARCA = 286.5


def desenhar(nome, contornos, adv, lsb=None):
    pen = TTGlyphPen(None)
    for pts in contornos:
        pen.moveTo(pts[0])
        for p in pts[1:]:
            pen.lineTo(p)
        pen.closePath()
    g = pen.glyph()
    g.recalcBounds(glyf)
    glyf[nome] = g
    ordem.append(nome)
    hmtx[nome] = (adv, g.xMin if lsb is None else lsb)


def componente(nome, base, partes, adv):
    """`partes`: lista de (glifo, dx, dy). Vira um glifo composto."""
    pen = TTGlyphPen(f.getGlyphSet())
    for glifo, dx, dy in partes:
        pen.addComponent(glifo, (1, 0, 0, 1, dx, dy))
    g = pen.glyph()
    glyf[nome] = g
    ordem.append(nome)
    hmtx[nome] = (adv, glyf[base].xMin)


# --- glifos de marca (sem codigo Unicode proprio) --------------------------
desenhar('mk_acute', [MARCAS['acute']], 0, 0)
desenhar('mk_circumflex', [MARCAS['circumflex']], 0, 0)
desenhar('mk_tilde', [MARCAS['tilde']], 0, 0)
desenhar('mk_dieresis', [MARCAS['dieresis_esq'], MARCAS['dieresis_dir']], 0, 0)
GRAVE = cmap[0x60]  # o grave original, reaproveitado como esta


def cedilha(cx):
    """Bloco sob a letra, com um pe para a esquerda. Sobrepoe o traco de baixo."""
    return [[(cx - 175, -200), (cx - 175, -60), (cx - 75, -60), (cx - 75, 80), (cx + 75, 80), (cx + 75, -200)]]


# marca -> (glifo, centro da marca em x)
SUPERIORES = {
    'acute': ('mk_acute', CENTRO_MARCA),
    'grave': (GRAVE, (96 + 477) / 2),
    'circumflex': ('mk_circumflex', CENTRO_MARCA),
    'tilde': ('mk_tilde', CENTRO_MARCA),
    'dieresis': ('mk_dieresis', CENTRO_MARCA),
}

# letra acentuada -> (letra-base, tipo da marca)
PARES = {}
for base, variantes in {
    'A': 'ÁÀÂÃÄ', 'E': 'ÉÈÊË', 'I': 'ÍÌÎÏ', 'O': 'ÓÒÔÕÖ', 'U': 'ÚÙÛÜ',
}.items():
    tipos = ['acute', 'grave', 'circumflex', 'tilde', 'dieresis']
    for ch in variantes:
        if base == 'A':
            tipo = {'Á': 'acute', 'À': 'grave', 'Â': 'circumflex', 'Ã': 'tilde', 'Ä': 'dieresis'}[ch]
        elif base == 'E':
            tipo = {'É': 'acute', 'È': 'grave', 'Ê': 'circumflex', 'Ë': 'dieresis'}[ch]
        elif base == 'I':
            tipo = {'Í': 'acute', 'Ì': 'grave', 'Î': 'circumflex', 'Ï': 'dieresis'}[ch]
        elif base == 'O':
            tipo = {'Ó': 'acute', 'Ò': 'grave', 'Ô': 'circumflex', 'Õ': 'tilde', 'Ö': 'dieresis'}[ch]
        else:
            tipo = {'Ú': 'acute', 'Ù': 'grave', 'Û': 'circumflex', 'Ü': 'dieresis'}[ch]
        PARES[ch] = (base, tipo)
        PARES[ch.lower()] = (base.lower(), tipo)
PARES['Ñ'] = ('N', 'tilde')
PARES['ñ'] = ('n', 'tilde')

novos = {}  # codepoint -> nome de glifo


def nome_para(cp):
    return UV2AGL.get(cp) or 'uni%04X' % cp


for ch, (base, tipo) in PARES.items():
    nb = cmap[ord(base)]
    g = glyf[nb]
    centro_base = (g.xMin + g.xMax) / 2
    marca, centro_marca = SUPERIORES[tipo]
    dx = round(centro_base - centro_marca)
    nome = nome_para(ord(ch))
    componente(nome, nb, [(nb, 0, 0), (marca, dx, 0)], hmtx[nb][0])
    novos[ord(ch)] = nome

# cedilha: Ç ç
for ch, base in (('Ç', 'C'), ('ç', 'c')):
    nb = cmap[ord(base)]
    g = glyf[nb]
    cx = round((g.xMin + g.xMax) / 2)
    mk = 'mk_cedilla_' + base
    desenhar(mk, cedilha(cx), 0, 0)
    nome = nome_para(ord(ch))
    componente(nome, nb, [(nb, 0, 0), (mk, 0, 0)], hmtx[nb][0])
    novos[ord(ch)] = nome

# --- pontuacao que faltava --------------------------------------------------
ALTURA_TRACO = (610, 820)  # a mesma do hifen original
desenhar('endash', [[(50, ALTURA_TRACO[0]), (50, ALTURA_TRACO[1]), (700, ALTURA_TRACO[1]), (700, ALTURA_TRACO[0])]], 770)
novos[0x2013] = 'endash'
desenhar('emdash', [[(50, ALTURA_TRACO[0]), (50, ALTURA_TRACO[1]), (1100, ALTURA_TRACO[1]), (1100, ALTURA_TRACO[0])]], 1170)
novos[0x2014] = 'emdash'
desenhar('periodcentered', [[(50, 600), (50, 840), (290, 840), (290, 600)]], 360)
novos[0xB7] = 'periodcentered'
desenhar('bullet', [[(50, 560), (50, 880), (370, 880), (370, 560)]], 440)
novos[0x2022] = 'bullet'
# reticencias = tres pontos finais
pn = cmap[ord('.')]
adv = hmtx[pn][0]
componente('ellipsis', pn, [(pn, 0, 0), (pn, adv, 0), (pn, 2 * adv, 0)], 3 * adv)
novos[0x2026] = 'ellipsis'

# apelidos: reaproveitam um glifo ja existente
for cp, alvo in {
    0x2018: 'quotesingle', 0x2019: 'quotesingle',
    0x201C: 'quotedbl', 0x201D: 'quotedbl',
    0xD7: cmap[ord('X')],
}.items():
    novos[cp] = alvo

# --- fecha a fonte ----------------------------------------------------------
f.setGlyphOrder(ordem)
for t in f['cmap'].tables:
    if t.isUnicode():
        for cp, nome in novos.items():
            if cp <= 0xFFFF:
                t.cmap[cp] = nome
# tabelas indexadas por glifo que nao acompanham glifos novos
for tab in ('hdmx', 'LTSH', 'VDMX'):
    if tab in f:
        del f[tab]
f['post'].formatType = 3.0
for r in f['name'].names:
    if r.nameID in (1, 4, 16):
        r.string = 'Aldo the Apache PT'
    if r.nameID == 6:
        r.string = 'AldotheApachePT-Regular'
f.save(saida)
print('ok:', len(novos), 'codigos novos ->', saida)
