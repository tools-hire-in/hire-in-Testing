import { Letterhead, RefDateBlock, SignatoryBlock, VerificationLine } from './_shared/Letterhead';

export function InternshipLetter() {
  return (
    <Letterhead>
      <RefDateBlock refNo="RL/INT/2026/0015" date="14/04/2026" />

      <p className="text-center font-bold text-[12pt] tracking-wide text-gray-900 mb-6 uppercase">
        To Whom It May Concern
      </p>

      <p className="font-semibold text-[11pt] text-gray-900 mb-4">
        Subject: Internship Completion Letter
      </p>

      <div className="space-y-4 text-justify">
        <p>
          This is to certify that <strong>Ms. Ananya Rao</strong> (Intern ID: <strong>RSL-I089</strong>) 
          successfully completed her internship at <strong>Rayomind Solutions LLP</strong> in the{' '}
          <strong>Product Design</strong> department from <strong>01/06/2025</strong> to{' '}
          <strong>30/11/2025</strong>.
        </p>

        <p>
          During her internship, Ms. Rao was assigned to the{' '}
          <strong>Customer Analytics Dashboard</strong> project and was responsible for the following:
        </p>

        <ul className="list-disc pl-8 space-y-1">
          <li>Conducting user research and stakeholder interviews to define dashboard requirements</li>
          <li>Designing wireframes, prototypes, and high-fidelity UI mockups for the analytics module</li>
          <li>Collaborating with the engineering team to ensure design feasibility and implementation accuracy</li>
        </ul>

        <p>Ms. Rao demonstrated proficiency in the following skills:</p>

        <ul className="list-disc pl-8 space-y-1">
          <li>User experience research and usability testing methodologies</li>
          <li>Figma-based prototyping and design system maintenance</li>
          <li>Cross-functional communication and agile sprint participation</li>
        </ul>

        <p>
          Her overall performance during the internship period was assessed as{' '}
          <strong>very good</strong>. She exhibited strong initiative, a keen eye for detail, 
          and a willingness to learn.
        </p>

        <p>
          This letter is issued for academic, employment, and record purposes at the 
          request of the intern.
        </p>
      </div>

      <SignatoryBlock name="Priya Sharma" designation="Head of Human Resources" />
      <VerificationLine refNo="RL/INT/2026/0015" authCode="C2D8-E14A" />
    </Letterhead>
  );
}
