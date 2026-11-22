import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';
import { PRO_PRICE_DISPLAY } from '@/lib/pricing';
import { LegalDocument, Section, Clause, Bullets, Notice, Summary } from '@/components/LegalDocument';

export const metadata: Metadata = {
  title: 'End User Licence Agreement — CurricuGen Pro',
  description: 'The terms on which you may use CurricuGen Pro, including plans, payment, acceptable use and your data.',
};

const link = 'text-blue-400 hover:text-blue-300 underline';

export default function TermsPage() {
  return (
    <LegalDocument title="End User Licence Agreement">
      <Summary title="Plain-language summary (the numbered clauses below are what binds us)">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>CurricuGen Pro is an AI tool that drafts teaching material for teachers. You get a licence to use it. You do not buy the software.</li>
          <li>You own what you create. You must still check AI output before putting it in front of learners.</li>
          <li>Pro is {PRO_PRICE_DISPLAY} per month, billed by PayFast, and you can cancel any time. See the <Link href="/refund-policy" className={link}>Refund Policy</Link>.</li>
          <li>Learner details you enter are personal information. Use initials or first names rather than full identifying details wherever you can.</li>
        </ul>
      </Summary>

      <Section n={1} title="Agreement and acceptance">
        <Clause id="1.1">
          This End User Licence Agreement (the &ldquo;<strong>Agreement</strong>&rdquo;) is between you
          (&ldquo;<strong>you</strong>&rdquo;) and {LEGAL.companyName}, {LEGAL.legalStatus}, registration number{' '}
          {LEGAL.registrationNumber}, trading as {LEGAL.tradingAs} (&ldquo;<strong>we</strong>&rdquo;, &ldquo;
          <strong>us</strong>&rdquo;), of {LEGAL.physicalAddress}, {LEGAL.country}. VAT: {LEGAL.vatStatus}. Contact:{' '}
          {LEGAL.supportEmail}.
        </Clause>
        <Clause id="1.2">
          It governs your use of the {LEGAL.productName} website, web application and related services, including the AI
          generation features (together, the &ldquo;<strong>Service</strong>&rdquo;).
        </Clause>
        <Clause id="1.3">
          You accept this Agreement by creating an account, by ticking the acceptance box at checkout, or by using the
          Service, whichever happens first. If you do not accept it, do not use the Service.
        </Clause>
        <Clause id="1.4">
          You must be at least 18 years old, or have the consent of a parent, guardian or your employing school to use the
          Service. The Service is intended for teachers and education professionals and is not for use by learners.
        </Clause>
        <Clause id="1.5">
          If you use the Service for a school or other organisation, you confirm that you are authorised to accept this
          Agreement for it.
        </Clause>
      </Section>

      <Section n={2} title="Licence">
        <Clause id="2.1">
          Subject to this Agreement and, for paid features, to payment, we grant you a limited, personal, non-exclusive,
          non-transferable, revocable licence to access and use the Service for your own teaching and professional
          purposes.
        </Clause>
        <Clause id="2.2">You may not, and may not let anyone else:</Clause>
        <Bullets
          items={[
            'copy, modify, translate, reverse engineer, decompile or try to extract the source code of the Service, except where the law allows this despite this clause;',
            'sell, resell, rent, sublicense or commercially exploit access to the Service itself, or share your account or login with other people;',
            'use bots, scrapers or automated means to access the Service, or bypass or tamper with usage limits, credits, billing or security features;',
            'use the Service to build or train a competing product or an AI model;',
            'probe, scan or test the vulnerability of the Service or disrupt it or the systems that support it.',
          ]}
        />
        <Clause id="2.3">
          The Service, its software, design, trade marks and all related intellectual property belong to us or our
          licensors. This Agreement does not transfer any of them to you. We reserve every right not expressly granted.
        </Clause>
        <Clause id="2.4">
          You may give us feedback and suggestions. We may use them without owing you anything.
        </Clause>
      </Section>

      <Section n={3} title="Your account">
        <Clause id="3.1">
          You must give accurate information when you register and keep it up to date. Sign-in is provided through our
          authentication provider, Clerk.
        </Clause>
        <Clause id="3.2">
          You are responsible for keeping your login secure and for all activity on your account. Tell us promptly if you
          suspect unauthorised access.
        </Clause>
        <Clause id="3.3">
          One person per account. Pro is licensed to one individual teacher and may not be shared between colleagues.
        </Clause>
      </Section>

      <Section n={4} title="Plans, fair use and payment">
        <Clause id="4.1">
          <strong>Free plan.</strong> Includes a daily allowance of AI generations (currently 10) and image generations
          (currently 1), which reset each day. Allowances may change, and unused allowance does not carry over.
        </Clause>
        <Clause id="4.2">
          <strong>Pro plan.</strong> {PRO_PRICE_DISPLAY} per month (ZAR, including VAT where applicable), a recurring
          subscription raising the free daily generation limit to a fair-use ceiling and including a higher daily image
          allowance (currently 10). The fair-use ceiling is currently 300 generations a day and may change with
          reasonable notice. Use is subject to reasonable, personal, professional use. We may apply technical rate
          limits to protect the Service and may restrict accounts whose use is clearly abusive or automated.
        </Clause>
        <Clause id="4.3">
          <strong>Beta access.</strong> Some accounts are given Pro-equivalent access during a beta period free of charge.
          We may end beta access with reasonable notice.
        </Clause>
        <Clause id="4.4">
          <strong>Payment.</strong> Payments are processed by PayFast, a third-party payment provider. By subscribing you
          authorise PayFast to charge your chosen payment method {PRO_PRICE_DISPLAY} on the day you subscribe and the same
          amount on the same date every month until you cancel. We do not store your full card details. PayFast&rsquo;s own
          terms and privacy notice apply to its processing.
        </Clause>
        <Clause id="4.5">
          <strong>Cancellation, refunds and price changes.</strong> You may cancel at any time. Cancellation, the 7-day
          money-back guarantee, refunds, price-change notice and how failed payments are handled are set out in our{' '}
          <Link href="/refund-policy" className={link}>Refund, Cancellation &amp; Delivery Policy</Link>, which forms part
          of this Agreement.
        </Clause>
        <Clause id="4.6">
          If your payment fails or is reversed, we may return your account to the free plan until the amount is paid.
        </Clause>
      </Section>

      <Section n={5} title="Your content and AI output">
        <Clause id="5.1">
          <strong>Your content.</strong> You keep ownership of what you put into the Service, such as classroom
          details, notes, learner lists and marks (&ldquo;<strong>Your Content</strong>&rdquo;). You give us a licence to
          store, process and display Your Content, and to send it to our AI provider, only as needed to run the Service
          for you, keep it secure and support you.
        </Clause>
        <Clause id="5.2">
          <strong>Output.</strong> As between you and us, you own the lesson plans, worksheets, assessments and other
          material the Service generates for you (&ldquo;<strong>Output</strong>&rdquo;), and you may use it for your
          teaching, including at your school and with your learners. Because Output is generated by AI, the same or similar
          Output may be produced for other users, and we cannot promise that Output is unique or free of third-party rights.
        </Clause>
        <Clause id="5.3">
          <strong>You must check Output.</strong> AI can produce content that is wrong, incomplete, out of date, biased or
          unsuitable for a particular age group or curriculum. Output is a draft to assist a qualified teacher. You are
          responsible for reviewing, correcting and approving it, including marking memoranda and assessment answers,
          before using it with learners or relying on it for any decision. Output is not professional, legal or
          psychological advice, and risk indicators or learner &ldquo;analysis&rdquo; are prompts for your own professional
          judgement, not diagnoses or final decisions about any child.
        </Clause>
        <Clause id="5.4">
          <strong>Curriculum alignment.</strong> We try to align Output with the curricula you select, but we do not
          guarantee that it meets the requirements of any syllabus, examination body, department or school. We are not
          affiliated with, and are not endorsed by, any education department or examination authority named in the Service.
        </Clause>
        <Clause id="5.5">
          <strong>Your responsibilities for Your Content.</strong> You confirm that you have the right to submit Your
          Content and that it does not infringe anyone&rsquo;s rights or break the law. Do not paste in material you are
          not allowed to share, or unnecessary identifying information about learners (see clause 6.3).
        </Clause>
      </Section>

      <Section n={6} title="Privacy and personal information">
        <Clause id="6.1">
          We process personal information in line with the Protection of Personal Information Act 4 of 2013 (&ldquo;
          <strong>POPIA</strong>&rdquo;). Our full{' '}
          <Link href="/privacy" className={link}>Privacy Policy</Link> explains what we do with it and your rights; in
          summary, we collect your name, email address and profile image (from sign-in), your plan
          and usage counters, payment status records (PayFast references and amounts, not card numbers), and Your Content.
          We use it to provide, secure, support and bill for the Service, to meet legal obligations and to improve
          reliability. We do not sell personal information.
        </Clause>
        <Clause id="6.2">
          <strong>Service providers and AI processing.</strong> To run the Service we share information with providers
          acting for us: Clerk (authentication), PayFast (payments), our hosting and database providers, and Google (the
          Gemini AI service, which receives the prompts and classroom details needed to produce Output). Some of these
          providers are outside South Africa, which means personal information may be transferred and processed in other
          countries. We take reasonable steps to make sure they protect it to a comparable standard.
        </Clause>
        <Clause id="6.3">
          <strong>Learner information.</strong> The Service lets you record learner names and marks. This is personal
          information of children, which POPIA treats with special care. As the teacher you are responsible for having
          your school&rsquo;s authority to enter it. We ask you to enter only what you need, and to use first names,
          initials or codes instead of full names wherever you can. In respect of learner information that you enter, you
          act for your school or yourself as the responsible party and we act as your operator, processing it only on your
          instructions and under this Agreement.
        </Clause>
        <Clause id="6.4">
          <strong>Your rights and retention.</strong> You may ask to see, correct or delete your personal information, or
          object to its processing, by emailing {LEGAL.supportEmail}. We keep Your Content while your account is open and
          delete it within a reasonable period after you ask us to close your account, except where we must keep payment
          records (including PayFast transaction records) for legal, tax or fraud-prevention reasons.
        </Clause>
        <Clause id="6.5">
          <strong>Security.</strong> We use reasonable technical and organisational measures to protect personal
          information. If we become aware of a security compromise affecting your information, we will notify you and the
          Information Regulator as POPIA requires. Information Officer contact: {LEGAL.informationOfficerEmail}. You may
          complain to the Information Regulator (South Africa) if you believe your information has been mishandled.
        </Clause>
      </Section>

      <Section n={7} title="Acceptable use">
        <Clause id="7.1">You must not use the Service to:</Clause>
        <Bullets
          items={[
            'create or share unlawful, defamatory, hateful, sexually explicit or abusive content, or anything that endangers or exploits children;',
            'infringe copyright or other rights, including by copying whole textbooks or protected exam papers into the Service;',
            'cheat on, or help learners cheat on, formal examinations or external assessments;',
            'impersonate anyone, or mislead others about who created material;',
            'attempt to get around safety filters or use the Service for any purpose that breaks the law.',
          ]}
        />
        <Clause id="7.2">
          We may remove content, limit features, or suspend or close an account that we reasonably believe breaks this
          clause or puts the Service or other users at risk. Where practical and lawful we will tell you first.
        </Clause>
      </Section>

      <Section n={8} title="Availability and changes to the Service">
        <Clause id="8.1">
          We aim to keep the Service available but it is provided online and depends on third parties. It may be
          interrupted for maintenance, upgrades or events outside our control. Features may be added, changed or removed.
          Features marked &ldquo;coming soon&rdquo; are not promised for any date.
        </Clause>
        <Clause id="8.2">
          If we remove or materially reduce a paid feature, you may cancel and ask for a refund of a reasonable portion of
          the current month, as set out in the Refund Policy.
        </Clause>
        <Clause id="8.3">
          You should keep your own copy of important material. You can export many items from the Service. We are not a
          backup service.
        </Clause>
      </Section>

      <Section n={9} title="Warranties, liability and your statutory rights">
        <Notice title="Important notice: please read this clause carefully">
          <p>
            This clause limits our responsibility to you and may affect your rights. Nothing in this Agreement excludes or
            limits any right you have under the Consumer Protection Act 68 of 2008, or any liability that cannot lawfully be
            excluded, including for our gross negligence, fraud or intentional harm.
          </p>
        </Notice>
        <Clause id="9.1">
          <strong>Your rights stay.</strong> Where the Consumer Protection Act applies, you are entitled to a service
          performed with reasonable care and skill, and this Agreement must be read subject to that Act. If any clause
          conflicts with a right you have that cannot be waived, the clause is limited to the extent necessary.
        </Clause>
        <Clause id="9.2">
          <strong>As is, to the extent the law allows.</strong> Subject to clause 9.1, the Service, and in particular AI
          Output, is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We do not warrant that it will be
          uninterrupted or error-free, or that Output will be accurate, complete, suitable for your purpose or aligned to a
          particular syllabus.
        </Clause>
        <Clause id="9.3">
          <strong>Limit on liability.</strong> Subject to clause 9.1, and to the extent the law allows, we are not liable
          for indirect or consequential loss, loss of profit, loss of data, or loss arising from your reliance on Output
          without checking it. Our total liability to you for any claim arising from the Service is limited to the amount
          you paid us in the 12 months before the claim arose (for free users, R0).
        </Clause>
        <Clause id="9.4">
          <strong>Third parties.</strong> We are not responsible for the acts, omissions, outages or terms of third-party
          providers such as PayFast, Clerk, Google or your own bank, network or device, except where the law makes us so.
        </Clause>
        <Clause id="9.5">
          <strong>Your indemnity.</strong> To the extent permitted by law, you are responsible for loss we suffer because
          you broke this Agreement or because of Your Content, including claims by third parties arising from them.
        </Clause>
      </Section>

      <Section n={10} title="Suspension and termination">
        <Clause id="10.1">
          You can stop using the Service and close your account at any time, and you can cancel a paid subscription as
          described in the Refund Policy. Closing your account does not by itself refund payments.
        </Clause>
        <Clause id="10.2">
          We may suspend or terminate your access if you materially breach this Agreement, if required by law, or if we
          discontinue the Service. Where we terminate a paid account other than for your breach, we will refund the unused
          part of the period you paid for.
        </Clause>
        <Clause id="10.3">
          On termination your licence ends. Clauses that by their nature should continue (including intellectual property,
          liability, governing law and clauses on money owed) continue to apply.
        </Clause>
      </Section>

      <Section n={11} title="Electronic communication and notices">
        <Clause id="11.1">
          You agree that we may communicate with you electronically, by email to the address on your account or by notice in
          the Service, and that these communications satisfy any legal requirement to be in writing. Send notices to us at{' '}
          {LEGAL.supportEmail}.
        </Clause>
        <Clause id="11.2">
          We may update this Agreement, for example to reflect new features, law or providers. For material changes we will
          give you at least 30 days&rsquo; notice by email or in the Service. If you do not agree, you may cancel before the
          change takes effect. By continuing to use the Service afterwards you accept the update. A change never reduces
          your rights in respect of a payment already made.
        </Clause>
      </Section>

      <Section n={12} title="General">
        <Clause id="12.1">
          <strong>Governing law and disputes.</strong> This Agreement is governed by the laws of the Republic of South
          Africa. Please contact us first so we can try to resolve a problem informally. Nothing prevents you from
          approaching the National Consumer Commission, the National Consumer Tribunal, an ombud or a court of competent
          jurisdiction in South Africa.
        </Clause>
        <Clause id="12.2">
          <strong>Entire agreement.</strong> This Agreement, together with the{' '}
          <Link href="/refund-policy" className={link}>Refund, Cancellation &amp; Delivery Policy</Link>, is the whole
          agreement between you and us about the Service and replaces earlier understandings.
        </Clause>
        <Clause id="12.3">
          <strong>Severability and waiver.</strong> If a clause is found unenforceable, the rest remains in force. If we
          do not enforce a right immediately, we have not given it up.
        </Clause>
        <Clause id="12.4">
          <strong>Assignment.</strong> You may not transfer your rights under this Agreement. We may transfer ours to a
          successor of the business if your rights are not reduced.
        </Clause>
        <Clause id="12.5">
          <strong>Events beyond our control.</strong> Neither of us is liable for failure to perform caused by events
          beyond reasonable control, such as power or internet failure, third-party outages or natural disasters.
          This does not excuse payment obligations that are already due.
        </Clause>
        <Clause id="12.6">
          <strong>Supplier information.</strong> {LEGAL.companyName} ({LEGAL.legalStatus}), registration number{' '}
          {LEGAL.registrationNumber}, {LEGAL.physicalAddress}, {LEGAL.country}. Email {LEGAL.supportEmail}. All prices are
          in South African Rand. The Service is delivered electronically and there are no export restrictions on the
          Service itself.
        </Clause>
      </Section>
    </LegalDocument>
  );
}
