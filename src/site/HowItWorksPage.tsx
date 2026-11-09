import { Link } from 'react-router-dom'
import { EditorialSitePage } from './EditorialSiteChrome'
import keepsakePhoto from '../assets/editorial/p01.webp'
import './HowItWorksPage.css'

/** Wording reconciled against the published page, not its older source defaults. */
export default function HowItWorksPage() {
  return (
    <EditorialSitePage>
      <div className="process-page">
        <section className="process-intro" aria-labelledby="process-title">
          <div>
            <p className="eyebrow">How it works</p>
            <h1 id="process-title">Your archive begins with a conversation.</h1>
          </div>
          <p className="process-standfirst">We guide you one question at a time. You decide what to share, what to keep and who to invite.</p>
        </section>

        <section className="process-opening process-copy" aria-labelledby="process-step-one">
          <div>
            <span className="process-number" aria-label="Step 1">01</span>
            <h2 id="process-step-one">Begin with a guided conversation</h2>
          </div>
          <p>An interview that asks the questions your family would ask, one at a time, at your pace.</p>
        </section>

        <section className="process-shaping" aria-label="Adding to and shaping your archive">
          <figure className="process-keepsake-photo">
            <img src={keepsakePhoto} alt="Illustrative photograph of two generations sharing family photographs at a kitchen table." width="1536" height="768" loading="lazy" decoding="async" />
          </figure>
          <div className="process-paired-steps">
            <article className="process-copy" aria-labelledby="process-step-two">
              <span className="process-number" aria-label="Step 2">02</span>
              <h2 id="process-step-two">Add voice, photos, and family context</h2>
              <p>Record a voice memory. Add photographs, letters, and the people who belong to each story.</p>
            </article>
            <article className="process-copy" aria-labelledby="process-step-three">
              <span className="process-number" aria-label="Step 3">03</span>
              <h2 id="process-step-three">Review and shape the archive</h2>
              <p>Every entry stays yours to edit. Correct a date, add what you left out, remove what you would rather not keep.</p>
            </article>
          </div>
        </section>

        <section className="process-sharing" aria-label="Choosing access and returning to the archive">
          <article className="process-copy" aria-labelledby="process-step-four">
            <span className="process-number" aria-label="Step 4">04</span>
            <h2 id="process-step-four">Choose who can access it</h2>
            <p>Invite family by name. Set what each person can see. Change your mind at any time.</p>
          </article>
          <article className="process-copy" aria-labelledby="process-step-five">
            <span className="process-number" aria-label="Step 5">05</span>
            <h2 id="process-step-five">Let invited family return to your stories in your own words</h2>
            <p>They read and hear what you recorded, and nothing you did not.</p>
          </article>
        </section>

        <div className="process-actions">
          <Link className="primary" to="/signin?new=1">Start the archive</Link>
          <Link className="text-link" to="/the-archive">See what an archive holds</Link>
        </div>
      </div>
    </EditorialSitePage>
  )
}
