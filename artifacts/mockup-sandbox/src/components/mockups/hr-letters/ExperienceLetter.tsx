import { Letterhead, RefDateBlock, SignatoryBlock, VerificationLine } from './_shared/Letterhead';

export function ExperienceLetter() {
  return (
    <Letterhead>
      <RefDateBlock refNo="RL/EXP/2026/0047" date="14/04/2026" />

      <p className="text-center font-bold text-[12pt] tracking-wide text-gray-900 mb-6 uppercase">
        To Whom It May Concern
      </p>

      <p className="font-semibold text-[11pt] text-gray-900 mb-4">
        Subject: Experience Letter
      </p>

      <div className="space-y-4 text-justify">
        <p>
          This is to certify that <strong>Mr. Arjun Mehta</strong> (Employee ID: <strong>RSL-1042</strong>) 
          was employed with <strong>Rayomind Solutions LLP</strong> as a{' '}
          <strong>Senior Software Engineer</strong> in the <strong>Engineering</strong> department 
          from <strong>15/03/2022</strong> to <strong>31/03/2026</strong>.
        </p>

        <p>During his tenure, Mr. Mehta was responsible for the following:</p>

        <ul className="list-disc pl-8 space-y-1">
          <li>Leading the design and development of scalable microservices architecture for enterprise clients</li>
          <li>Mentoring a team of 4 junior developers and conducting regular code reviews</li>
          <li>Collaborating with cross-functional teams to deliver critical product milestones on schedule</li>
        </ul>

        <p>
          Mr. Mehta demonstrated strong technical acumen, particularly in{' '}
          <strong>cloud infrastructure design</strong> and <strong>distributed systems engineering</strong>.
        </p>

        <p>
          His conduct during his employment was <strong>exemplary</strong>. He consistently 
          demonstrated professionalism, integrity, and a collaborative spirit.
        </p>

        <p>
          We wish Mr. Mehta all the best in his future endeavours and professional pursuits.
        </p>

        <p>
          This letter is issued at the request of the employee for any purpose it may serve.
        </p>
      </div>

      <SignatoryBlock name="Priya Sharma" designation="Head of Human Resources" />
      <VerificationLine refNo="RL/EXP/2026/0047" authCode="A7F3-B92E" />
    </Letterhead>
  );
}
