import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';
import { PRO_PRICE_DISPLAY } from '@/lib/pricing';
import { LegalDocument, Section, Clause, Bullets, Notice, Summary } from '@/components/LegalDocument';

export const metadata: Metadata = {
  title: 'Refund, Cancellation & Delivery Policy — CurricuGen Pro',
  description: 'How to cancel CurricuGen Pro, when you can get a refund, and how refunds are paid.',
};

export default function RefundPolicyPage() {
  return (
    <LegalDocument title="Refund, Cancellation & Delivery Policy">
      <Summary title="The short version">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>CurricuGen Pro costs {PRO_PRICE_DISPLAY} per month</strong> (South African Rand), billed
            automatically every month through PayFast until you cancel.
          </li>
          <li>
            <strong>Cancel any time</strong>, with no penalty. Cancelling stops future charges; your Pro access runs to the
            end of the month you have already paid for.
          </li>
          <li>
            <strong>7-day money-back guarantee.</strong> Not happy? Ask for a refund within 7 days of subscribing and you
            get the full amount back, no questions asked.
          </li>
          <li>
            Charged by mistake, charged twice, or the service is not working? We will fix it or refund you. Details below.
          </li>
          <li>
            Refunds go back to the card or account you paid with, via PayFast. Email{' '}
            <strong>{LEGAL.supportEmail}</strong> to ask.
          </li>
        </ul>
      </Summary>

      <Section n={1} title="Who we are and what you are buying">
        <Clause id="1.1">
          This policy applies to purchases of CurricuGen Pro from {LEGAL.companyName}, trading as {LEGAL.tradingAs} (
          &ldquo;<strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;), {LEGAL.legalStatus}, registration number{' '}
          {LEGAL.registrationNumber}, based in {LEGAL.country} at {LEGAL.physicalAddress}. VAT: {LEGAL.vatStatus}.
        </Clause>
        <Clause id="1.2">
          We sell an online subscription to a web-based, AI-assisted tool that helps teachers generate curriculum
          blueprints, lesson plans, worksheets, assessments, memos and related teaching resources. It is a digital service.
          Nothing is shipped to you.
        </Clause>
        <Clause id="1.3">
          <strong>CurricuGen Pro</strong> is a monthly subscription for {PRO_PRICE_DISPLAY} per month, charged in South
          African Rand (ZAR), inclusive of VAT where VAT applies. It removes the daily generation limit of the free plan
          and includes a higher daily image allowance, subject to the fair-use terms in our{' '}
          <Link href="/terms" className="text-blue-400 hover:text-blue-300 underline">Licence Agreement</Link>.
        </Clause>
        <Clause id="1.4">
          There is also a free plan. It costs nothing, so there is nothing to refund. Free-plan allowances reset daily and
          cannot be saved, transferred or exchanged for money.
        </Clause>
      </Section>

      <Section n={2} title="Delivery">
        <Clause id="2.1">
          The service is delivered electronically. Pro features switch on automatically on your account as soon as PayFast
          confirms your payment to us, which is normally within a few minutes.
        </Clause>
        <Clause id="2.2">
          If your account has not been upgraded within 24 hours of a successful payment, email us at{' '}
          {LEGAL.supportEmail} with the email address on your account and your PayFast payment reference. We will activate
          Pro manually or refund you in full, whichever you prefer.
        </Clause>
        <Clause id="2.3">
          The service is available to teachers and other education professionals worldwide, but all prices are in ZAR and
          your bank may convert the amount into your own currency at its own rate (see clause 8.5).
        </Clause>
      </Section>

      <Section n={3} title="How billing works">
        <Clause id="3.1">
          When you click &ldquo;Upgrade to Pro&rdquo; and accept this policy and the Licence Agreement, you authorise a
          recurring payment of {PRO_PRICE_DISPLAY} through PayFast. The first payment is taken when you subscribe. The
          same amount is then taken on the same day each month, with no end date, until you cancel.
        </Clause>
        <Clause id="3.2">
          PayFast processes the payment. We never see or store your full card number or banking password. PayFast emails you
          a receipt for each payment.
        </Clause>
        <Clause id="3.3">
          If we ever change the price, we will email you at least 30 days before the new price applies, and you may cancel
          before it takes effect. A price change never applies to a payment you have already made.
        </Clause>
        <Clause id="3.4">
          If a monthly payment fails, PayFast may retry it. If it still fails, your account returns to the free plan until
          payment succeeds. Failed payments are not charged to you.
        </Clause>
      </Section>

      <Section n={4} title="Cancelling your subscription">
        <Clause id="4.1">
          You may cancel at any time, for any reason, and we charge no cancellation fee or penalty.
        </Clause>
        <Clause id="4.2">You can cancel by either of these routes:</Clause>
        <Bullets
          items={[
            <>
              Email <strong>{LEGAL.supportEmail}</strong> from the address on your account with the subject
              &ldquo;Cancel subscription&rdquo;. We will cancel it with PayFast and confirm by email within 1 business day.
            </>,
            <>
              Cancel directly with PayFast, which handles the payment, where PayFast offers buyers that option for your
              subscription. If you do, please also email us so we can confirm your account is updated.
            </>,
          ]}
        />
        <Clause id="4.3">
          To avoid being charged for the next month, cancel before your next billing date. Cancellation stops future
          charges only. It does not by itself refund a payment you have already made (but see clause 5).
        </Clause>
        <Clause id="4.4">
          After you cancel, your Pro access continues until the end of the monthly period you have already paid for. Your
          account then returns to the free plan. Your classrooms, lessons and other saved content stay in your account and
          remain available within the free plan&rsquo;s limits.
        </Clause>
      </Section>

      <Section n={5} title="Your 7-day money-back guarantee">
        <Clause id="5.1">
          You may cancel your purchase without giving a reason and without penalty by notifying us within{' '}
          <strong>7 days of subscribing</strong>. This matches the cooling-off right in section 44 of the Electronic
          Communications and Transactions Act 25 of 2002 and goes further than the law requires, because we apply it
          even if you have already used Pro features.
        </Clause>
        <Clause id="5.2">
          If you cancel within those 7 days we will refund the <strong>full {PRO_PRICE_DISPLAY}</strong> you paid. We do not
          deduct any fee, and because the service is digital there is no cost for returning anything.
        </Clause>
        <Clause id="5.3">
          <strong>Renewals.</strong> If you were charged a monthly renewal and did not mean to continue, tell us within 7
          days of that charge. We will refund the renewal in full provided you have not used Pro-only features (unlimited
          generations beyond the free daily limit, or extra images) since the renewal date. We will also cancel the
          subscription so it does not renew again.
        </Clause>
        <Clause id="5.4">
          This guarantee applies to a subscriber&rsquo;s first purchase and to each renewal as described, and is intended
          for genuine customers. We may decline a request if it forms a repeated pattern of subscribing, using Pro
          heavily, and then claiming a refund.
        </Clause>
      </Section>

      <Section n={6} title="If the service is faulty or not as described">
        <Clause id="6.1">
          We must perform the service with the care and skill you are entitled to expect (Consumer Protection Act 68 of
          2008, section 54). If a paid feature does not work properly, is materially different from how we describe it, or
          is unavailable for an extended period because of a fault on our side, please tell us.
        </Clause>
        <Clause id="6.2">
          We will first try to put it right promptly. If we cannot, or you do not want us to keep trying, we will refund a
          reasonable portion of what you paid, calculated for the period the service was affected. For a serious failure we
          will refund the whole month&rsquo;s payment.
        </Clause>
        <Clause id="6.3">
          <strong>AI content.</strong> Generated lesson plans and other content are produced by AI and can contain mistakes.
          You should review it before use (see the Licence Agreement). Dissatisfaction with the style or accuracy of a
          single output is not by itself a service fault. If outputs are consistently unusable, contact us and we will look
          into it. Within the 7-day guarantee in clause 5 you can in any case get your money back.
        </Clause>
        <Clause id="6.4">
          <strong>Free-plan credits.</strong> If a generation fails because of an error on our side, your daily credit is
          returned automatically.
        </Clause>
      </Section>

      <Section n={7} title="Incorrect, duplicate or unauthorised charges">
        <Clause id="7.1">
          If you were charged twice for the same period, charged an amount other than {PRO_PRICE_DISPLAY}, charged after
          you had cancelled, or you did not authorise the payment, we will refund the full incorrect amount. Tell us as soon
          as you notice. Please contact us before disputing the charge with your bank (see clause 10).
        </Clause>
      </Section>

      <Section n={8} title="How refunds are paid">
        <Clause id="8.1">
          <strong>Requesting a refund.</strong> Email <strong>{LEGAL.supportEmail}</strong> from your account email address
          with: the date and amount of the payment, the PayFast payment reference from your receipt (if you have it), and a
          short reason. You do not have to justify a request made within the 7-day guarantee.
        </Clause>
        <Clause id="8.2">
          <strong>Our response.</strong> We acknowledge requests within 2 business days and tell you our decision within 5
          business days. If we decline, we will explain why.
        </Clause>
        <Clause id="8.3">
          <strong>Where the money goes.</strong> Approved refunds are issued through PayFast to the payment method you
          used, for no more than the original payment. For card payments the money returns to the same card. For some
          other PayFast payment methods the refund cannot go back to the original source, and we will ask you for bank
          details to pay it by EFT.
        </Clause>
        <Clause id="8.4">
          <strong>Timing.</strong> We start the refund as soon as it is approved. After that, card refunds can take up to 7
          business days to reach your statement because of bank processing, and EFT refunds usually take 2 to 3 business
          days. We will always complete the refund within 30 days of your cancellation, as the law requires. PayFast emails
          you a refund confirmation, which serves as your refund receipt.
        </Clause>
        <Clause id="8.5">
          <strong>Currency.</strong> We refund in ZAR. If your card is in another currency, your bank converts the refund at
          its own rate and the amount you receive may differ slightly from what you were originally charged. We are not
          responsible for exchange-rate differences.
        </Clause>
        <Clause id="8.6">
          <strong>Fees.</strong> We do not deduct any payment-processing fee from your refund.
        </Clause>
        <Clause id="8.7">
          <strong>Effect on your account.</strong> When we refund a month you have already received, your Pro access ends
          and the account returns to the free plan. Your saved content is kept.
        </Clause>
      </Section>

      <Section n={9} title="What is not refundable">
        <Clause id="9.1">Apart from the situations above, we do not refund:</Clause>
        <Bullets
          items={[
            'a month for which you used Pro and did not ask for a refund within 7 days (unless clause 6 or 7 applies);',
            'the unused part of a month after you cancel (you keep Pro access to the end of that month instead);',
            'accounts we close for serious breach of the Licence Agreement, such as unlawful use or abuse of the service, except where the closure was our error.',
          ]}
        />
        <Clause id="9.2">
          None of this limits any right you have under the Consumer Protection Act or other South African law that cannot
          be excluded by agreement.
        </Clause>
      </Section>

      <Section n={10} title="Disputes and chargebacks">
        <Clause id="10.1">
          Please email us before raising a dispute with your bank or card issuer. Most problems can be solved the same day,
          and a refund from us is faster than a chargeback. If a chargeback is raised, we may suspend the paid features on
          the account while it is investigated, and we will give PayFast the records it needs to resolve it.
        </Clause>
        <Clause id="10.2">
          If we cannot resolve a complaint, you may refer it to the National Consumer Commission, the consumer
          protection authority for your province, or an accredited industry ombud scheme such as the Consumer Goods and
          Services Ombud, or go to the National Consumer Tribunal or a court with jurisdiction.
        </Clause>
      </Section>

      <Section n={11} title="Contact">
        <Notice title="Customer service">
          <p>
            Email: <strong>{LEGAL.supportEmail}</strong>
          </p>
          <p>
            {LEGAL.companyName}, {LEGAL.physicalAddress}, {LEGAL.country}
          </p>
          <p>We reply within 2 business days.</p>
        </Notice>
        <Clause id="11.1">
          We may update this policy. A change never reduces the rights you had when you made a purchase: the version in
          force on the date of your payment applies to that payment. The current version number and date are at the top of
          this page.
        </Clause>
        <Clause id="11.2">
          This policy is governed by the laws of the Republic of South Africa. It should be read with our{' '}
          <Link href="/terms" className="text-blue-400 hover:text-blue-300 underline">Licence Agreement</Link>.
        </Clause>
      </Section>
    </LegalDocument>
  );
}
