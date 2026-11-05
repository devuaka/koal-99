// Giant block letters for the "bigtxt" command (5 rows per letter, the koalOS font).
const FONT: Record<string, string> = {
  A: ' ### |#   #|#####|#   #|#   #', B: '#### |#   #|#### |#   #|#### ', C: ' ####|#    |#    |#    | ####',
  D: '#### |#   #|#   #|#   #|#### ', E: '#####|#    |#### |#    |#####', F: '#####|#    |#### |#    |#    ',
  G: ' ####|#    |#  ##|#   #| ####', H: '#   #|#   #|#####|#   #|#   #', I: '#####|  #  |  #  |  #  |#####',
  J: '  ###|   # |   # |#  # | ##  ', K: '#   #|#  # |###  |#  # |#   #', L: '#    |#    |#    |#    |#####',
  M: '#   #|## ##|# # #|#   #|#   #', N: '#   #|##  #|# # #|#  ##|#   #', O: ' ### |#   #|#   #|#   #| ### ',
  P: '#### |#   #|#### |#    |#    ', Q: ' ### |#   #|# # #|#  # | ## #', R: '#### |#   #|#### |#  # |#   #',
  S: ' ####|#    | ### |    #|#### ', T: '#####|  #  |  #  |  #  |  #  ', U: '#   #|#   #|#   #|#   #| ### ',
  V: '#   #|#   #|#   #| # # |  #  ', W: '#   #|#   #|# # #|## ##|#   #', X: '#   #| # # |  #  | # # |#   #',
  Y: '#   #| # # |  #  |  #  |  #  ', Z: '#####|   # |  #  | #   |#####',
  0: ' ### |#  ##|# # #|##  #| ### ', 1: '  #  | ##  |  #  |  #  | ### ', 2: ' ### |#   #|  ## | #   |#####',
  3: '#### |    #| ### |    #|#### ', 4: '#  # |#  # |#####|   # |   # ', 5: '#####|#    |#### |    #|#### ',
  6: ' ### |#    |#### |#   #| ### ', 7: '#####|    #|   # |  #  |  #  ', 8: ' ### |#   #| ### |#   #| ### ',
  9: ' ### |#   #| ####|    #| ### ',
  '!': '  #  |  #  |  #  |     |  #  ', '?': ' ### |#   #|  ## |     |  #  ', '.': '     |     |     |     |  #  ',
  ',': '     |     |     |  #  | #   ', '-': '     |     | ### |     |     ', ':': '     |  #  |     |  #  |     ',
  "'": '  #  |  #  |     |     |     ', '+': '     |  #  |#####|  #  |     ', '=': '     |#####|     |#####|     ',
  '/': '    #|   # |  #  | #   |#    ', '*': '     |# # #| ### |# # #|     ', _: '     |     |     |     |#####',
  ' ': '   |   |   |   |   ',
};

const glyph = (ch: string) => (FONT[ch] ?? FONT['?']).split('|');
const width = (ch: string) => glyph(ch)[0].length + 1;
const lineWidth = (s: string) => [...s].reduce((n, ch) => n + width(ch), 0);

/** Renders text as 5-row block letters, wrapping at `cols` characters. */
export function bigText(text: string, cols = 76): string {
  const lines: string[] = [];
  let cur = '';
  const flush = () => {
    if (cur) lines.push(cur);
    cur = '';
  };
  for (const word of text.toUpperCase().split(/(\s+)/)) {
    if (!word) continue;
    if (cur && lineWidth(cur) + lineWidth(word) > cols) flush();
    for (const ch of word) {
      if (cur && lineWidth(cur) + width(ch) > cols) flush();
      cur += ch;
    }
  }
  flush();
  return lines
    .map((l) => {
      const rows = ['', '', '', '', ''];
      for (const ch of l.trim()) glyph(ch).forEach((r, i) => (rows[i] += r + ' '));
      return rows.map((r) => r.replace(/#/g, '█').trimEnd()).join('\n');
    })
    .join('\n\n');
}
