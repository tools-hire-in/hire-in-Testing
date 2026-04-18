import { Letterhead, RefDateBlock, SignatoryBlock, VerificationLine } from './_shared/Letterhead';

export function RelievingLetter() {
  return (
    <Letterhead>
      <RefDateBlock refNo="RL/REL/2026/0008" date="14/04/2026" />

      <p className="text-center font-bold text-[12pt] tracking-wide text-gray-900 mb-6 uppercase">
        To Whom It May Concern
      </p>

      <p className="font-semibold text-[11pt] text-gray-900 mb-4">
        Subject: Relieving Letter
      </p>

      <div className="space-y-4 text-justify">
        <p>
          This is to confirm that <strong>Mr. Vikram Singh</strong> (Employee ID:{' '}
          <strong>RSL-0876</strong>) was employed with <strong>Rayomind Solutions LLP</strong>{' '}
          as a <strong>DevOps Engineer</strong> in the <strong>Infrastructure</strong> department.
        </p>

        <p>
          His resignation was duly accepted, and he has served the notice period in full. 
          His last working day with the organisation was <strong>31/03/2026</strong>.
        </p>

        <p>
          We confirm that all dues payable to Mr. Singh have been settled in full, and 
          all company property, including identification cards, equipment, and confidential 
          materials, has been returned by him.
        </p>

        <p>
          The company has no objection to Mr. Singh seeking employment elsewhere, 
          and he is hereby relieved from his duties with immediate effect from the 
          aforementioned date.
        </p>

        <p>
          We wish Mr. Singh all the best in his future professional endeavours.
        </p>

        <p>
          This letter is issued at the request of the employee for record and employment/background verification purposes.
        </p>
      </div>

      <SignatoryBlock name="Priya Sharma" designation="Head of Human Resources" />
      <VerificationLine refNo="RL/REL/2026/0008" authCode="D9E2-71AF" />
    </Letterhead>
  );
}
