import { Link } from 'react-router-dom'
import { EditorialSitePage } from './EditorialSiteChrome'
import childhood from '../assets/editorial/p02.webp'
import archiveAlbum from '../assets/editorial/archive-album.webp'

// Copy reconciled against the published pages, including saved editor corrections.
const sections = [
  ['Stories', 'Entries gathered in conversation, each with a date, the people in it, and what you took from it.'],
  ['Voice memories', 'Recordings kept as recordings. A story arrives the way you told it, in your voice.'],
  ['Photos & documents', 'Photographs, letters, and papers, sitting with the story they belong to.'],
  ['People', 'The people who shaped the stories, and how you described them.'],
  ['Ask the archive', 'Questions answered only from the stories and memories you shared. If it does not know, it says so.'],
  ['Family Access', 'Who can open your archive, and what you choose to share with them.'],
]
const trust = ['Private by default', 'Shared only with invited family', 'Built only from what you choose to share', 'If the archive does not know, it says so']

export function TheArchivePage() {
  return <EditorialSitePage>
    <div className="editorial-wrap">
      <section className="archive-intro" aria-labelledby="archive-title">
        <div className="editorial-intro-copy">
          <p className="eyebrow">The Archive</p>
          <h1 id="archive-title">What your archive holds.</h1>
          <p className="editorial-lead">Everything you record is organized into sections you can read, correct, and add to.</p>
        </div>
        <figure><img src={archiveAlbum} width="2688" height="1792" alt="Illustrative photograph of family members looking through an open album together, pointing to a childhood photograph." fetchPriority="high" /></figure>
      </section>
      <section className="archive-catalog" aria-label="Archive sections">
        {sections.map(([title,body])=><article key={title}><h2>{title}</h2><p>{body}</p></article>)}
      </section>
    </div>
    <section className="archive-boundaries" aria-labelledby="archive-boundaries-title">
      <div className="editorial-wrap archive-boundaries-inner">
        <div><p className="eyebrow">What the archive will not do</p><h2 id="archive-boundaries-title">It answers only from what you shared.</h2><p>The archive answers from the stories and memories you have shared. If it does not know, it says so.</p></div>
        <ul>{trust.map(line=><li key={line}>{line}</li>)}</ul>
      </div>
    </section>
    <div className="editorial-wrap editorial-bottom-action"><Link className="primary" to="/signin?new=1">Build the archive</Link></div>
  </EditorialSitePage>
}

export function AboutPage() {
  return <EditorialSitePage>
    <div className="editorial-wrap">
      <section className="editorial-intro about-intro" aria-labelledby="about-title">
        <div className="editorial-intro-copy"><p className="eyebrow">About</p><h1 id="about-title">Why we started <span style={{ whiteSpace: 'nowrap' }}>As Told</span></h1></div>
        <p className="editorial-lead">It began with missing the conversations that used to feel ordinary.</p>
      </section>
        <figure className="about-memory-photo"><img src={childhood} width="1344" height="896" alt="Illustrative childhood memory of a father and two children laughing and splashing water in a garden." fetchPriority="high" /></figure>
      <section className="about-story" aria-label="Our story">
        <div className="about-story-copy">
          <p>Between the two of us, we’ve lost a mother and a father. Those losses helped us understand how much a person shares in ordinary conversation: not just their stories, but their humor, their perspective, and the reasons behind the advice they give.</p>
          <p>That understanding is why we started As Told. We wanted to make it easier for people to share these parts of themselves, in their own words.</p>
          <p>You don’t need to write a memoir or decide which moments are important enough to keep. You can begin with a conversation: a place you remember, someone who shaped your life, something you learned along the way.</p>
          <p>Over time, what you choose to share becomes a private family archive. Stories, voice recordings and photographs, kept together for the people you choose. Not an imagined version of you, but what you actually wanted to tell them.</p>
          <p className="founder-signature">Yael &amp; Tom</p>
        </div>
      </section>
      <section className="about-ownership" aria-labelledby="ownership-title">
        <div><h2 id="ownership-title">Your stories stay yours.</h2><p>Every entry stays yours to shape. Add what you left out, correct a detail, or keep something just for yourself. You choose who can open your archive, and you can change your mind.</p><Link className="primary" to="/signin?new=1">Begin your archive</Link></div>
        <div id="privacy"><h2 className="eyebrow">Security &amp; privacy</h2><ul>{[...trust,'Voice and likeness require explicit permission'].map(line=><li key={line}>{line}</li>)}</ul></div>
      </section>
    </div>
  </EditorialSitePage>
}
