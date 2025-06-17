import './view.js'
import { createTOCView } from './ui/tree.js'
import { createMenu } from './ui/menu.js'
import { Overlayer } from './ui/overlayer.js'

const getCSS = ({ spacing, justify, hyphenate }) => `
    @namespace epub "http://www.idpf.org/2007/ops";
    html {
        color-scheme: light dark;
    }
    /* https://github.com/whatwg/html/issues/5426 */
    @media (prefers-color-scheme: dark) {
        a:link {
            color: lightblue;
        }
    }
    p, li, blockquote, dd {
        line-height: ${spacing};
        text-align: ${justify ? 'justify' : 'start'};
        -webkit-hyphens: ${hyphenate ? 'auto' : 'manual'};
        hyphens: ${hyphenate ? 'auto' : 'manual'};
        -webkit-hyphenate-limit-before: 3;
        -webkit-hyphenate-limit-after: 2;
        -webkit-hyphenate-limit-lines: 2;
        hanging-punctuation: allow-end last;
        widows: 2;
    }
    /* prevent the above from overriding the align attribute */
    [align="left"] { text-align: left; }
    [align="right"] { text-align: right; }
    [align="center"] { text-align: center; }
    [align="justify"] { text-align: justify; }

    pre {
        white-space: pre-wrap !important;
    }
    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
        display: none;
    }
`
const $ = document.querySelector.bind(document)

const locales = 'en'
const percentFormat = new Intl.NumberFormat(locales, { style: 'percent' })
const listFormat = new Intl.ListFormat(locales, { style: 'short', type: 'conjunction' })

const formatLanguageMap = x => {
    if (!x) return ''
    if (typeof x === 'string') return x
    const keys = Object.keys(x)
    return x[keys[0]]
}

const formatOneContributor = contributor => typeof contributor === 'string'
    ? contributor : formatLanguageMap(contributor?.name)

const formatContributor = contributor => Array.isArray(contributor)
    ? listFormat.format(contributor.map(formatOneContributor))
    : formatOneContributor(contributor)

class Reader {
    #tocView
    style = {
        spacing: 1.4,
        justify: true,
        hyphenate: true,
    }
    annotations = new Map()
    annotationsByValue = new Map()
    constructor() {

    }
    async open(file) {
        this.view = document.createElement('foliate-view')
        // document.body.append(this.view)
        await this.view.open(file)
        this.view.addEventListener('load', this.#onLoad.bind(this))
        this.view.addEventListener('relocate', this.#onRelocate.bind(this))

        const { book } = this.view
        book.transformTarget?.addEventListener('data', ({ detail }) => {
            detail.data = Promise.resolve(detail.data).catch(e => {
                console.error(new Error(`Failed to load ${detail.name}`, { cause: e }))
                return ''
            })
        })
        this.view.renderer.setStyles?.(getCSS(this.style))
        this.view.renderer.next()

        document.addEventListener('keydown', this.#handleKeydown.bind(this))

        const title = formatLanguageMap(book.metadata?.title) || 'Untitled Book'
        document.title = title

        const toc = book.toc
        if (toc) {
            this.#tocView = createTOCView(toc, href => {
                console.log("href", href)
            })
            const tocViewElement = $('#toc-view');
            tocViewElement.innerHTML = '';
            tocViewElement.append(this.#tocView.element);
        }

    }
    #handleKeydown(event) {
        const k = event.key
        if (k === 'ArrowLeft' || k === 'h') this.view.goLeft()
        else if (k === 'ArrowRight' || k === 'l') this.view.goRight()
    }
    #onLoad({ detail: { doc } }) {
        doc.addEventListener('keydown', this.#handleKeydown.bind(this))
    }
    #onRelocate({ detail }) {
        const { fraction, location, tocItem, pageItem } = detail
        const percent = percentFormat.format(fraction)
        const loc = pageItem
            ? `Page ${pageItem.label}`
            : `Loc ${location.current}`
        if (tocItem?.href) this.#tocView?.setCurrentHref?.(tocItem.href)
    }
}

export const open = async file => {
    // document.body.removeChild($('#drop-target'))
    const reader = new Reader()
    globalThis.reader = reader
    await reader.open(file)
}

