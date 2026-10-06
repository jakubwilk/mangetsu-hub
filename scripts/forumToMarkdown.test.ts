import { describe, expect, it } from 'vitest'

import { topicHtmlToMarkdown } from './forumToMarkdown'

// Shape of jcink's printable topic: a breadcrumb, then one "Posted by" table per post whose body
// wraps the forum's custom BBCode (marked by <!-- bbc_* --> comments).
const post = (title: string, body: string) => `
  <table><tr><td bgcolor='#EEEEEE'><b>Posted by: Mangetsu</b></td></tr>
  <tr><td><font size='3'><center><div id="temat-mangetsu"><!-- bbc_fourtyeight --><div class="nazwa-mangetsu">${title}</div><!-- end_bbc_fourtyeight --><!-- bbc_fourtynine --><div class="tresc-mangetsu">${body}</div><!-- end_bbc_fourtynine --></div></center></font></td></tr></table>`

const topic = (...posts: string[]) => `
  <html><body>
  <td><font face='arial' size='2' color='#000000'><b>Mangetsu PBF &gt; Mechanika &gt; <font color='red'>Ekwipunek</font></b></font></td>
  ${posts.join('\n')}
  </body></html>`

const section = (name: string) =>
  `<!-- bbc_thirtyfour --><h1>${name}</h1><!-- end_bbc_thirtyfour -->`

describe('topicHtmlToMarkdown', () => {
  it('turns posts into "##" and forum sections into "###" under the topic title', () => {
    const { markdown, posts } = topicHtmlToMarkdown(
      topic(post('Mechanika', `${section('Zakupy')}<br>Lista życzeń.`)),
    )

    expect(posts).toBe(1)
    expect(markdown).toBe('# Ekwipunek\n\n## Mechanika\n\n### Zakupy\n\nLista życzeń.\n')
  })

  it('keeps a heading for an introduction post titled like the topic', () => {
    const { markdown } = topicHtmlToMarkdown(
      topic(post('EKWIPUNEK', `Wstęp.${section('Majątek')}Treść.`), post('Mechanika', 'Dalej.')),
    )

    expect(markdown).toBe(
      '# Ekwipunek\n\n## Ekwipunek\n\nWstęp.\n\n### Majątek\n\nTreść.\n\n## Mechanika\n\nDalej.\n',
    )
  })

  it('decodes entities and normalizes titles typed in caps or ending with a colon', () => {
    const { markdown } = topicHtmlToMarkdown(
      topic(post('SI&#321;A:', 'Maj&#261;tek &amp; Inwentarz&#33;')),
    )

    expect(markdown).toContain('## Siła\n\nMajątek & Inwentarz!')
  })

  it('ends a paragraph at every <br> and keeps list items apart', () => {
    const { markdown } = topicHtmlToMarkdown(
      topic(
        post(
          'Kategorie',
          'Pierwszy.<br>Drugi.<ul><li><b>Osobiste:</b> telefon</li><li>Zwyczajne</li></ul>',
        ),
      ),
    )

    expect(markdown).toContain('Pierwszy.\n\nDrugi.\n\n- **Osobiste:** telefon\n\n- Zwyczajne')
  })

  it('quotes an example and keeps headings inside it from becoming sections', () => {
    const { markdown } = topicHtmlToMarkdown(
      topic(
        post(
          'Zakupy',
          `<details><summary>Przykład</summary><b>Kontekst:</b> Okinawa.<br><br>${section('Ekwipunek')}<br>Ponton.</details>`,
        ),
      ),
    )

    expect(markdown).toContain(
      '**Przykład:**\n\n> **Kontekst:** Okinawa.\n\n> **Ekwipunek**\n\n> Ponton.',
    )
    expect(markdown).not.toContain('### Ekwipunek')
  })

  it('joins a drop cap with its word but keeps a label separate', () => {
    const box = (text: string) =>
      `<!-- bbc_seventynine --><div class="mangetsu-num">${text}</div><!-- end_bbc_seventynine -->`
    const { markdown } = topicHtmlToMarkdown(
      topic(post('Kręgi', `${box('E')}ra Heian.<br>${box('VII')} To podstawowy oręż.`)),
    )

    expect(markdown).toContain('Era Heian.\n\n**VII** To podstawowy oręż.')
  })

  it('converts tables, keeping words split by <br> inside a cell apart', () => {
    const { markdown } = topicHtmlToMarkdown(
      topic(
        post(
          'Sklep',
          '<div class="mangetsu-tabela"><table><tbody><tr><td>Krąg<br>broni</td><td>Koszt</td></tr><tr><td>VII</td><td>50PD</td></tr></tbody></table></div>',
        ),
      ),
    )

    expect(markdown).toContain('| Krąg broni | Koszt |\n| --- | --- |\n| VII | 50PD |')
  })

  it('drops rules and images and marks a subtitle as emphasis', () => {
    const { markdown } = topicHtmlToMarkdown(
      topic(
        post(
          'Mechanika',
          '<div class="dodatek-mangetsu">Czyli ekwipunek <br>w praktyce</div><hr class="solid"/><img src="x.png">Tekst.',
        ),
      ),
    )

    expect(markdown).toBe('# Ekwipunek\n\n## Mechanika\n\n*Czyli ekwipunek w praktyce*\n\nTekst.\n')
  })

  it('counts posts whose BBCode could not be read', () => {
    const broken =
      '<table><tr><td><b>Posted by: Mangetsu</b></td></tr><tr><td>Bez szablonu</td></tr></table>'

    expect(topicHtmlToMarkdown(topic(post('Misje', 'Treść.'), broken)).untitled).toBe(1)
  })

  it('throws when the page is not a printable topic', () => {
    expect(() => topicHtmlToMarkdown('<html><body>Brak dostępu</body></html>')).toThrow(
      /Nie rozpoznano wątku/,
    )
  })
})
