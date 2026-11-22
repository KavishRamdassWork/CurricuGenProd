import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';
import { LegalDocument, Section, Clause, Bullets, Notice, Summary } from '@/components/LegalDocument';

export const metadata: Metadata = {
  title: 'Privacy Policy — CurricuGen Pro',
  description: 'What personal information CurricuGen Pro collects, why, who it is shared with, and your rights under POPIA.',
};

const link = 'text-blue-400 hover:text-blue-300 underline';

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy">
      <Summary title="The short version">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>We collect what we need to run your account, generate your teaching material and take payment. We do not sell your information and we show no advertising.</li>
          <li>
            Your prompts, classroom details and any learner information you enter are sent to <strong>Google&rsquo;s Gemini AI</strong> to produce
            results. Learner information belongs to your school and to you, so enter as little as you can (initials or first names, no health or disability details).
          </li>
          <li>Card details go straight to PayFast. We never see or store them.</li>
          <li>You can ask to see, correct or delete your information at any time. Email {LEGAL.supportEmail}.</li>
        </ul>
      </Summary>

      <Section n={1} title="Who is responsible for your information">
        <Clause id="1.1">
          {LEGAL.companyName}, {LEGAL.legalStatus}, registration number {LEGAL.registrationNumber}, trading as{' '}
          {LEGAL.tradingAs} (&ldquo;<strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;), of{' '}
          {LEGAL.physicalAddress}, {LEGAL.country}, is the &ldquo;responsible party&rdquo; under the Protection of Personal
          Information Act 4 of 2013 (&ldquo;<strong>POPIA</strong>&rdquo;) for the personal information of our account
          holders, as described in this policy.
        </Clause>
        <Clause id="1.2">
          <strong>Learner information is different.</strong> When you enter information about learners, your school (or you,
          if you act for yourself) decides why and how it is used, which makes you or your school the responsible party. We
          act as your &ldquo;operator&rdquo; and process it only to provide the Service to you (see section 4).
        </Clause>
        <Clause id="1.3">
          <strong>Contact.</strong> Privacy questions and requests: {LEGAL.supportEmail}. Information Officer:{' '}
          {LEGAL.informationOfficerEmail}.
        </Clause>
        <Clause id="1.4">
          This policy applies to the {LEGAL.productName} website and application. It should be read with our{' '}
          <Link href="/terms" className={link}>Licence Agreement</Link> and{' '}
          <Link href="/refund-policy" className={link}>Refund Policy</Link>.
        </Clause>
      </Section>

      <Section n={2} title="What we collect">
        <Clause id="2.1">
          <strong>Account information.</strong> When you sign up we receive, through our sign-in provider Clerk, your name,
          email address, profile picture and the sign-in method you used (for example email and password, or a Google
          account). Passwords are handled by Clerk, not by us.
        </Clause>
        <Clause id="2.2">
          <strong>Information you add to the Service (&ldquo;Your Content&rdquo;).</strong>
        </Clause>
        <Bullets
          items={[
            'Classroom details: class name, subject, grade, curriculum, class size, class average, your teaching notes.',
            'Optional learner-profile details: learning styles, accommodations, and learner interests.',
            'Learner records, if you choose to add them: learner names, assessment marks, and the risk level and notes the Service generates.',
            'The curriculum blueprints, lessons, worksheets, assessments, memos, images and other material you generate and save.',
          ]}
        />
        <Clause id="2.3">
          <strong>Payment information.</strong> If you subscribe, PayFast collects your card or bank details directly. We
          receive only the result: a PayFast payment reference, the amount, the payment status, and a subscription token
          that lets PayFast identify your subscription. We never receive or store your full card number.
        </Clause>
        <Clause id="2.4">
          <strong>Usage information.</strong> Your plan (free or Pro), your daily generation and image counters and when you
          last used them, and the date your account was created.
        </Clause>
        <Clause id="2.5">
          <strong>Technical information.</strong> Our hosting and security systems record technical data when you use the
          Service, such as IP address, browser and device type, pages and API requests, timestamps and error records. We
          use it to keep the Service running and secure, and to investigate abuse.
        </Clause>
        <Clause id="2.6">
          <strong>Messages to us.</strong> Anything you send to our support email, and our replies.
        </Clause>
        <Clause id="2.7">
          We collect information from you directly or from the providers named in section 5 acting on your behalf. We do not
          buy personal information from third parties.
        </Clause>
      </Section>

      <Section n={3} title="Why we use it, and on what basis">
        <Clause id="3.1">We use personal information only for the following purposes:</Clause>
        <Bullets
          items={[
            <><strong>To provide the Service you asked for</strong> (creating your account, generating and saving your material, applying your plan limits). Basis: performing our agreement with you.</>,
            <><strong>To take payment and manage your subscription</strong>, including refunds and cancellations. Basis: performing our agreement and keeping records the law requires.</>,
            <><strong>To keep the Service secure and prevent fraud or abuse</strong>, and to fix faults. Basis: our legitimate interest in running a safe service, which does not override your interests.</>,
            <><strong>To support you</strong> and answer your requests. Basis: performing our agreement and our legitimate interest.</>,
            <><strong>To meet legal duties</strong>, such as tax and accounting records and responding to lawful requests from authorities. Basis: legal obligation.</>,
            <><strong>To send service messages</strong> such as receipts, cancellation confirmations, security alerts and notices of changes to our terms. These are not marketing.</>,
          ]}
        />
        <Clause id="3.2">
          <strong>Voluntary or required.</strong> Providing your account information and, if you subscribe, completing
          payment is necessary for us to provide the Service. Everything else, including learner records and optional
          profile details, is optional, and the Service works without it.
        </Clause>
        <Clause id="3.3">
          We do not use your information for advertising, and we do not sell, rent or trade it.
        </Clause>
      </Section>

      <Section n={4} title="Learner and children's information">
        <Notice title="Please read this if you enter anything about learners">
          <p>
            Information about children is given extra protection under POPIA, and information about a child&rsquo;s health,
            disability or learning difficulties is &ldquo;special personal information&rdquo; with stricter rules.
          </p>
        </Notice>
        <Clause id="4.1">
          The Service lets you add learner names and marks and optional fields such as accommodations. <strong>Please enter
          only what you need.</strong> Use first names, initials or learner codes instead of full names, and do not enter
          medical, disability or other sensitive details about an identifiable child unless your school has authorised you
          to and has a lawful basis to do so.
        </Clause>
        <Clause id="4.2">
          You are responsible for having your school&rsquo;s authority (and, where required, parent or guardian consent) to
          record learner information in the Service, and for telling learners and parents how it is used.
        </Clause>
        <Clause id="4.3">
          We process learner information only on your instructions, to provide the Service to you. We do not use it for our
          own purposes, advertising or profiling, and we do not use it to train AI models.
        </Clause>
        <Clause id="4.4">
          When you ask the Service to analyse a class, the learner names and marks you have entered are sent to our AI
          provider (section 5) so that it can produce the analysis. Names are not needed for the analysis to work, so using
          initials or codes removes the identifying detail from that step. The risk levels and notes the Service produces
          are aids to your professional judgement. They are not diagnoses and not decisions about a child.
        </Clause>
        <Clause id="4.5">
          The Service is for teachers and is not directed at children. Learners do not create accounts or use it
          themselves.
        </Clause>
      </Section>

      <Section n={5} title="Who we share information with">
        <Clause id="5.1">
          We share personal information only with service providers who process it for us, on terms that require them to
          protect it and to use it only for the purpose we give them:
        </Clause>
        <Bullets
          items={[
            <><strong>Clerk</strong>: sign-in and account management (name, email, profile picture, sign-in details).</>,
            <><strong>PayFast</strong> (a Network International company): payment processing. PayFast collects your payment details itself and is a responsible party in its own right for that information. See its own privacy notice.</>,
            <><strong>Google</strong> (Gemini and image generation): receives the prompts we build from your classroom details and notes, learner information you ask it to analyse, and the content of lessons you ask it to refine, so it can generate the results.</>,
            <><strong>Pinecone</strong>: a search service that holds curriculum reference material. We send it numerical search vectors derived from the topic you chose, not your account or learner details.</>,
            <><strong>Hosting and database providers</strong> ({LEGAL.hostingProviders}): store Your Content and run the Service.</>,
          ]}
        />
        <Clause id="5.2">
          We may also disclose information where the law requires it (for example a court order or a request from a
          regulator or the South African Revenue Service), to protect the rights, safety or property of our users or of us,
          or in connection with a sale or reorganisation of the business, in which case the new owner must honour this
          policy.
        </Clause>
        <Clause id="5.3">We do not disclose personal information to anyone else.</Clause>
      </Section>

      <Section n={6} title="Transfers outside South Africa">
        <Clause id="6.1">
          Some of the providers above, including Google, Clerk, Pinecone and our hosting providers, store or process
          information in other countries, which may include the United States and Europe. When we transfer personal
          information abroad we do so only where the recipient is subject to rules or agreements that give a comparable
          level of protection, or where the transfer is necessary to perform our agreement with you, as POPIA section 72
          allows. By using the Service you acknowledge that your information will be processed in this way.
        </Clause>
      </Section>

      <Section n={7} title="Automated processing and AI">
        <Clause id="7.1">
          Generated content, learner &ldquo;risk levels&rdquo; and class analysis are produced by AI. We do not make
          decisions that have legal or similarly significant effects on a person solely by automated means. A teacher
          reviews and decides how to use every output. You should never rely on AI output about a learner without applying
          your own professional judgement.
        </Clause>
        <Clause id="7.2">
          We do not use Your Content to train AI models and we do not permit our AI provider to do so under our
          arrangements with it.
        </Clause>
      </Section>

      <Section n={8} title="Cookies and similar technologies">
        <Clause id="8.1">
          We use only the cookies and browser storage that the Service needs to work: session cookies set by our sign-in
          provider Clerk to keep you signed in and protect your account, and local settings that remember your
          preferences. We do not use advertising cookies or third-party tracking or analytics cookies. If you block
          essential cookies you will not be able to sign in.
        </Clause>
      </Section>

      <Section n={9} title="How long we keep information">
        <Bullets
          items={[
            <><strong>Account and Your Content:</strong> for as long as your account is open. When your account is deleted, your classrooms, learner records and generated material are deleted with it.</>,
            <><strong>Payment records</strong> (PayFast references, amounts, dates, status): at least five years, because tax law and our payment provider&rsquo;s rules require us to keep transaction records.</>,
            <><strong>Technical and security logs:</strong> for a limited period, normally not longer than needed to run and secure the Service.</>,
            <><strong>Support messages:</strong> for as long as needed to deal with your request and any follow-up, then deleted.</>,
          ]}
        />
        <Clause id="9.1">
          Information held by our providers in routine backups is overwritten on their normal schedules.
        </Clause>
      </Section>

      <Section n={10} title="How we protect it">
        <Clause id="10.1">
          We use reasonable technical and organisational measures, including encrypted connections (HTTPS), restricted access
          to production data, verified payment notifications, automatic sign-out after 60 minutes of inactivity, and a
          separate sign-in provider so we never handle your password. No online service is completely secure, so please also protect your own login.
        </Clause>
        <Clause id="10.2">
          If we have reasonable grounds to believe your personal information has been accessed or acquired by an
          unauthorised person, we will notify the Information Regulator and you as POPIA requires, as soon as reasonably
          possible, and tell you what happened and what you can do.
        </Clause>
      </Section>

      <Section n={11} title="Your rights">
        <Clause id="11.1">Under POPIA you may:</Clause>
        <Bullets
          items={[
            'ask us to confirm whether we hold personal information about you, and ask for a copy;',
            'ask us to correct or complete information that is inaccurate, incomplete or out of date;',
            'ask us to delete, or destroy, information we are no longer allowed to keep;',
            'object, on reasonable grounds, to our processing of your information;',
            'withdraw consent where we rely on it (this does not affect what we did before you withdrew);',
            'complain to the Information Regulator.',
          ]}
        />
        <Clause id="11.2">
          To use any of these rights, email {LEGAL.supportEmail} from your account address. We may ask you to confirm who
          you are before we act. We aim to respond within 30 days and will tell you if we need longer or cannot comply and why.
          If you act for a school and a learner or parent contacts you about their information, you remain responsible for
          responding as responsible party, and we will help you do so.
        </Clause>
        <Clause id="11.3">
          <strong>Deleting your account.</strong> Ask us at {LEGAL.supportEmail}, or delete your account through your
          account settings if that option is available to you. Deleting the account removes your information from the
          Service as described in section 9. Cancel any active subscription first (see the{' '}
          <Link href="/refund-policy" className={link}>Refund Policy</Link>), or ask us to do it.
        </Clause>
        <Notice title="Information Regulator (South Africa)">
          <p>
            If you believe we have handled your information unlawfully, you may complain to the Information Regulator at
            inforegulator.org.za. POPIA complaints (prescribed Form 5): POPIAComplaints@inforegulator.org.za. We would
            appreciate the chance to put things right first.
          </p>
        </Notice>
      </Section>

      <Section n={12} title="Marketing">
        <Clause id="12.1">
          We do not send unsolicited marketing. If we ever offer news or product updates by email we will do so only with
          your consent and every message will have a simple way to opt out.
        </Clause>
      </Section>

      <Section n={13} title="Changes to this policy">
        <Clause id="13.1">
          We may update this policy as the Service, our providers or the law change. We will update the version and date at
          the top of this page and, for material changes, tell you by email or in the Service before they take effect.
        </Clause>
      </Section>

      <Section n={14} title="Contact us">
        <Notice title="Privacy contact">
          <p>
            {LEGAL.companyName}, {LEGAL.physicalAddress}, {LEGAL.country}
          </p>
          <p>
            Email: <strong>{LEGAL.supportEmail}</strong> &middot; Information Officer: {LEGAL.informationOfficerEmail}
          </p>
        </Notice>
      </Section>
    </LegalDocument>
  );
}
